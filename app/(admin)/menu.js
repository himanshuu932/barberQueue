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
  Dimensions,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { PlusButtonContext } from "./_layout";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";
import { useFocusEffect } from "@react-navigation/native";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const API_BASE = "https://numbr-exq6.onrender.com";

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

  // --- NEW: State variables for loading indicators ---
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isUpdatingServices, setIsUpdatingServices] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null); // Stores ID of item being acted on

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
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error! status: ${response.status}, response:`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Received non-JSON response. Content-Type:", contentType, "Response:", text);
        throw new TypeError("Expected JSON response");
      }
      const data = await response.json();
      if (data.success) {
        setQueueLength(data.count);
        setQueueItems(data.data);
      } else {
        console.error("API returned unsuccessful response:", data);
        Alert.alert("Error", "Failed to load queue data. Please try again.");
      }
    } catch (error) {
      console.error("Error in fetchQueueData:", { error: error.message, stack: error.stack, name: error.name });
      Alert.alert("Error", "Failed to load queue data. Please try again.");
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchQueueData();
    }, [shopId])
  );

    // --- CORRECTED FUNCTION ---
    const updateUserServices = async (servicesPayload) => {
        setIsUpdatingServices(true);
        try {
            const token = await AsyncStorage.getItem("userToken");
            if (!token) {
                Alert.alert("Authentication Error", "User not authenticated.");
                return;
            }

            // CORRECTED: The route now points to the specific /services endpoint
            const response = await fetch(`${API_BASE}/api/queue/${editingUid}/services`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                // CORRECTED: The body now sends the payload in the format the backend expects
                body: JSON.stringify({ services: servicesPayload }),
            });

            if (response.ok) {
                await fetchQueueData();
                Alert.alert("Success", "Services updated successfully.");
            } else {
                const errorData = await response.json();
                Alert.alert("Error", errorData.message || "Failed to update services.");
            }
        } catch (error) {
            console.error("Error updating services:", error);
            Alert.alert("Error", "Failed to update services.");
        } finally {
            setIsUpdatingServices(false);
        }
    };


  const markUserServed = async (queueId) => {
    setActionInProgress(queueId);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const barberId = await AsyncStorage.getItem("uid");
      if (!token || !barberId) {
        console.error("Missing token or barber ID");
        Alert.alert("Error", "Authentication required. Please re-login.");
        return;
      }
      const payload = { status: "completed", barberId: barberId };
      const response = await fetch(`${API_BASE}/api/queue/${queueId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("Failed to mark as served. Response:", data);
        Alert.alert("Error", data.message || "Failed to mark as served");
        return;
      }
      Alert.alert("Success", "Customer marked as served");
      fetchQueueData();
    } catch (error) {
      console.error("Error in markUserServed:", error);
      Alert.alert("Error", error.message || "Failed to mark as served");
    } finally {
      setActionInProgress(null);
    }
  };

  const removePerson = async (queueId) => {
    if (!shopId) return;
    setActionInProgress(queueId);
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Authentication Error", "User not authenticated.");
        return;
      }
      const response = await fetch(`${API_BASE}/api/queue/${queueId}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const queueEntry = await response.json();
        if (queueEntry.data && queueEntry.data.userId) {
          await fetch(`${API_BASE}/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: queueEntry.data.userId, title: "Removed from queue", body: `You have been removed from the queue.` }),
          });
        }
       await fetchQueueData();
      } else {
        const errorText = await response.text();
        console.error("Remove person failed:", errorText);
        Alert.alert("Error", "Failed to remove person from queue.");
      }
    } catch (error) {
      console.error("Error removing person:", error);
      Alert.alert("Error", "Failed to remove person from queue.");
    } finally {
      setActionInProgress(null);
    }
  };

  const moveDownPerson = async (queueId) => {
    if (!shopId) return;
    setActionInProgress(queueId);
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Authentication Error", "User not authenticated.");
        return;
      }
      const response = await fetch(`${API_BASE}/api/queue/${queueId}/move-down`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchQueueData();
      } else {
        const errorText = await response.text();
        console.error("Move down failed:", errorText);
        Alert.alert("Error", "Failed to move user down in queue.");
      }
    } catch (error) {
      console.error("Error moving user down:", error);
      Alert.alert("Error", "Failed to move user down in queue.");
    } finally {
      setActionInProgress(null);
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
      finalName = `User${now.getHours().toString().padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now.getSeconds().toString().padStart(2, "0")}`;
    }
    const selectedServices = checklist.filter((item) => item.checked).map((item) => ({ service: item._id, quantity: 1 }));
    if (selectedServices.length === 0) {
      Alert.alert("No Service Selected", "Please select at least one service before proceeding.");
      return;
    }
    setIsAddingUser(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_BASE}/api/queue/walkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shopId, customerName: finalName, customerPhone: "0000000000", services: selectedServices }),
      });
      if (response.ok) {
        await fetchQueueData();
        setModalVisible(false);
      } else {
        const errorText = await response.text();
        console.error("Join queue failed:", errorText);
        Alert.alert("Error", "Failed to add walk-in customer to queue.");
      }
    } catch (error) {
      console.error("Error adding walk-in customer:", error);
      Alert.alert("Error", "An error occurred while adding walk-in customer.");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleIncrement = () => {
    setNewName("");
    setChecklist((prev) => prev.map((item) => ({ ...item, checked: false })));
    setModalVisible(true);
  };

  const handleCancel = () => {
    if (isAddingUser) return;
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
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage} resizeMode="cover">
      <View style={styles.overlay} />
      <View style={styles.container}>
        <Text style={styles.userCode}>
          {queueItems[0] ? queueItems[0].uniqueCode : "No queue"}
        </Text>
        <Text style={styles.queue}>👤 {queueLength}</Text>
        <Text style={styles.queueListTitle}>Queue List</Text>
        <ScrollView style={styles.namesContainer} nestedScrollEnabled={true} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: screenHeight * 0.02 }}>
          {queueItems.map((item, index) => (
            <TouchableOpacity
              key={item._id}
              style={styles.queueCard}
              onLongPress={() => {
                setLongPressIndex(index);
                setTimeout(() => setLongPressIndex(null), 3000);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.leftSection}>
                <Text style={styles.queueNumber}>{item.orderOrQueueNumber}.</Text>
                <View style={styles.detailsContainer}>
                  <Text style={styles.queueName}>{item.customerName || (item.userId && item.userId.name) || 'Guest'}</Text>
                  <Text style={styles.queueId}>Code: {item.uniqueCode}</Text>
                  <View style={styles.serviceRow}>
                    <TouchableOpacity onPress={() => Alert.alert("Services", item.services && item.services.length > 0 ? item.services.map(s => s.name).join(", ") : "No services")}>
                      <Text style={styles.servicesText}>View Services</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.infoButton}
                      onPress={() => {
                        setEditingUid(item._id);
                        const updatedChecklist = checklist.map(service => ({ ...service, checked: item.services.some(s => s.name === service.text) }));
                        setInfoModalChecklist(updatedChecklist);
                        setInfoModalVisible(true);
                      }}
                    >
                      <Icon name="info" size={screenWidth * 0.05} color="black" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={styles.iconGroup}>
                {actionInProgress === item._id ? (
                  <ActivityIndicator size="small" color="#0000ff" style={{ paddingHorizontal: screenWidth * 0.1 }} />
                ) : (
                  <>
                    {index < 3 ? (
                      <TouchableOpacity style={styles.doneButton} onPress={() => markUserServed(item._id)}>
                        <Icon name="check" size={screenWidth * 0.06} color="white" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => removePerson(item._id)}>
                        <Icon name="delete" size={screenWidth * 0.06} color="red" />
                      </TouchableOpacity>
                    )}
                    {index < 3 && (
                      <TouchableOpacity style={styles.downButton} onPress={() => longPressIndex === index ? removePerson(item._id) : moveDownPerson(item._id)}>
                        <Icon name={longPressIndex === index ? "delete" : "arrow-downward"} size={screenWidth * 0.06} color={longPressIndex === index ? "red" : "white"} />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Modal transparent={true} animationType="slide" visible={modalVisible} onRequestClose={handleCancel}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter Name & Select Services</Text>
              <TextInput style={styles.modalInput} value={newName} onChangeText={setNewName} placeholder="Enter your name" onFocus={() => setNewName("")} editable={!isAddingUser} />
              <FlatList
                data={checklist}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.checklistItem} onPress={() => setChecklist((prev) => prev.map((i) => i.id === item.id ? { ...i, checked: !i.checked } : i))} disabled={isAddingUser}>
                    <View style={styles.checklistRow}>
                      <Text style={styles.checklistText}>{item.text}</Text>
                      <Text style={styles.checklistPrice}>₹{item.price}</Text>
                      <Icon name={item.checked ? "check-box" : "check-box-outline-blank"} size={screenWidth * 0.06} color="green" />
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
                style={{ maxHeight: screenHeight * 0.4 }}
              />
              <Text style={styles.totalPrice}>Total Price: ₹{totalSelectedPrice}</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton, isAddingUser && styles.disabledButton]} onPress={handleCancel} disabled={isAddingUser}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.confirmButton, isAddingUser && styles.disabledButton]} onPress={joinQueue} disabled={isAddingUser}>
                  {isAddingUser ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Confirm</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={infoModalVisible} animationType="slide" transparent onRequestClose={() => isUpdatingServices ? null : setInfoModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Selected Services</Text>
              <FlatList
                data={infoModalChecklist}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.checklistItem} onPress={() => setInfoModalChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)))} disabled={isUpdatingServices}>
                    <View style={styles.checklistRow}>
                      <Text style={styles.checklistText}>{item.text}</Text>
                      <Text style={styles.checklistPrice}>₹{item.price}</Text>
                      <Icon name={item.checked ? "check-box" : "check-box-outline-blank"} size={screenWidth * 0.06} color="green" />
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
                style={{ maxHeight: screenHeight * 0.4 }}
              />
              <Text style={styles.totalPrice}>Total Price: ₹{infoModalChecklist.filter((item) => item.checked).reduce((sum, item) => sum + item.price, 0)}</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton, isUpdatingServices && styles.disabledButton]} onPress={() => setInfoModalVisible(false)} disabled={isUpdatingServices}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                {/* --- CORRECTED OnPress Handler --- */}
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton, isUpdatingServices && styles.disabledButton]}
                  disabled={isUpdatingServices}
                  onPress={async () => {
                    const checkedServices = infoModalChecklist.filter((item) => item.checked);

                    const servicesForUpdate = checkedServices.map(item => ({
                        service: item._id, // Use the service's unique ID
                        quantity: 1
                    }));

                    await updateUserServices(servicesForUpdate);
                    setInfoModalVisible(false);
                  }}
                >
                  {isUpdatingServices ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Confirm</Text>}
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
  // --- All original styles remain the same ---
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(237, 236, 236, 0.77)",
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? screenHeight * 0.06 : screenHeight * 0.04,
    paddingHorizontal: screenWidth * 0.04,
  },
  userCode: {
    fontSize: screenWidth * 0.18,
    fontWeight: "bold",
    textAlign: "center",
    color: "black",
    marginTop: screenHeight * 0.01,
  },
  queue: {
    position: "absolute",
    top: screenHeight * 0.02,
    right: screenWidth * 0.03,
    fontSize: screenWidth * 0.045,
    fontWeight: "bold",
    color: "black",
  },
  queueListTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: "bold",
    marginTop: screenHeight * 0.02,
    marginBottom: screenHeight * 0.01,
    color: "black",
    alignSelf: 'center',
  },
  namesContainer: {
    backgroundColor: "#fff",
    borderRadius: screenWidth * 0.04,
    width: "100%",
    padding: screenWidth * 0.04,
    maxHeight: screenHeight * 0.54,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: screenHeight * 0.005 },
    shadowOpacity: 0.2,
    shadowRadius: screenWidth * 0.015,
  },
  queueCard: {
    backgroundColor: "#F9F9F9",
    borderRadius: screenWidth * 0.03,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.015,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: screenHeight * 0.002 },
    shadowOpacity: 0.1,
    shadowRadius: screenWidth * 0.008,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  detailsContainer: {
    flex: 1,
    marginLeft: screenWidth * 0.03,
  },
  queueNumber: {
    fontSize: screenWidth * 0.06,
    fontWeight: "bold",
    color: "#333",
  },
  queueName: {
    fontSize: screenWidth * 0.045,
    color: "#555",
    marginBottom: screenHeight * 0.005,
  },
  queueId: {
    fontSize: screenWidth * 0.03,
    color: "#777",
    marginBottom: screenHeight * 0.005,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  servicesText: {
    fontSize: screenWidth * 0.035,
    color: "blue",
  },
  infoButton: {
    marginLeft: screenWidth * 0.03,
  },
  iconGroup: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: screenWidth * 0.22, // Ensure consistent width
    justifyContent: 'flex-end'
  },
  doneButton: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    borderRadius: screenWidth * 0.03,
    backgroundColor: "rgb(48, 139, 36)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: screenWidth * 0.02,
    elevation: 3,
  },
  downButton: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    borderRadius: screenWidth * 0.03,
    backgroundColor: "rgb(7, 55, 229)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: screenWidth * 0.02,
    elevation: 3,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    backgroundColor: "white",
    width: screenWidth * 0.85,
    borderRadius: screenWidth * 0.04,
    padding: screenWidth * 0.05,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: screenHeight * 0.005 },
    shadowOpacity: 0.25,
    shadowRadius: screenWidth * 0.015,
  },
  modalTitle: {
    fontSize: screenWidth * 0.05,
    fontWeight: "bold",
    marginBottom: screenHeight * 0.02,
    textAlign: "center",
    color: '#333',
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: screenWidth * 0.02,
    padding: screenWidth * 0.03,
    marginBottom: screenHeight * 0.02,
    fontSize: screenWidth * 0.04,
  },
  checklistItem: {
    padding: screenWidth * 0.03,
    backgroundColor: "#f8f9fa",
    borderRadius: screenWidth * 0.02,
    marginVertical: screenHeight * 0.005,
    width: "100%",
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checklistText: {
    fontSize: screenWidth * 0.04,
    fontWeight: "500",
    color: "#333",
    flex: 1,
  },
  checklistPrice: {
    fontSize: screenWidth * 0.04,
    fontWeight: "bold",
    color: "#555",
    marginRight: screenWidth * 0.05,
  },
  totalPrice: {
    fontSize: screenWidth * 0.045,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginVertical: screenHeight * 0.015,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    padding: screenHeight * 0.015,
    borderRadius: screenWidth * 0.02,
    alignItems: "center",
    marginHorizontal: screenWidth * 0.01,
  },
  cancelButton: {
    backgroundColor: "#dc3545",
  },
  confirmButton: {
    backgroundColor: "#28a745",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: screenWidth * 0.04,
    fontWeight: "bold",
  },
  // --- NEW STYLE ---
  disabledButton: {
    opacity: 0.6,
  },
});