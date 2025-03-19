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
  TextInput,
  Platform,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { io } from "socket.io-client";
import { Rating } from "react-native-ratings";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
const { width, height } = Dimensions.get("window");
export default function MenuScreen() {
  const navigation = useNavigation();
  const [queueLength, setQueueLength] = useState(null);
  const [queueItems, setQueueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notified, setNotified] = useState(false);
  const [userName, setUserName] = useState(null);
  const [uid, setUid] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false); // Checklist modal before joining
  const [infomodalVisible, setinfomodalVisible] = useState(false); // Infomodal for editing services
  const [chooseShopModalVisible, setChooseShopModalVisible] = useState(false); // Choose Shop modal
  const API_BASE = "https://barberqueue-24143206157.us-central1.run.app";
  const [defaultChecklist, setDefaultChecklist] = useState([]);
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
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [infoModalChecklist, setInfoModalChecklist] = useState([]);
  const [totalCostForInfo, setTotalCostForInfo] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  useEffect(() => {
    if (!modalVisible) {
      setIsConfirming(false);
    }
  }, [modalVisible]);
  const joinQueueHandler = async () => {
    if (isConfirming) return; // prevent duplicate clicks

    setIsConfirming(true);
    try {
      // Assume joinQueue returns a promise.
      await joinQueue();
      // Optionally, you might want to close the modal here:
      // setModalVisible(false);
    } catch (error) {
      console.error(error);
    }
    // Reset after the join process is done so the button can be clicked next time
    setIsConfirming(false);
  };
  const totalSelectedPrice = checklist
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + item.price, 0);
  const [shopName, setShopName] = useState("");
  const combinedName =
    userName && uid ? `${userName.substring(0, 2)}${uid.substring(0, 4)}` : null;
    useEffect(() => { 
      if(shopId) 
        {getShopName(shopId).then(name => setShopName(name));

         } }, [shopId]);
  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      const ps = await AsyncStorage.getItem("pinnedShop");
      if(!ps)
        setChooseShopModalVisible(true);
      setShopId(ps);
      const storedUserName = await AsyncStorage.getItem("userName");
      const storedUid = await AsyncStorage.getItem("uid");
      setUserName(storedUserName);
      setUid(storedUid);
    };
    loadUserData();
  }, []);

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  // Refresh queue data and pending rating when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchQueueData();
      checkPendingRatingAndNotifications();
    }, [])
  );
  const fetchRateList = async () => {
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
        price: item.price,
        checked: false,
      }));
      setDefaultChecklist(fetchedChecklist);
      setChecklist(fetchedChecklist);
    } catch (error) {
      console.error("Error fetching rate list:", error);
    }
  };
  // refreshShop: Called after choosing a shop; it reads the shop ID, hides the shop modal, and refreshes data.
  const refreshShop = async () => {
    const storedShopId = await AsyncStorage.getItem("pinnedShop");
    setShopId(storedShopId);
    setChooseShopModalVisible(false);
    await fetchQueueData();
  };

  const checkPendingRatingAndNotifications = async () => {
    try {
      const storedUid = await AsyncStorage.getItem("uid");
      //console.log("Checking pending rating/notifications for UID:", storedUid);
      const response = await fetch(`${API_BASE}/profile?uid=${storedUid}`, {
        method: "GET",
      });
      const userData = await response.json();
      if (userData.pendingRating && userData.pendingRating.status) {
        setRatingModalVisible(true);
      }
    } catch (error) {
      console.error("Error checking pending rating/notifications:", error);
    }
  };

  useEffect(() => {
    async function registerForPushNotifications() {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        //console.log("Failed to get push token for notifications!");
        return;
      }
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      //console.log("Expo Push Token:", token);
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

  useEffect(() => {
    const newSocket = io(API_BASE);
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on("queueUpdated", () => {
        checkPendingRatingAndNotifications();
        fetchQueueData();
      });
    }
  }, [socket]);

  // Each function fetches the pinned shop ID from storage separately
  const fetchQueueData = async () => {
    try {
      const storedShopId = await AsyncStorage.getItem("pinnedShop");
      if (!storedShopId) {
        //console.log("Shop ID not loaded yet");
        return;
      }
      const response = await fetch(`${API_BASE}/queue?shopId=${storedShopId}`);
      const data = await response.json();
      if (
        data.queueLength !== queueLength ||
        JSON.stringify(data.data) !== JSON.stringify(queueItems)
      ) {
        setQueueLength(data.queueLength);
        setQueueItems(data.data);

        const storedUid = await AsyncStorage.getItem("uid");
        //console.log("Checking pending rating/notifications for UID:", storedUid);
        const userResponse = await fetch(`${API_BASE}/profile?uid=${storedUid}`, {
          method: "GET",
        });
        const userData = await userResponse.json();
        //console.log("User data:", userData.notification);
        if (userData.notification && userData.notification.enabled) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: userData.notification.title,
              body: userData.notification.body,
              data: userData.notification.data,
              sound: "default",
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null,
          });
          await fetch(`${API_BASE}/reset-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
  const index = queueItems.findIndex((item) => item.uid === uid);
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
      Alert.alert("No Service Selected", "Please select at least one service before proceeding.");
      return;
    }
    try {
      const storedShopId = await AsyncStorage.getItem("pinnedShop");
      const response = await fetch(`${API_BASE}/update-services`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: storedShopId,
          uid,
          services: selectedServices,
          totalCost: totalCost,
        }),
      });
      if (response.ok) {
        fetchQueueData();
      } else {
        console.error("Failed to update services");
      }
    } catch (error) {
      console.error("Error updating services:", error);
    }
  };
  useEffect(() => {
    if (shopId) {
      fetchRateList();
    }
  }, [shopId]);
  const joinQueue = async () => {
   await fetchRateList()
    const selectedServices = checklist
      .filter((item) => item.checked)
      .map((item) => item.text);
    if (selectedServices.length === 0) {
      Alert.alert("No Service Selected", "Please select at least one service before proceeding.");
      return;
    }
    setModalVisible(false);
    try {
      const storedShopId = await AsyncStorage.getItem("pinnedShop");
      const response = await fetch(`${API_BASE}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: storedShopId,
          name: userName,
          id: uid,
          services: selectedServices,
          code: combinedName,
          totalCost: totalSelectedPrice,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem("joinTimestamp", String(Date.now()));
        fetchQueueData();
        if (socket) {
          const currentShopId = await AsyncStorage.getItem("pinnedShop");
          socket.emit("joinQueue", {
            shopId: currentShopId,
            id: uid,
            name: userName,
            code: combinedName,
            services: selectedServices,
            totalCost: totalSelectedPrice,
          });
        }
        setChecklist(defaultChecklist.map((item) => ({ ...item, checked: false })));

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
              const storedShopId = await AsyncStorage.getItem("pinnedShop");
              const response = await fetch(
                `${API_BASE}/queue?shopId=${storedShopId}&uid=${encodeURIComponent(uid)}`,
                { method: "DELETE" }
              );
              if (response.ok) {
                if (socket) {
                  const currentShopId = await AsyncStorage.getItem("pinnedShop");
                  socket.emit("leaveQueue", { shopId: currentShopId, name: userName, id: uid });
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
    if (queueItems.length > 0) {
      const index = queueItems.findIndex((item) => item.uid === uid);
      const userPosition = index >= 0 ? index + 1 : null;
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
    }
  }, [queueItems]);

  const formatTime = (seconds) => {
    if (seconds === null || seconds <= 0) return "Ready!";
    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${minutes}m ${sec}s`;
  };

  async function resetRatingModalFlag() {
    try {
      const resetResponse = await fetch(`${API_BASE}/reset-pendingRating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await AsyncStorage.getItem("userToken")}`,
        },
        body: JSON.stringify({ uid }),
      });
      if (!resetResponse.ok) {
        const errorData = await resetResponse.json();
        console.error("Error resetting pending rating:", errorData);
        return;
      }
    } catch (error) {
      console.error("Error resetting pending rating:", error);
    }
  }

  async function rateBarber(rating) {
    await AsyncStorage.removeItem("id");
    if (!rating) rating = 5;
    try {
      const storedShopId = await AsyncStorage.getItem("pinnedShop");
      const ratingResponse = await fetch(`${API_BASE}/barber/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shopId: storedShopId, rating, uid }),
      });
      if (!ratingResponse.ok) {
        const errorData = await ratingResponse.json();
        console.error("Error rating barber:", errorData);
        return;
      }
      resetRatingModalFlag();
      const data = await ratingResponse.json();
      //console.log("Rating submitted successfully:", data);
      setRatingModalVisible(false);
    } catch (error) {
      console.error("Error rating barber:", error);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }
