import React, { useState, useEffect, useRef, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Animated,
  Modal,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";            
import { PlusButtonContext } from "./_layout"; // Adjust this import path as needed
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client"; // Import socket.io-client

export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(null);
  const [queueItems, setQueueItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const API_BASE = "https://barberqueue-24143206157.us-central1.run.app";
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [barberId, setBarberId] = useState(null); // Barber ID state
  const [socket, setSocket] = useState(null);

  // NEW: Checklist state (services with prices and checked flag)
  const [checklist, setChecklist] = useState([
    { id: 1, text: "Haircut", price: "₹70", checked: false },
    { id: 2, text: "Beard Trim", price: "₹40", checked: false },
    { id: 3, text: "Shave", price: "₹30", checked: false },
    { id: 4, text: "Hair Wash", price: "₹300", checked: false },
    { id: 5, text: "Head Massage", price: "₹120", checked: false },
    { id: 6, text: "Facial", price: "₹150", checked: false },
    { id: 7, text: "Hair Color", price: "₹200", checked: false },
  ]);

  // Calculate the total price based on selected services
  const totalSelectedPrice = checklist
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + parseInt(item.price.substring(1)), 0);

  // Get the setter from context to register our plus button handler
  const { setPlusButtonHandler } = useContext(PlusButtonContext);
  useEffect(() => {
    const fetchBarberId = async () => {
      const id = await AsyncStorage.getItem("uid");
      setBarberId(id); // Set the barberId state
    };
    fetchBarberId();
  }, []);

  // Register handleIncrement as the plus button handler when this screen mounts.
  useEffect(() => {
    setPlusButtonHandler(() => handleIncrement);
    return () => setPlusButtonHandler(() => {});
  }, [setPlusButtonHandler]);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(API_BASE); // Connect to the WebSocket server
    setSocket(newSocket);

    // Cleanup on unmount
    return () => newSocket.disconnect();
  }, []);

  // Listen for queue updates from the server
  useEffect(() => {
    if (socket) {
      socket.on("queueUpdated", () => {
        fetchQueueData(); // Fetch updated queue data when notified
      });
    }
  }, [socket]);

  // Fetch queue data from the server
  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${API_BASE}/queue`);
      const data = await response.json();
      setQueueLength(data.queueLength);
      setQueueItems(data.data);
    } catch (error) {
      console.error("Error fetching queue data:", error);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  // Mark user as served (existing functionality)
  const markUserServed = async (userId, userName, services, cost) => {
    console.log("Mark user as served", userId, userName);
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
        body: JSON.stringify({ barberId, userId, service: services, cost }),
      });
      if (response.ok) {
        await fetch(`${API_BASE}/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: userId,
            title: "Service Done",
            body: `Thank you please rate us`,
            data: { id: `${barberId}` },
          }),
        });
        socket.emit("markedServed", { userId, userName });
      }
      await fetch(`${API_BASE}/queue?uid=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      fetchQueueData();
      Alert.alert(
        "Success",
        "User has been marked as served and removed from the queue."
      );
    } catch (error) {
      console.error("Error marking user served:", error);
      Alert.alert("Error", "Failed to mark user as served.");
    }
  };

  const removePerson = async (name, uid) => {
    const res = await fetch(`${API_BASE}/queue?uid=${encodeURIComponent(uid)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetch(`${API_BASE}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          title: "Removed from queue",
          body: `You have been removed from the queue.`,
        }),
      });
      socket.emit("removedFromQueue", { name, uid });
    }
    fetchQueueData();
  };

  const moveDownPerson = async (name, id, uid) => {
    try {
      const res = await fetch(`${API_BASE}/queue/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, id }),
      });
  
      if (res.ok) {
        if (uid.endsWith("=")) {
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
            uid: uid,
            title: "Queue Update",
            body: `Dear ${name}, you have been moved down in the queue.`,
          }),
        });
  
        if (!notifyResponse.ok) {
          console.error("Failed to send notification");
        }
  
        socket.emit("moveDownQueue", { name: name, id: id, uid: uid });
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

  // NEW: Combined joinQueue function that uses both the name and the checklist
  const joinQueue = async () => {
    let finalName = newName.trim();
    if (finalName === "") {
      const now = new Date();
      const hour = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      finalName = `User${hour}${minutes}${seconds}`;
    }
    // Generate a unique id and code based on the name and current time
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const id = `${finalName}${hour}${minutes}${seconds}=`;
    const code = finalName.substring(0, 2) + id.substring(3, 7).toUpperCase();

    // Get the selected services from the checklist
    const selectedServices = checklist.filter((item) => item.checked).map((item) => item.text);

    if (selectedServices.length === 0) {
      Alert.alert(
        "No Service Selected",
        "Please select at least one service before proceeding."
      );
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          id: id,
          code: code,
          services: selectedServices,
          totalCost: totalSelectedPrice,
        }),
      });
      
      if (response.ok) {
        socket.emit("joinQueue", {
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

  // Plus button functionality: open the modal and reset fields.
  const handleIncrement = () => {
    setNewName("");
    // Reset checklist selections on open
    setChecklist((prev) =>
      prev.map((item) => ({ ...item, checked: false }))
    );
    setModalVisible(true);
  };

  // Cancel button in modal
  const handleCancel = () => {
    setModalVisible(false);
  };

  const handleDecrement = async () => {
    await fetch(`${API_BASE}/queue`, { method: "DELETE" });
    fetchQueueData();
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
           <View key={item.uid} style={styles.queueCard}>
             <View style={styles.nameText}>
               <Text style={styles.queueNumber}>{index + 1}.</Text>
               <View>
                 <Text style={styles.queueName}>{item.name}</Text>
                 <Text style={styles.queueId}>ID: {item.code}</Text>
                 <TouchableOpacity
                   onPress={() => {
                     Alert.alert(
                       "Services",
                       item.services && item.services.length > 0
                         ? item.services.join(", ")
                         : "No services"
                     );
                   }}
                 >
                   <Text style={styles.servicesText}>View Services</Text>
                 </TouchableOpacity>
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
                   onPress={() => moveDownPerson(item.name, item._id, item.uid)}
                 >
                   <Icon name="arrow-downward" size={24} color="white" />
                 </TouchableOpacity>
               )}
             </View>
           </View>
         ))}
        </ScrollView>

        {/* Modified Modal: Now includes both name input and checklist */}
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
      {/* Render checklist items */}
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
              <Text style={styles.checklistPrice}>{item.price}</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "#F9F9F9",
    padding: 20,
    borderRadius: 10,
    marginBottom: 10,
    width: "100%",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  queueNumber: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
  },
  queueName: {
    top: "5%",
    fontSize: 20,
    color: "#777",
  },
  queueId: {
    fontSize: 10,
    color: "#555",
  },
  servicesText: {
    fontSize: 14,
    color: "blue",
    marginTop: 5,
  },
  joinButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "rgb(0, 0, 0)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  doneButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgb(48, 139, 36)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  downButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgb(7, 55, 229)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  leaveButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgb(212, 53, 53)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 5,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  iconGroup: {
    flexDirection: "row",
    gap: 5,
  },
  nameText: {
    flexDirection: "row",
    gap: 5,
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
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
