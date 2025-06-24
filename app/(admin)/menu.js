import React, { useState, useEffect, useContext } from "react";
import {
  View,
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
import { PlusButtonContext } from "./_layout";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";
import { useFocusEffect } from "@react-navigation/native";

const API_BASE = "https://numbr-p7zc.onrender.com";

export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(null);
  const [queueItems, setQueueItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [shopId, setShopId] = useState(null);
  const [barberId, setBarberId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [editingUid, setEditingUid] = useState(null);
  const [socket, setSocket] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [longPressIndex, setLongPressIndex] = useState(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalChecklist, setInfoModalChecklist] = useState([]);

  const totalSelectedPrice = checklist
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + item.price, 0);

  const { setPlusButtonHandler } = useContext(PlusButtonContext);

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

const fetchRateList = async () => {
  if (!shopId) {
    console.error("Shop ID not available");
    return;
  }

  try {
   
    const response = await fetch(`${API_BASE}/api/shops/${shopId}/rate-list`);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Rate list fetch failed:", errText);
      return;
    }

    const result = await response.json();
    

    const fetchedChecklist = result.data.map((item, index) => ({
      id: index + 1,
       _id: item._id,
      text: item.name,
      price: item.price,
      checked: false,
    }));

   
    setChecklist(fetchedChecklist);
  } catch (err) {
    console.error("Error in fetchRateList:", err);
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

  useEffect(() => {
    const newSocket = io(API_BASE);
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on("queue:updated", () => {
        fetchQueueData();
      });
    }
  }, [socket]);

const fetchQueueData = async () => {
  if (!shopId) {
    console.error("Cannot fetch queue - shopId is null/undefined");
    return;
  }
  
 
  
  try {
    const url = `${API_BASE}/api/queue/shop/${shopId}`;
   
    
    const response = await fetch(url);
    
  
    
    // First check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, response:`, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Check content type
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Received non-JSON response. Content-Type:", contentType, "Response:", text);
      throw new TypeError("Expected JSON response");
    }
    
    const data = await response.json();
  
    
    if (data.success) {
    //  console.log("Queue data received. Count:", data.count, "Items:", data.data.length);
      setQueueLength(data.count);
      setQueueItems(data.data);
    } else {
      console.error("API returned unsuccessful response:", data);
      Alert.alert("Error", "Failed to load queue data. Please try again.");
    }
  } catch (error) {
    console.error("Error in fetchQueueData:", {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    Alert.alert("Error", "Failed to load queue data. Please try again.");
  }
};

  useFocusEffect(
    React.useCallback(() => {
      fetchQueueData();
    }, [shopId])
  );

  const updateUserServices = async (selectedServices, totalCost) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Authentication Error", "User not authenticated.");
        return;
      }

      const servicesForUpdate = selectedServices.map(serviceName => {
        const service = checklist.find(item => item.text === serviceName);
        return {
          name: serviceName,
          price: service ? service.price : 0
        };
      });

      const response = await fetch(`${API_BASE}/queue/${editingUid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          services: servicesForUpdate,
          totalCost: totalCost,
        }),
      });

      if (response.ok) {
        fetchQueueData();
        Alert.alert("Success", "Services updated successfully.");
      } else {
        Alert.alert("Error", "Failed to update services.");
      }
    } catch (error) {
      console.error("Error updating services:", error);
      Alert.alert("Error", "Failed to update services.");
    }
  };

const markUserServed = async (queueId) => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    const barberId = await AsyncStorage.getItem("uid"); // Assuming barber's ID is stored here

    if (!token || !barberId) {
      console.error("Missing token or barber ID");
      Alert.alert("Error", "Authentication required. Please re-login.");
      return;
    }

    const payload = {
      status: "completed",
      barberId: barberId,
    };

   // console.log("Marking user served with payload:", payload);

    const response = await fetch(`${API_BASE}/api/queue/${queueId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to mark as served. Response:", data);
      Alert.alert("Error", data.message || "Failed to mark as served");
      return;
    }

   // console.log("User marked as served successfully:", data);
    Alert.alert("Success", "Customer marked as served");
    fetchQueueData(); // Refresh the queue
  } catch (error) {
    console.error("Error in markUserServed:", error);
    Alert.alert("Error", error.message || "Failed to mark as served");
  }
};


const removePerson = async (queueId) => {
  if (!shopId) return;
  try {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) {
      Alert.alert("Authentication Error", "User not authenticated.");
      return;
    }

    const response = await fetch(`${API_BASE}/api/queue/${queueId}/cancel`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const queueEntry = await response.json();
      if (queueEntry.data && queueEntry.data.userId) {
        await fetch(`${API_BASE}/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: queueEntry.data.userId,
            title: "Removed from queue",
            body: `You have been removed from the queue.`,
          }),
        });
      }
      fetchQueueData();
    } else {
      const errorText = await response.text();
      console.error("Remove person failed:", errorText);
      Alert.alert("Error", "Failed to remove person from queue.");
    }
  } catch (error) {
    console.error("Error removing person:", error);
    Alert.alert("Error", "Failed to remove person from queue.");
  }
};

const moveDownPerson = async (queueId) => {
    if (!shopId) return;
    try {
       // console.log(`Attempting to move down queue entry: ${queueId}`);
        const token = await AsyncStorage.getItem("userToken");
        if (!token) {
            Alert.alert("Authentication Error", "User not authenticated.");
            return;
        }
        
       
        
        const response = await fetch(`${API_BASE}/api/queue/${queueId}/move-down`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

      //  console.log("Response status:", response.status);
        
        if (response.ok) {
            const data = await response.json();
          //  console.log("Move down successful:", data);
            fetchQueueData();
        } else {
            const errorText = await response.text();
            console.error("Move down failed:", errorText);
            Alert.alert("Error", "Failed to move user down in queue.");
        }
    } catch (error) {
        console.error("Error moving user down:", error);
        Alert.alert("Error", "Failed to move user down in queue.");
    }
};

const joinQueue = async () => {
  if (!shopId) {
    Alert.alert("Error", "Shop ID not available.");
    return;
  }

  let finalName = newName.trim();
  if (finalName === "") {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    finalName = `User${hour}${minutes}${seconds}`;
  }

  // Build service list in backend-compatible format
  const selectedServices = checklist
    .filter((item) => item.checked)
    .map((item) => ({
      service: item._id,
      quantity: 1,
    }));

  if (selectedServices.length === 0) {
    Alert.alert("No Service Selected", "Please select at least one service before proceeding.");
    return;
  }

  try {
    const token = await AsyncStorage.getItem("userToken");

    const response = await fetch(`${API_BASE}/api/queue/walkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        shopId,
        customerName: finalName,
        customerPhone: "0000000000", // fallback for walk-ins
        services: selectedServices,
      }),
    });

    if (response.ok) {
      fetchQueueData();
      setModalVisible(false);
    } else {
      const errorText = await response.text();
      console.error("Join queue failed:", errorText);
      Alert.alert("Error", "Failed to add walk-in customer to queue.");
    }
  } catch (error) {
    console.error("Error adding walk-in customer:", error);
    Alert.alert("Error", "An error occurred while adding walk-in customer.");
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
          {queueItems[0] ? queueItems[0].uniqueCode : "No queue"}
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
              key={item._id}
              style={styles.queueCard}
              onLongPress={() => {
                setLongPressIndex(index);
                setTimeout(() => setLongPressIndex(null), 3000);
              }}
            >
              <View style={styles.leftSection}>
                <Text style={styles.queueNumber}>{item.orderOrQueueNumber}.</Text>
                <View style={styles.detailsContainer}>
                  <Text style={styles.queueName}>
                    {item.customerName || (item.userId && item.userId.name) || 'Guest'}
                  </Text>
                  <Text style={styles.queueId}>Code: {item.uniqueCode}</Text>
                  <View style={styles.serviceRow}>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert(
                          "Services",
                          item.services && item.services.length > 0
                            ? item.services.map(s => s.name).join(", ")
                            : "No services"
                        )
                      }
                    >
                      <Text style={styles.servicesText}>View Services</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.infoButton}
                      onPress={() => {
                        setEditingUid(item._id);
                        const updatedChecklist = checklist.map(service => ({
                          ...service,
                          checked: item.services.some(s => s.name === service.text),
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
                      markUserServed(
                        item._id,
                        item.customerName || (item.userId && item.userId.name) || 'Guest',
                        item.services,
                        item.totalCost
                      )
                    }
                  >
                    <Icon name="check" size={24} color="white" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => removePerson(item._id)}>
                    <Icon name="delete" size={24} color="red" />
                  </TouchableOpacity>
                )}
                {index < 3 && (
                  <TouchableOpacity
                    style={styles.downButton}
                    onPress={() =>
                      longPressIndex === index
                        ? removePerson(item._id)
                        : moveDownPerson(item._id)
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
    marginRight: 0,
  },
  nameContainer: {
    flexShrink: 1,
    maxWidth: "70%",
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
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  doneButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgb(48, 139, 36)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    elevation: 3,
  },
  downButton: {
    width: 40,
    height: 40,
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