async function getShopName(uid) {
  try {
    const response = await fetch(`https://barberqueue-24143206157.us-central1.run.app/shop/profile?id=${uid}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data.name;
    //setProfile(data);
  } catch (error) {
    console.error("Error fetching profile:", error);
  } 
}
  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
      <View style={styles.container}>
      {shopId && (
          <Text style={styles.shopName}>
            {shopName}
          </Text>
        )}
        <Text style={styles.userCode}>{combinedName}</Text>
        {/* Display chosen shop info if available */}
       
        {/* Button to choose shop */}
    
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
  
        <View style={styles.absoluteButtons}>
          {combinedName && queueItems.some((item) => item.uid === uid) ? (
            <TouchableOpacity style={styles.leaveButton} onPress={leaveQueue}>
              <Icon name="sign-out" size={24} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={() => {
                setChecklist(defaultChecklist.map((item) => ({ ...item, checked: false })));
                setModalVisible(true);
              }}
            >
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
  
        {/* Infomodal for editing selected services using dedicated styles */}
        <Modal visible={infomodalVisible} animationType="slide" transparent>
          <View style={styles.infoModalContainer}>
            <View style={styles.infoModalContent}>
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
                        <Text style={{ color: "green" }}>₹</Text>
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
                Total Price: ₹
                {infoModalChecklist
                  .filter((item) => item.checked)
                  .reduce((sum, item) => sum + item.price, 0)}
              </Text>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => {
                  const selectedServices = infoModalChecklist
                    .filter((item) => item.checked)
                    .map((item) => item.text);
                  const totalCost = infoModalChecklist
                    .filter((item) => item.checked)
                    .reduce((sum, item) => sum + item.price, 0);
                  updateUserServices(selectedServices, totalCost);
                  setinfomodalVisible(false);
                }}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
  
        {/* Modal for checklist before joining */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setChecklist(defaultChecklist.map((item) => ({ ...item, checked: false })));
            setModalVisible(false);
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
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
                      <Text style={styles.checklistPrice}>
                        <Text style={{ color: "green" }}>₹</Text>
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
              <Text style={styles.totalPrice}>Total Price: ₹{totalSelectedPrice}</Text>
              <TouchableOpacity
                style={[styles.confirmButton, isConfirming && styles.disabledButton]}
                onPress={joinQueueHandler}
                disabled={isConfirming}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
  
      {/* Modal for choosing shop */}
{/* Modal for choosing shop */}
<Modal
  visible={chooseShopModalVisible}
  animationType="slide"
  transparent
  onRequestClose={() => setChooseShopModalVisible(false)}
>
  <View style={shopListStyles.modalContainer}>
    <View style={shopListStyles.modalContent}>
      <ShopList 
        onSelect={refreshShop} 
        onClose={() => setChooseShopModalVisible(false)} 
      />
    </View>
  </View>
</Modal>

  
      {/* Rating Modal */}
      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
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
                //console.log("User selected rating:", value);
                setRating(value);
              }}
            />
            <TouchableOpacity
              style={styles.ratingSubmitButton}
              onPress={() => {
                //console.log("Rating submitted:", rating);
                rateBarber(rating);
                setRatingModalVisible(false);
              }}
            >
              <Text style={styles.ratingSubmitButtonText}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ratingCloseButton}
              onPress={() => {
                //console.log("Rating modal closed without submitting.");
                resetRatingModalFlag();
                setRatingModalVisible(false);
              }}
            >
              <Text style={styles.ratingCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
  
      {/* Button to open Choose Shop modal */}
      <TouchableOpacity
  style={styles.chooseShopButton}
  onPress={() => setChooseShopModalVisible(true)}
>
  <FontAwesome5 name="store" solid size={20.5} color="#fff"  />
  
</TouchableOpacity>
    </ImageBackground>
  );
}
  
// Inline ShopList component (similar to your AllShops component)
// It accepts an onSelect prop that is called after a shop is chosen.
const ShopList = ({ onSelect, onClose }) => {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      const response = await fetch(
        "https://barberqueue-24143206157.us-central1.run.app/shop/shops"
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      setShops(data);
    } catch (err) {
      setError(err.message || "Error fetching shops");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShop = async (shopId) => {
    try {
      await AsyncStorage.setItem("pinnedShop", shopId);
      if (onSelect) {
        onSelect();
      }
    } catch (error) {
      console.error("Error saving pinned shop:", error);
    }
  };

  const filteredShops = shops.filter((shop) =>
    shop.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function fetchBarbersAndCalculateAverage(shopId) {
    try {
      const response = await fetch(
        `https://barberqueue-24143206157.us-central1.run.app/barbers?shopId=${shopId}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const barbers = await response.json();

      let overallSum = 0;
      barbers.forEach((barber) => {
        let avgRating = 0;
        if (barber.totalRatings > 0) {
          avgRating = barber.totalStarsEarned / barber.totalRatings;
        } else if (barber.ratings && barber.ratings.length > 0) {
          const total = barber.ratings.reduce((sum, rating) => sum + rating, 0);
          avgRating = total / barber.ratings.length;
        }
        overallSum += avgRating;
      });
      const overallAverage = barbers.length > 0 ? overallSum / barbers.length : 0;
      return { overallAverage };
    } catch (error) {
      console.error("Error fetching barbers and calculating average:", error);
      return { overallAverage: 0 };
    }
  }

  // Inner component for each shop item.
  const ShopItem = ({ item }) => {
    const [averageRating, setAverageRating] = useState(null);

    useEffect(() => {
      async function getAverageRating() {
        const { overallAverage } = await fetchBarbersAndCalculateAverage(item._id);
        setAverageRating(overallAverage);
      }
      getAverageRating();
    }, [item._id]);

    return (
      <TouchableOpacity
        style={shopListStyles.shopContainer}
        onPress={() => handleSelectShop(item._id)}
      >
        <View style={shopListStyles.itemHeader}>
          <Text style={shopListStyles.shopName}>{item.name}</Text>
          <Text style={shopListStyles.shopName}>{item.address.x}</Text>
        </View>
        {item.address && (
          <View style={shopListStyles.addressContainer}>
            <Text style={shopListStyles.addressText}>
              {`Address: ${item.address.textData}`}
            </Text>
          </View>
        )}
        {averageRating !== null && (
          <View style={shopListStyles.ratingContainer}>
            <Text style={shopListStyles.ratingText}>
              Rating : {averageRating.toFixed(1)}
            </Text>
            <Icon
              name="star"
              size={16}
              color="#FFD700"
              style={shopListStyles.starIcon}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderShop = ({ item }) => <ShopItem item={item} />;

  const renderHeader = () => (
    <View style={shopListStyles.headerContainer}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={shopListStyles.heading}>Choose Shop</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={20} color="black" />
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        style={shopListStyles.searchInput}
        placeholder="Search shops..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={shopListStyles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={shopListStyles.centered}>
        <Text>Error: {error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredShops}
      keyExtractor={(item) => item._id}
      renderItem={renderShop}
      ListHeaderComponent={renderHeader}
      stickyHeaderIndices={[0]}
      contentContainerStyle={shopListStyles.listContainer}
    />
  );
};

const shopListStyles = StyleSheet.create({
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  listContainer: {
    paddingBottom: 16,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContainer: {
    backgroundColor: "#fff",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginBottom: 8,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    // marginBottom: 8,
    color: "#333",
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    marginVertical: 10,
  },
  shopContainer: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  shopName: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
    color: "#333",
  },
  addressContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  addressText: {
    flexBasis: "100%",
    color: "#555",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginRight: 4,
  },
  starIcon: {
    marginTop: 2, // Adjust this value if needed to align vertically
  },
});  
  
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
    zIndex: 10,
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
  absoluteButtons: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    pointerEvents: "box-none",
  },
  // Join button is positioned at the bottom-right
  joinButton: {
    position: "absolute",
    bottom: height * 0.03, // 2% from bottom of the screen
    right: width * 0.06,   // 3% from right edge
    width: width * 0.13,   // roughly 13% of screen width
    height: width * 0.13,
    borderRadius: (width * 0.13) / 4,
    backgroundColor: "rgb(48, 139, 36)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  // Leave button is positioned at the top-left
  leaveButton: {
    position: "absolute",
    top: height * 0.17,    // 2% from top
    left: width * 0.83,    // 3% from left
    width: width * 0.13,
    height: width * 0.13,
    borderRadius: (width * 0.13) / 4,
    backgroundColor: "rgb(212, 53, 53)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  shopName: {
    position: "absolute",
    top: 5,
    left: "50%",
    transform: [{ translateX: -50 }],
    fontSize: 18,
    fontWeight: "bold",
    color: "black",
    padding: 10,
    borderRadius: 8,
    zIndex: 100,
  },
  chooseShopButton: {
    position: "absolute",
    top: "1%",
    left: "3%",
    height: 45,
    width: 45,
    backgroundColor: "#007bff",
    padding: "10",
    borderRadius: 8,
    zIndex: 100,
  },
  chooseShopText: {
    color: "#fff",
    fontSize: 16,
  },
  // Standard modal styles for checklist modals
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
  // Separate styles for the infomodal (editing selected services)
  infoModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  infoModalContent: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 15,
    width: "85%",
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});