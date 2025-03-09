import React, { useState, useEffect } from "react";
import {
  TouchableOpacity,
  Modal,
  Alert,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  FlatList,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { io } from "socket.io-client";
import { Rating } from "react-native-ratings"; // For star ratings
import { useFocusEffect } from "@react-navigation/native"; // Add this import
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(null);
  const [queueItems, setQueueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notified, setNotified] = useState(false);
  const [userName, setUserName] = useState(null);
  const [uid, setUid] = useState(null);
  const [socket, setSocket] = useState(null);
  const [selectedServicesForInfo, setSelectedServicesForInfo] = useState([]);
  const [totalCostForInfo, setTotalCostForInfo] = useState(0);
  const API_BASE = "https://barberqueue-24143206157.us-central1.run.app";
  const [remainingTime, setRemainingTime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [infomodalVisible, setinfomodalVisible] = useState(false);
  const initialChecklist = [
    { id: 1, text: "Haircut", price: 70, checked: false },
    { id: 2, text: "Beard Trim", price: 40, checked: false },
    { id: 3, text: "Shave", price: 30, checked: false },
    { id: 4, text: "Hair Wash", price: 300, checked: false },
    { id: 5, text: "Head Massage", price: 120, checked: false },
    { id: 6, text: "Facial", price: 150, checked: false },
    { id: 7, text: "Hair Color", price: 200, checked: false },
  ];
  
  const [checklist, setChecklist] = useState(initialChecklist);
  const [ratingModalVisible, setRatingModalVisible] = useState(false); // State for rating popup
  const [rating, setRating] = useState(0); // State for star rating
  
  const [infoModalChecklist, setInfoModalChecklist] = useState([]);
  const totalSelectedPrice = checklist
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + item.price, 0);

  useEffect(() => {
    const loadUserData = async () => {
      const storedUserName = await AsyncStorage.getItem("userName");
      const storedUid = await AsyncStorage.getItem("uid");
      setUserName(storedUserName);
      setUid(storedUid);
    };
    loadUserData();
  }, []);

  const combinedName =
    userName && uid ? `${userName.substring(0, 2)}${uid.substring(0, 4)}` : null;

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      const checkPendingRatingAndNotifications = async () => {
        try {
          // Fetch user data to check for pending rating
          const token = await AsyncStorage.getItem("userToken");
      const response = await fetch("https://barberqueue-24143206157.us-central1.run.app/profile", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
          const userData = await response.json();
           console.log("User data:", userData);
          // Check for pending rating
          if (userData.pendingRating) {
            setRatingModalVisible(true); // Show the rating modal
          }
  
          // Check for pending notifications
          if (userData.notification.enabled) {
            // Schedule a local notification
            await Notifications.scheduleNotificationAsync({
              content: {
                title: userData.notification.title,
                body: userData.notification.body,
                data: userData.notification.data,
                sound: "default",
                priority: Notifications.AndroidNotificationPriority.MAX,
              },
              trigger: null, // Immediate trigger
            });
            if(userData.notification.title === "Service Done") {
              // Save flag for rating modal
              await AsyncStorage.setItem("id", userData.notification.data.id);
               }
            // Reset the notification flag in the backend
            const token = await AsyncStorage.getItem("userToken");
            await fetch(`${API_BASE}/reset-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ uid: userData._id }),
            });
          }
        } catch (error) {
          console.error("Error checking pending rating or notifications:", error);
        }
      };
  
      checkPendingRatingAndNotifications();
    }, [])
  );
  // Register for push notifications when uid is available
  useEffect(() => {
    async function registerForPushNotifications() {
      if (!Constants.isDevice) {
        console.log("Must use a physical device for Push Notifications");
        return;
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!");
        return;
      }
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log("Expo Push Token:", token);
      // Send token to your backend
      await fetch(`${API_BASE}/register-push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, token }),
      });
    }
    if (uid) {
      registerForPushNotifications();
    }
  }, [uid]);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(API_BASE);
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  // Listen for queue updates
  useEffect(() => {
    if (socket) {
      socket.on("queueUpdated", () => {
        alert("Queue updated!");
        fetchQueueData();
      });

    
    }
  }, [socket]);

  const showLocalNotification = async (title, body, data = {}) => {
    
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title:title,
          body: body,
          data:data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null, // Immediate trigger
      });
      Alert.alert("Local Notification", "Sent a local notification");
    } catch (error) {
      console.error("Error showing notification:", error);
    }
  };

  
  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${API_BASE}/queue`);
      const data = await response.json();
      if (
        data.queueLength !== queueLength ||
        JSON.stringify(data.data) !== JSON.stringify(queueItems)
      ) {
        setQueueLength(data.queueLength);
        setQueueItems(data.data);
  
        // Check for pending notifications after queue update
        const token = await AsyncStorage.getItem("userToken");
        const userResponse = await fetch(`${API_BASE}/profile`, {
          headers: {
            Authorization: `Bearer ${await AsyncStorage.getItem("userToken")}`,
          },
        });
        const userData = await userResponse.json();
  
        if (userData.notification.enabled) {
          // Schedule a local notification
          await Notifications.scheduleNotificationAsync({
            content: {
              title: userData.notification.title,
              body: userData.notification.body,
              data: userData.notification.data,
              sound: "default",
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null, // Immediate trigger
          });
  
          // Reset the notification flag in the backend
          await fetch(`${API_BASE}/reset-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await AsyncStorage.getItem("userToken")}`,
            },
            body: JSON.stringify({ uid: userData._id }),
          });
        }
      }
    } catch (error) {
      console.error("Error fetching queue data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, []);
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const content = response.notification.request.content;
  
        if (content.title === "Service Done") {
          // Save flag for rating modal
          await AsyncStorage.setItem("shouldShowRatingModal", "true");
          if (content.data && content.data.id) {
            await AsyncStorage.setItem("id", content.data.id);
          }
          setRatingModalVisible(true); // Show the rating modal
        } else {
          // Handle other notifications
          console.log("Notification received:", content);
        }
      }
    );
  
    return () => {
      subscription.remove();
    };
  }, []);
  const index = queueItems.findIndex((item) => item.uid === uid);
  //Alert.alert("Index",`${index}`);
  const userPosition = index >= 0 ? index + 1 : null;
  const avgServiceTime = 10;
  const initialWaitTime = userPosition ? userPosition * avgServiceTime * 60 : null;

  useEffect(() => {
    let timer;
    const updateRemainingTime = async () => {
      // Get the join timestamp from AsyncStorage
      const joinTimeStr = await AsyncStorage.getItem("joinTimestamp");
      if (joinTimeStr && userPosition) {
        const joinTime = Number(joinTimeStr);
        const elapsed = Math.floor((Date.now() - joinTime) / 1000); // in seconds
        const expectedWaitTime = userPosition * avgServiceTime * 60; // in seconds
        // Calculate the new remaining time (if negative, display 0)
        setRemainingTime(expectedWaitTime - elapsed > 0 ? expectedWaitTime - elapsed : 0);
      }
    };
    if (userPosition) {
      // Update immediately on mount
      updateRemainingTime();
      // Then update every second
      timer = setInterval(updateRemainingTime, 1000);
    }
    return () => clearInterval(timer);
  }, [userPosition]);  
  const updateUserServices = async (selectedServices, totalCost) => {
    if (!selectedServices || selectedServices.length === 0) {
      Alert.alert(
        "No Service Selected",
        "Please select at least one service before proceeding."
      );
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/update-services`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid, 
          services: selectedServices,
          totalCost: totalCost, 
        }),
      });
  
      if (response.ok) {
        const data = await response.json();
       // console.log("Services updated:", data);
      } else {
        console.error("Failed to update services");
      }
    } catch (error) {
      console.error("Error updating services:", error);
    }
  };
  // When near the front, ask backend to send a push notification (for offline delivery)
  useEffect(() => {
    if (userPosition !== null && userPosition <= 3 && !notified) {
      fetch(`${API_BASE}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          title: "Almost Your Turn!",
          body: `You're number ${userPosition} in line. Please get ready for your service.`,
        }),
      }).catch((error) => console.error("Error notifying:", error));
      setNotified(true);
    } else if (userPosition === null || userPosition > 3) {
      setNotified(false);
    }
  }, [userPosition]);

  const formatTime = (seconds) => {
    if (seconds === null || seconds <= 0) return "Ready!";
    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${minutes}m ${sec}s`;
  };

  const joinQueue = async () => {
    // Get the list of selected services from your checklist
    const selectedServices = checklist
    .filter((item) => item.checked)
    .map((item) =>{ 
      return item.text;
  });
  

    // Ensure at least one service is selected
    if (selectedServices.length === 0) {
      Alert.alert(
        "No Service Selected",
        "Please select at least one service before proceeding."
      );
      return;
    }

    // Close the modal (from your modal component)
    setModalVisible(false);
   //Alert.alert("Join Queue",`${totalSelectedPrice}`);
    try {
      // Send an API request to join the queue with the selected services
      const response = await fetch(`${API_BASE}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName,
          id: uid,
          services: selectedServices,
          code: combinedName,
          totalCost: totalSelectedPrice,
        }),
      });

      if (response.ok) {
        // Optionally, parse the response data
        const data = await response.json();
        await AsyncStorage.setItem("joinTimestamp", String(Date.now()));

        // Update the queue data (this function should update your state accordingly)
        fetchQueueData();

        // Emit a socket event to notify the server that a new user has joined the queue,
        // including the selected services for further processing
        if (socket) {
          socket.emit("joinQueue", {
            id: uid,
            name: userName,
            code: combinedName,
            services: selectedServices,
            totalCost: totalSelectedPrice,
          });
        }
        setChecklist(initialChecklist.map(item => ({ ...item, checked: false }))); 
        showLocalNotification("Joined Queue", "You have successfully joined the queue.");
      } else {
        Alert.alert("Error", "Failed to join the queue.");
      }
    } catch (error) {
      console.error("Error joining queue:", error);
      Alert.alert("Error", "An error occurred while joining the queue.");
    }
  };

  const leaveQueue = async () => {
    if (!combinedName) {
      Alert.alert("Error", "User information not loaded yet.");
      return;
    }
    Alert.alert(
      "Confirm Leave",
      "Are you sure you want to leave the queue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE}/queue?uid=${encodeURIComponent(uid)}`,
                { method: "DELETE" }
              );
              if (response.ok) {
                if (socket) {
                  socket.emit("leaveQueue", { name: userName, id: uid });
                }
                fetchQueueData();
              } else {
                Alert.alert("Error", "Failed to leave the queue.");
              }
            } catch (error) {
              console.error("Error leaving queue:", error);
              Alert.alert("Error", "An error occurred while leaving the queue.");
            }
          },
        },
      ]
    );
  };
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("Notification response received:", response);
        
        const content = response.notification.request.content;
        console.log("Notification content:", content);
        
        const { title, body ,data} = content;
        console.log("Extracted title:", title);
        console.log("Extracted body:", body);
        
        if (title === "Service Done") {
          console.log("Saving flag for rating modal in AsyncStorage.");
          (async () => {
            try {
              await AsyncStorage.setItem("shouldShowRatingModal", "true");
              if (data && data.id) {
                await AsyncStorage.setItem("id", data.id);
                console.log("Barber id saved to AsyncStorage:", data.id);
              }
            } catch (error) {
              console.error("Error saving rating modal flag:", error);
            }
          })();
        } else {
          console.log("Notification title does not match expected value. No action taken.");
        }
      }
    );
  
    return () => {
      console.log("Removing notification response listener.");
      subscription.remove();
    };
  }, []);
  
  useEffect(() => {
    const checkRatingModalFlag = async () => {
      try {
        const flag = await AsyncStorage.getItem("shouldShowRatingModal");
        console.log("Rating modal flag from storage:", flag);
        if (flag === "true") {
          setRatingModalVisible(true);
          // Remove the flag once processed
          await AsyncStorage.removeItem("shouldShowRatingModal");
         
          console.log("Flag removed from AsyncStorage, rating modal visible state set to true.");
        }
      } catch (error) {
        console.error("Error checking rating modal flag:", error);
      }
    };
  
    // Check for the flag when the component mounts.
    checkRatingModalFlag();
  }, []);
  
  // Log whenever ratingModalVisible changes.
  useEffect(() => {
    console.log("Rating modal visible state changed:", ratingModalVisible);
  }, [ratingModalVisible]);
  
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }
  async function rateBarber( rating) {
    const barberId=await AsyncStorage.getItem("id");
    await AsyncStorage.removeItem("id");
    console.log("Rating barber with id:", barberId, "and rating:", rating);
    
    try {
      const response = await fetch(`${API_BASE}/barber/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        
        },
        body: JSON.stringify({ barberId, rating,uid })
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error rating barber:", errorData);
        return;
      }
  
      const data = await response.json();
      console.log("Rating submitted successfully:", data);
      // Optionally, update your UI with the average rating:
      // updateAverageRating(data.averageRating);
    } catch (error) {
      console.error("Error rating barber:", error);
    }
  }
   
  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
      <View style={styles.container}>
        <Text style={styles.userCode}>{combinedName}</Text>
        {userPosition && (
          <Text style={styles.waitTime}>
            Estimated Wait: <Text style={styles.timer}>{formatTime(remainingTime)}</Text>
          </Text>
        )}
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
    <Text style={styles.queueNumber}>{index + 1}.</Text>
    <View>
      <Text style={styles.queueName}>{item.name}</Text>
      <Text style={styles.queueId}>ID: {item.code}</Text>
    </View>
  
    {item.uid === uid && <Text style={styles.cost}>₹{item.totalCost}</Text>}
    {item.uid === uid && (
      <TouchableOpacity
        onPress={() => {
          // Initialize the checklist with the user's selected services
          const updatedChecklist = checklist.map((service) => ({
            ...service,
            checked: item.services.includes(service.text),
          }));
          setInfoModalChecklist(updatedChecklist);
          setTotalCostForInfo(item.totalCost);
          setinfomodalVisible(true);
        }}
      >
        <Icon name="info-circle" size={16} color="black" />
      </TouchableOpacity>
    )}
  </View>
))}
        </ScrollView>

        <View style={styles.buttonContainer}>
          {combinedName && queueItems.some((item) => item.uid === uid) ? (
            <TouchableOpacity style={styles.leaveButton} onPress={leaveQueue}>
              <Icon name="sign-out" size={24} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.joinButton} onPress={() => { setChecklist(initialChecklist.map(item => ({ ...item, checked: false }))); setModalVisible(true)}}>
              <Svg
                xmlns="http://www.w3.org/2000/svg"
                width="25"
                height="25"
                viewBox="0 0 16 16"
                fill="white"
              >
                <Path
                  fillRule="evenodd"
                  d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"
                />
              </Svg>
            </TouchableOpacity>
          )}
        </View>
        <Modal visible={infomodalVisible} animationType="slide" transparent>
  <View style={styles.modalContainer}>
    <View style={styles.modalContent}>
      <TouchableOpacity
        onPress={() => setinfomodalVisible(false)}
        style={styles.closeButton}
      >
        <Icon name="times-circle" size={20} color="black" />
      </TouchableOpacity>
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
              <Text style={styles.checklistPrice}>
                <Text style={{ color: 'green' }}>₹</Text>
                {item.price}
              </Text>
              <Icon
                name={item.checked ? "check-square" : "square-o"}
                size={24}
                color="green"
              />
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id.toString()}
      />
      <Text style={styles.totalPrice}>
        Total Price: ₹{infoModalChecklist
          .filter((item) => item.checked)
          .reduce((sum, item) => sum + (item.price), 0)}
      </Text>
      <TouchableOpacity
        style={styles.confirmButton}
        onPress={() => {
          const selectedServices = infoModalChecklist
            .filter((item) => item.checked)
            .map((item) => item.text);
          const totalCost = infoModalChecklist
            .filter((item) => item.checked)
            .reduce((sum, item) => sum + (item.price), 0);

          // Alert the new selected services
        

          // Update the backend with the new selected services
          updateUserServices(selectedServices, totalCost);
          setinfomodalVisible(false);
        }}
      >
        <Text style={styles.buttonText}>Confirm</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
        <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => {
    setChecklist(initialChecklist.map(item => ({ ...item, checked: false }))); // Reset checklist
    setModalVisible(false);
  }}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              {/* Cross Button in Upper Right Corner */}
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Icon name="times-circle" size={20} color="black" />
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Checklist Before Joining</Text>
              
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
                      <Text style={styles.checklistPrice}><Text style={{color: 'green'}}>₹</Text>{item.price}</Text>
                      <Icon
                        name={item.checked ? "check-square" : "square-o"}
                        size={24}
                        color="green"
                      />
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
              />
              <Text style={styles.totalPrice}>Total Price: ₹{totalSelectedPrice}</Text>
              
              <TouchableOpacity style={styles.confirmButton} onPress={joinQueue}>
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
      {/* Render the rating modal */}
      <Modal
  visible={ratingModalVisible}
  transparent
  animationType="slide"
  onRequestClose={() => {
    // Prevent the modal from closing automatically.
    console.log("onRequestClose triggered: Ignoring hardware back button.");
  }}
  onShow={() => console.log("Rating modal is now visible.")}
>
  <View style={styles.ratingModalContainer}>
    <View style={styles.ratingModalContent}>
      <Text style={styles.ratingModalTitle}>Rate Your Barber</Text>
      <Rating
        type="star"
        ratingCount={5}
        imageSize={40}
        onFinishRating={(value) => {
          console.log("User selected rating:", value);
          setRating(value);
        }}
      />
      <TouchableOpacity
        style={styles.ratingSubmitButton}
        onPress={() => {
          console.log("Rating submitted:", rating);
           rateBarber(rating);
          setRatingModalVisible(false);
        }}
      >
        <Text style={styles.ratingSubmitButtonText}>Submit</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.ratingCloseButton}
        onPress={() => {
          console.log("Rating modal closed without submitting.");
          setRatingModalVisible(false);
        }}
      >
        <Text style={styles.ratingCloseButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>



    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  ratingModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  ratingModalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
  },
  ratingModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  ratingSubmitButton: {
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 10,
    marginTop: 20,
    width: "100%",
    alignItems: "center",
  },
  ratingSubmitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  ratingCloseButton: {
    marginTop: 10,
    padding: 10,
  },
  ratingCloseButtonText: {
    color: "#007bff",
    fontSize: 16,
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10, // Ensures it stays on top
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
  waitTime: {
    fontSize: 16,
    fontWeight: "bold",
    color: "black",
  },
  timer: {
    color: "red",
    fontWeight: "bold",
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
  queueService: {
    fontSize: 14,
    color: "#555",
    position: "absolute",
    right: "8%",
  },
  queueNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  cost: {
    fontSize: 18,
    fontWeight: "bold",
   color: "rgb(16, 98, 13)",
    marginLeft: "auto",
  },
  queueName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#777",
  },
  queueId: {
    fontSize: 10,
    color: "#555",
  },
  joinButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgb(48, 139, 36)",
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
    bottom: 20,
    right: 25,
    flexDirection: "row",
    gap: 10,
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
  confirmButton: {
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    alignItems: "center",
    width: "100%",
    elevation: 5,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginTop: 10,
  },
});
