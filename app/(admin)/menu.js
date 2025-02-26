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
  TextInput
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { PlusButtonContext } from "./_layout"; // Adjust this import path as needed

export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(null);
  const [names, setNames] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const API_BASE = "https://barber-queue.vercel.app";
  const shineAnimation = useRef(new Animated.Value(0)).current;

  // Get the setter from the context so we can register our plus button handler
  const { setPlusButtonHandler } = useContext(PlusButtonContext);

  // Register our handleIncrement as the plus button handler when this screen mounts.
  useEffect(() => {
    setPlusButtonHandler(() => handleIncrement);
    return () => setPlusButtonHandler(() => {});
  }, [setPlusButtonHandler]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shineAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shineAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shineAnimation]);

  const shineTranslateX = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 900],
  });

  const shineTranslateY = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 250],
  });

  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${API_BASE}/queue`);
      const data = await response.json();
      setQueueLength(data.queueLength);
      setNames(data.names);
    } catch (error) {
      console.error("Error fetching queue data:", error);
    }
  };

  useEffect(() => {
    fetchQueueData();
    const intervalId = setInterval(fetchQueueData, 2000);
    return () => clearInterval(intervalId);
  }, []);

  const removePerson = async (name) => {
    await fetch(`${API_BASE}/queue?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    fetchQueueData();
  };

  const moveDownPerson = async (name) => {
    await fetch(`${API_BASE}/queue/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    fetchQueueData();
  };

  const addPerson = async (name) => {
    await fetch(`${API_BASE}/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    fetchQueueData();
  };

  // Plus button functionality: open the modal with a default (empty) value.
  const handleIncrement = () => {
    setNewName("");
    setModalVisible(true);
  };

  const handleConfirm = async () => {
    let finalName = newName.trim();
    if (finalName === "") {
      const now = new Date();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      finalName =`User ${minutes}${seconds}`; 
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
        <Text style={styles.userCode}>{names[0] ? names[0] : "Aaj kdki h!"}</Text>
        <Text style={styles.queue}>👤 {queueLength}</Text>
        <Text style={styles.queueListTitle}>Queue List</Text>
        <ScrollView style={styles.namesContainer} nestedScrollEnabled={true} 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 10 }}>
          {names.map((name, index) => (
            <View key={index} style={styles.queueCard}>
              <View style={styles.nameText}>
                <Text style={styles.queueNumber}>{index + 1}.</Text>
                <Text style={styles.queueName}>{name}</Text>
              </View>
              <View style={styles.iconGroup}>
                {index < 3 ? (
                  <TouchableOpacity style={styles.doneButton} onPress={() => removePerson(name)}>
                    <Icon name="check" size={24} color="white" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => removePerson(name)}>
                    <Icon name="delete" size={24} color="red" />
                  </TouchableOpacity>
                )}
                {index < 3 && (
                  <TouchableOpacity style={styles.downButton} onPress={() => moveDownPerson(name)}>
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