import React, { useState, useEffect, useContext } from "react";
import {View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Modal,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { PlusButtonContext } from "./_layout"; // Adjust this import path as needed
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";
import { useFocusEffect } from "@react-navigation/native";

const API_BASE = "https://servercheckbarber-2u89.onrender.com";

export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(null);
  const [queueItems, setQueueItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [shopId, setShopId] = useState(null);
  const [barberId, setBarberId] = useState(null);
  const [userId, setUserId] = useState(null);
  // New state to track which queue item's uid is being edited.
  const [editingUid, setEditingUid] = useState(null);
  const [socket, setSocket] = useState(null);

  // Checklist state – loaded dynamically
  const [checklist, setChecklist] = useState([]);
  const [longPressIndex, setLongPressIndex] = useState(null);

  // State for the editing modal checklist
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalChecklist, setInfoModalChecklist] = useState([]);

  // Calculate total price (assuming price is numeric)
  const totalSelectedPrice = checklist
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + item.price, 0);

  const { setPlusButtonHandler } = useContext(PlusButtonContext);

  // Fetch IDs from AsyncStorage
  useEffect(() => {
    const fetchIds = async () => {
      const uidStored = await AsyncStorage.getItem("uid");
      setUserId(uidStored);
      setBarberId(uidStored);
      const sId = await AsyncStorage.getItem("shopId");
      if (!sId) {
        console.error("shopId not found in AsyncStorage");
      }
      setShopId(sId);
    };
    fetchIds();
  }, []);

  // Fetch dynamic rate list from the API
  const fetchRateList = async () => {
    if (!shopId) return;
    try {
      const response = await fetch(`${API_BASE}/shop/rateList?id=${shopId}`);
      if (!response.ok) {
        console.error("Failed to fetch rate list");
        return;
      }
      const data = await response.json();
      const fetchedChecklist = data.map((item, index) => ({
        id: index + 1,
        text: item.service,
        price: item.price, // assuming numeric price
        checked: false,
      }));
      setChecklist(fetchedChecklist);
    } catch (error) {
      console.error("Error fetching rate list:", error);
    }
  };

  useEffect(() => {
    if (shopId) {
      fetchRateList();
    }
  }, [shopId]);

  useEffect(() => {
    setPlusButtonHandler(() => handleIncrement);
    return () => setPlusButtonHandler(() => {});
  }, [setPlusButtonHandler]);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(API_BASE);
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on("queueUpdated", () => {
        fetchQueueData();
      });
    }
  }, [socket]);

  const fetchQueueData = async () => {
    if (!shopId) return;
    try {
      const response = await fetch(`${API_BASE}/queue?shopId=${shopId}`);
      const data = await response.json();
      setQueueLength(data.queueLength);
      setQueueItems(data.data);
    } catch (error) {
      console.error("Error fetching queue data:", error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchQueueData();
    }, [shopId])
  );

  // Updated function that now uses editingUid rather than global userId
  const updateUserServices = async (selectedServices, totalCost) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Authentication Error", "User not authenticated.");
        return;
      }
      const response = await fetch(`${API_BASE}/update-services`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          uid: editingUid, // Use the uid of the item whose info button was clicked
          services: selectedServices,
          totalCost: totalCost,
        }),
      });
      if (response.ok) {
        fetchQueueData();
      } else {
        Alert.alert("Error", "Failed to update services.");
      }
    } catch (error) {
      console.error("Error updating services:", error);
    }
  };

  const markUserServed = async (uidParam, userName, services, cost) => {
    if (!shopId) return;
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Authentication Error", "User not authenticated.");
        return;
      }
      const response = await fetch(`${API_BASE}/barber/add-history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shopId, barberId, userId: uidParam, service: services, cost }),
      });
      if (response.ok) {
        await fetch(`${API_BASE}/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: uidParam,
            title: "Service Done",
            body: `Thank you please rate us`,
            data: { id: `${barberId}` },
          }),
        });
        socket.emit("markedServed", { userId: uidParam, userName });
      }
      await fetch(`${API_BASE}/queue?shopId=${shopId}&uid=${encodeURIComponent(uidParam)}`, {
        method: "DELETE",
      });
      fetchQueueData();
      Alert.alert("Success", "User has been marked as served and removed from the queue.");
    } catch (error) {
      console.error("Error marking user served:", error);
      Alert.alert("Error", "Failed to mark user as served.");
    }
  };

  const removePerson = async (name, uidParam) => {
    if (!shopId) return;
    const res = await fetch(
      `${API_BASE}/queue?shopId=${shopId}&uid=${encodeURIComponent(uidParam)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await fetch(`${API_BASE}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: uidParam,
          title: "Removed from queue",
          body: `You have been removed from the queue.`,
        }),
      });
      socket.emit("removedFromQueue", { name, uid: uidParam });
    }
    fetchQueueData();
  };

  const moveDownPerson = async (name, id, uidParam) => {
    if (!shopId) return;
    try {
      const res = await fetch(`${API_BASE}/queue/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, name, id }),
      });
      if (res.ok) {
        if (uidParam.endsWith("=")) {
          console.log("Dummy user detected, skipping history update");
          return;
        }
        const token = await AsyncStorage.getItem("userToken");
        if (!token) {
          Alert.alert("Authentication Error", "User not authenticated.");
          return;
        }
        const notifyResponse = await fetch(`${API_BASE}/notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            uid: uidParam,
            title: "Queue Update",
            body: `Dear ${name}, you have been moved down in the queue.`,
          }),
        });
        if (!notifyResponse.ok) {
          console.error("Failed to send notification");
        }
        socket.emit("moveDownQueue", { shopId, name, id, uid: uidParam });
        fetchQueueData();
      } else {
        console.error("Failed to move user down in the queue");
        Alert.alert("Error", "Failed to move user down in the queue.");
      }
    } catch (error) {
      console.error("Error moving user down:", error);
      Alert.alert("Error", "Failed to move user down in the queue.");
    }
  };

  const joinQueue = async () => {
    if (!shopId) {
      Alert.alert("Error", "Shop ID not available.");
      return;
    }
    let finalName = newName.trim();
    const random = Math.floor(Math.random() * 1000);
    if (finalName === "") {
      const now = new Date();
      const hour = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      finalName = `User${hour}${minutes}${seconds}`;
    }
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const id = `${finalName}${hour}${minutes}${seconds}${random}=`;
    const code = finalName.substring(0, 2) + id.substring(8, 12).toUpperCase();
    const selectedServices = checklist.filter((item) => item.checked).map((item) => item.text);
    if (selectedServices.length === 0) {
      Alert.alert("No Service Selected", "Please select at least one service before proceeding.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          name: finalName,
          id: id,
          code: code,
          services: selectedServices,
          totalCost: totalSelectedPrice,
        }),
      });
      if (response.ok) {
        socket.emit("joinQueue", {
          shopId,
          name: finalName,
          id: id,
          code: code,
          services: selectedServices,
          totalCost: totalSelectedPrice,
        });
        fetchQueueData();
        setModalVisible(false);
      } else {
        Alert.alert("Error", "Failed to join the queue.");
      }
    } catch (error) {
      console.error("Error joining queue:", error);
      Alert.alert("Error", "An error occurred while joining the queue.");
    }
  };

  const handleIncrement = () => {
    setNewName("");
    setChecklist((prev) => prev.map((item) => ({ ...item, checked: false })));
    setModalVisible(true);
  };

  const handleCancel = () => {
    setModalVisible(false);
  };

  if (queueLength === null) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
      <View style={styles.container}>
        <Text style={styles.userCode}>
          {queueItems[0] ? queueItems[0].code : "Aaj kdki h!"}
        </Text>
        <Text style={styles.queue}>👤 {queueLength}</Text>
        <Text style={styles.queueListTitle}>Queue List</Text>
        <ScrollView
          style={styles.namesContainer}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 10 }}
        >
          {queueItems.map((item, index) => (
            <TouchableOpacity
              key={item.uid}
              style={styles.queueCard}
              onLongPress={() => {
                setLongPressIndex(index);
                setTimeout(() => setLongPressIndex(null), 3000);
              }}
            >
              <View style={styles.leftSection}>
                <Text style={styles.queueNumber}>{index + 1}.</Text>
                <View style={styles.detailsContainer}>
                  <Text style={styles.queueName}>{item.name}</Text>
                  <Text style={styles.queueId}>ID: {item.code}</Text>
                  <View style={styles.serviceRow}>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert(
                          "Services",
                          item.services && item.services.length > 0
                            ? item.services.join(", ")
                            : "No services"
                        )
                      }
                    >
                      <Text style={styles.servicesText}>View Services</Text>
                    </TouchableOpacity>
                    {/* Capture the clicked item's uid in editingUid */}
                    <TouchableOpacity
                      style={styles.infoButton}
                      onPress={() => {
                        setEditingUid(item.uid);
                        const updatedChecklist = checklist.map((service) => ({
                          ...service,
                          checked: item.services.includes(service.text),
                        }));
                        setInfoModalChecklist(updatedChecklist);
                        setInfoModalVisible(true);
                      }}
                    >
                      <Icon name="info" size={20} color="black" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={styles.iconGroup}>
                {index < 3 ? (
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() =>
                      markUserServed(item.uid, item.name, item.services, item.totalCost)
                    }
                  >
                    <Icon name="check" size={24} color="white" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => removePerson(item.name, item.uid)}>
                    <Icon name="delete" size={24} color="red" />
                  </TouchableOpacity>
                )}
                {index < 3 && (
                  <TouchableOpacity
                    style={styles.downButton}
                    onPress={() =>
                      longPressIndex === index
                        ? removePerson(item.name, item.uid)
                        : moveDownPerson(item.name, item._id, item.uid)
                    }
                  >
                    <Icon
                      name={longPressIndex === index ? "delete" : "arrow-downward"}
                      size={24}
                      color={longPressIndex === index ? "red" : "white"}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Modal for joining queue */}
        <Modal
          transparent={true}
          animationType="slide"
          visible={modalVisible}
          onRequestClose={handleCancel}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter Name & Select Services</Text>
              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter your name"
                onFocus={() => setNewName("")}
              />
              <FlatList
                data={checklist}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.checklistItem}
                    onPress={() =>
                      setChecklist((prev) =>
                        prev.map((i) =>
                          i.id === item.id ? { ...i, checked: !i.checked } : i
                        )
                      )
                    }
                  >
                    <View style={styles.checklistRow}>
                      <Text style={styles.checklistText}>{item.text}</Text>
                      <Text style={styles.checklistPrice}>₹{item.price}</Text>
                      <Icon
                        name={item.checked ? "check-box" : "check-box-outline-blank"}
                        size={24}
                        color="green"
                      />
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
              />
              <Text style={styles.totalPrice}>
                Total Price: ₹{totalSelectedPrice}
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalButton} onPress={handleCancel}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={joinQueue}>
                  <Text style={styles.modalButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal for editing services */}
        <Modal
          visible={infoModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setInfoModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Selected Services</Text>
              <FlatList
                data={infoModalChecklist}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.checklistItem}
                    onPress={() =>
                      setInfoModalChecklist((prev) =>
                        prev.map((i) =>
                          i.id === item.id ? { ...i, checked: !i.checked } : i
                        )
                      )
                    }
                  >
                    <View style={styles.checklistRow}>
                      <Text style={styles.checklistText}>{item.text}</Text>
                      <Text style={styles.checklistPrice}>₹{item.price}</Text>
                      <Icon
                        name={item.checked ? "check-box" : "check-box-outline-blank"}
                        size={24}
                        color="green"
                      />
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
              />
              <Text style={styles.totalPrice}>
                Total Price: ₹
                {infoModalChecklist
                  .filter((item) => item.checked)
                  .reduce((sum, item) => sum + item.price, 0)}
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setInfoModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => {
                    const selectedServices = infoModalChecklist
                      .filter((item) => item.checked)
                      .map((item) => item.text);
                    const totalCost = infoModalChecklist
                      .filter((item) => item.checked)
                      .reduce((sum, item) => sum + item.price, 0);
                    updateUserServices(selectedServices, totalCost);
                    setInfoModalVisible(false);
                  }}
                >
                  <Text style={styles.modalButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(237, 236, 236, 0.77)",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 15,
    paddingRight: 15,
    paddingLeft: 15,
  },
  userCode: {
    fontSize: 70,
    fontWeight: "bold",
    textAlign: "center",
    color: "black",
  },
  queue: {
    position: "absolute",
    top: 10,
    right: 10,
    fontSize: 18,
    fontWeight: "bold",
    color: "black",
  },
  queueListTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
    color: "black",
  },
  namesContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    padding: 10,
    maxHeight: "72%",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  queueCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: 10,
    padding: 20,
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    flexDirection: "row",
    alignItems: "flex-start",
  },
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 10,
  },
  queueNumber: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
  },
  queueName: {
    fontSize: 20,
    color: "#777",
    flexWrap: "wrap",
  },
  queueId: {
    fontSize: 10,
    color: "#555",
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  servicesText: {
    fontSize: 14,
    color: "blue",
  },
  infoButton: {
    marginLeft: 10,
  },
  iconGroup: {
    display:"flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  doneButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgb(48, 139, 36)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    elevation: 3,
  },
  downButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgb(7, 55, 229)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    elevation: 3,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    marginVertical: 5,
    width: "100%",
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  checklistText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    marginLeft: "auto",
  },
  checklistPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#555",
    marginRight: "5%",
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginTop: 10,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 10,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    color: "#007bff",
  },
});