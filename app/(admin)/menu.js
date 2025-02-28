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
  const API_BASE = "https://servercheckbarber.vercel.app";
  const shineAnimation = useRef(new Animated.Value(0)).current;

  // WebSocket connection
  const [socket, setSocket] = useState(null);

  // Get the setter from context to register our plus button handler
  const { setPlusButtonHandler } = useContext(PlusButtonContext);

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

  // Mark user as served by updating their history and then removing them from the queue.
  const markUserServed = async (userId, userName) => {
    console.log("Mark user as served", userId, userName);
   
    try {
      // Retrieve the stored token from AsyncStorage
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
        body: JSON.stringify({ userId, service: "Haircut" }),
      });
      if (response.ok) {
        // Log error details from the backend response
        socket.emit("markedServed",{userId, userName});
      }
      // Remove user from queue by their name.
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

  const removePerson = async (name,uid) => {
    const res = await fetch(`${API_BASE}/queue?uid=${encodeURIComponent(uid)}`, { method: "DELETE" });
    if(res.ok){
      socket.emit("removedFromQueue", {name,uid});
    }
    fetchQueueData();
    
  };

  const moveDownPerson = async (name,id,uid) => {
    const res = await fetch(`${API_BASE}/queue/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name,id }),
    });
    if(res.ok){
      socket.emit("moveDownQueue", { name: name, id: id,uid: uid });
    }
    fetchQueueData();
  };

  const addPerson = async (name) => {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const id = `${name}${hour}${minutes}${seconds}=`;
    const res = await fetch(`${API_BASE}/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name,id }),
    });
    if(res.ok){
      socket.emit("joinQueue", { name: name, id: id });
    }
    fetchQueueData();
  };

  // Plus button functionality: open the modal with an empty value.
  const handleIncrement = () => {
    setNewName("");
    setModalVisible(true);
  };

  const handleConfirm = async () => {
    let finalName = newName.trim();
    if (finalName === "") {
      const now = new Date();
      const hour = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      finalName = `User${hour}${minutes}${seconds}`;
    }
    await addPerson(finalName);
    setModalVisible(false);
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
          {queueItems[0] ? queueItems[0].name : "Aaj kdki h!"}
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
                  <Text style={styles.queueId}>ID: {item.uid}</Text>
                </View>
              </View>
              <View style={styles.iconGroup}>
                {index < 3 ? (
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => markUserServed(item.uid, item.name)}
                  >
                    <Icon name="check" size={24} color="white" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => removePerson(item.name,item.uid)}>
                    <Icon name="delete" size={24} color="red" />
                  </TouchableOpacity>
                )}
                {index < 3 && (
                  <TouchableOpacity style={styles.downButton} onPress={() => moveDownPerson(item.name,item._id,item.uid)}>
                    <Icon name="arrow-downward" size={24} color="white" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Modal Overlay for adding a new name */}
        <Modal
          transparent={true}
          animationType="slide"
          visible={modalVisible}
          onRequestClose={handleCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter Name</Text>
              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter your name"
                onFocus={() => setNewName("")}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalButton} onPress={handleCancel}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleConfirm}>
                  <Text style={styles.modalButtonText}>OK</Text>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    padding: 10,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    color: "blue",
  },
});