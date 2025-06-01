import React, { useState, useEffect,useCallback } from "react";
import {  useFocusEffect } from "expo-router";
import {
  TouchableOpacity,
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
import {  useNavigation } from "@react-navigation/native";
import { router } from 'expo-router'; // <--- Import expo-router's router
import InfoModal from '../../components/InfoModal';
import ChecklistModal from '../../components/Modal';
import RatingModal from '../../components/RatingModal';

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
  const API_BASE = "http://10.0.2.2:5000/api";
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
      await joinQueue();
    } catch (error) {
      console.error(error);
    }
    setIsConfirming(false);
  };

  const totalSelectedPrice = checklist
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + item.price, 0);
  const [shopName, setShopName] = useState("");
  const combinedName =
    userName && uid ? `${userName.substring(0, 2)}${uid.substring(0, 4)}` : null;

  useEffect(() => {
    if (shopId) {
      getShopName(shopId).then(name => setShopName(name));
    }
  }, [shopId]);

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      const ps = await AsyncStorage.getItem("pinnedShop");
      if (!ps) {
        // If no shop is pinned, navigate to ShopSelectionScreen using expo-router's router
        router.navigate('/shop-selection', { onShopSelected: handleShopSelection }); // <--- Changed navigation method and path
      }
      setShopId(ps);
      const storedUserName = await AsyncStorage.getItem("userName");
      const storedUid = await AsyncStorage.getItem("uid");
      setUserName(storedUserName);
      setUid(storedUid);
    };
    loadUserData();
  }, []);

  // Callback function to handle shop selection from ShopSelectionScreen
  const handleShopSelection = async (selectedShopId) => {
    await AsyncStorage.setItem("pinnedShop", selectedShopId);
    setShopId(selectedShopId);
    // After selecting, fetch queue data for the new shop
    fetchQueueData();
    // The ShopSelectionScreen will handle navigating back itself via router.back()
  };

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  // Refresh queue data and pending rating when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchQueueData();
      checkPendingRatingAndNotifications();
    }, [shopId])
  );

// In MenuScreen.js

const fetchRateList = async () => {
  console.log("Fetching rate list for shopId:", shopId);
  if (!shopId) return; 
  try {
    const response = await fetch(`${API_BASE}/shops/${shopId}/rate-list`);
    if (!response.ok) {
      console.error("Failed to fetch rate list, status:", response.status);
      setDefaultChecklist([]); 
      setChecklist([]);
      return;
    }
    const data = await response.json(); // Expects { success: true, data: [{ name, price, _id }, ...] }
    
    if (data && data.success && Array.isArray(data.data)) {
      const fetchedChecklistItems = data.data.map((item) => ({
        // item is { name: "Haircut", price: 70, _id: "mongoSubDocIdFromShopServices" }
        id: item._id.toString(), // Use the unique _id of the service subdocument in the shop
        text: item.name,         // Corrected: use item.name (not item.service)
        price: item.price,
        checked: false,
      }));
      setDefaultChecklist(fetchedChecklistItems);
      setChecklist(fetchedChecklistItems.map(i => ({ ...i, checked: false })));
    } else {
      console.error("Fetched rate list data is not in expected format:", data);
      setDefaultChecklist([]);
      setChecklist([]);
    }
  } catch (error) {
    console.error("Error fetching rate list:", error);
    setDefaultChecklist([]); 
    setChecklist([]);
  }
};


  const refreshShop = async () => {
    const storedShopId = await AsyncStorage.getItem("pinnedShop");
    setShopId(storedShopId);
    await fetchQueueData();
  };

  const checkPendingRatingAndNotifications = async () => {
    try {
      const storedUid = await AsyncStorage.getItem("uid");
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
        return;
      }
      const token = (await Notifications.getExpoPushTokenAsync()).data;
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

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchQueueData();
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchQueueData = async () => {
    try {
      const storedShopId = await AsyncStorage.getItem("pinnedShop");
      if (!storedShopId) {
        router.navigate('/shop-selection', { onShopSelected: handleShopSelection }); // <--- Changed navigation method and path
        return;
      }
      const response = await fetch(`${API_BASE}/queue?shopId=${storedShopId}`);
      const data = await response.json();

      // Check for an error from the server (e.g., expired trial/subscription)
      if (data.error) {
        if (data.error.includes("Trial or subscription period has ended")) {
          // Clear the stored shop ID and navigate for choosing a shop
          await AsyncStorage.removeItem("pinnedShop");
          router.navigate('/shop-selection', { onShopSelected: handleShopSelection }); // <--- Changed navigation method and path
          return;
        } else {
          console.error("Error fetching queue data:", data.error);
          return;
        }
      }

      // Update queue state if there are changes
      if (
        data.queueLength !== queueLength ||
        JSON.stringify(data.data) !== JSON.stringify(queueItems)
      ) {
        setQueueLength(data.queueLength);
        setQueueItems(data.data);

        const storedUid = await AsyncStorage.getItem("uid");
        const userResponse = await fetch(`${API_BASE}/profile?uid=${storedUid}`, {
          method: "GET",
        });
        const userData = await userResponse.json();

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

  useEffect(() => {
    let timer;
    const updateRemainingTime = async () => {
      const joinTimeStr = await AsyncStorage.getItem("joinTimestamp");
      if (joinTimeStr && userPosition) {
        const joinTime = Number(joinTimeStr);
        const elapsed = Math.floor((Date.now() - joinTime) / 1000);
        const expectedWaitTime = userPosition * avgServiceTime * 60;
        setRemainingTime(expectedWaitTime - elapsed > 0 ? expectedWaitTime - elapsed : 0);
      }
    };
    if (userPosition) {
      updateRemainingTime();
      timer = setInterval(updateRemainingTime, 1000);
    }
    return () => clearInterval(timer);
  }, [userPosition, uid, avgServiceTime]); // Added dependencies

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
    await fetchRateList();
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
  }, [queueItems, uid, notified, API_BASE]);

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

  async function rateBarber(ratingValue) {
    await AsyncStorage.removeItem("id");
    if (!ratingValue) ratingValue = 5;
    try {
      const storedShopId = await AsyncStorage.getItem("pinnedShop");
      const ratingResponse = await fetch(`${API_BASE}/barber/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shopId: storedShopId, rating: ratingValue, uid }),
      });
      if (!ratingResponse.ok) {
        const errorData = await ratingResponse.json();
        console.error("Error rating barber:", errorData);
        return;
      }
      resetRatingModalFlag();
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

  async function getShopName(shopUid) {
    try {
      const response = await fetch(`${API_BASE}/shops/${shopUid}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched shop data:", data);
      return data.data.name;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return "Unknown Shop";
    }
  }

  return (
    <ImageBackground
      source={require("../image/bglogin.png")}
      style={styles.backgroundImage}
    >
      <View style={styles.overlay} />

      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.chooseShopButton}
            onPress={() => router.navigate('/shop-selection', { onShopSelected: handleShopSelection })} // <--- Changed navigation method and path
          >
            <FontAwesome5 name="store" solid size={20.5} color="#fff" />
          </TouchableOpacity>

          {shopId && <Text style={styles.shopName}>{shopName}</Text>}

          <Text style={styles.queue}>👤 {queueLength}</Text>
        </View>

        <Text style={styles.userCode}>{combinedName}</Text>

        <View style={styles.namesContainer}>
          {queueItems.some(item => item.uid === uid) ? (
            queueItems
              .filter(item => item.uid === uid)
              .map(item => {
                const userPosition = queueItems.findIndex(qItem => qItem.uid === uid) + 1;
                return (
                  <View key={item.uid} style={styles.ticketContainer}>
                    <View style={styles.ticketHeader}>
                      <Text style={styles.ticketHeaderText}>QUEUE TICKET</Text>
                    </View>

                    <View style={styles.ticketBody}>
                      <View style={styles.positionContainer}>
                        <Text style={styles.positionLabel}>YOUR POSITION</Text>
                        <Text style={styles.positionValue}>#{userPosition}</Text>
                      </View>

                      <View style={styles.waitTimeContainer}>
                        <Text style={styles.waitTimeLabel}>ESTIMATED WAIT TIME</Text>
                        <Text style={styles.waitTimeValue}>{formatTime(remainingTime)}</Text>
                      </View>

                      <View style={styles.servicesSection}>
                        <Text style={styles.sectionTitle}>YOUR SERVICES</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.servicesScroll}
                        >
                          {item.services.map((service, index) => (
                            <View key={index} style={styles.servicePill}>
                              <Text style={styles.serviceName}>{service}</Text>
                              <Text style={styles.servicePrice}>
                                ₹{defaultChecklist.find(i => i.text === service)?.price || '--'}
                              </Text>
                            </View>
                          ))}
                        </ScrollView>
                      </View>

                      <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>TOTAL</Text>
                        <Text style={styles.totalPrice}>₹{item.totalCost}</Text>
                      </View>
                    </View>

                    <View style={styles.ticketFooter}>
                      <Text style={styles.footerText}>Present this ticket when called</Text>
                    </View>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.button, styles.modifyButton]}
                        onPress={() => {
                          const updated = defaultChecklist.map(i => ({
                            ...i,
                            checked: item.services.includes(i.text),
                          }));
                          setInfoModalChecklist(updated);
                          setinfomodalVisible(true);
                        }}
                      >
                        <Text style={styles.buttonText}>MODIFY</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.button, styles.leaveButton]}
                        onPress={leaveQueue}
                      >
                        <Text style={styles.buttonText}>LEAVE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
          ) : (
            <View style={styles.namesContainer}>
              {!queueItems.some(item => item.uid === uid) && (
                <>
                  <View style={styles.rateListContainer}>
                    <Text style={styles.servicesTitle}>Available Services:</Text>
                    <FlatList
                      data={defaultChecklist}
                      keyExtractor={item => item.id.toString()}
                      renderItem={({ item }) => (
                        <View style={styles.rateItem}>
                          <Text style={styles.rateText}>{item.text}</Text>
                          <Text style={styles.ratePrice}>₹{item.price}</Text>
                        </View>
                      )}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.joinButton}
                    onPress={() => {
                      setChecklist(defaultChecklist.map(i => ({ ...i, checked: false })));
                      setModalVisible(true);
                    }}
                  >
                    <View style={styles.joinButtonContent}>
                      <Svg
                        xmlns="http://www.w3.org/2000/svg"
                        width={25}
                        height={25}
                        viewBox="0 0 16 16"
                        fill="white"
                      >
                        <Path
                          fillRule="evenodd"
                          d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"
                        />
                      </Svg>
                      <Text style={styles.joinButtonText}>Join Queue</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </View>
      <ChecklistModal
        visible={modalVisible}
        checklist={checklist}
        totalPrice={totalSelectedPrice}
        onToggleItem={id =>
          setChecklist(prev =>
            prev.map(i => (i.id === id ? { ...i, checked: !i.checked } : i))
          )
        }
        onConfirm={joinQueueHandler}
        onClose={() => setModalVisible(false)}
        confirming={isConfirming}
      />

      <InfoModal
        visible={infomodalVisible}
        checklist={infoModalChecklist}
        onToggleItem={id =>
          setInfoModalChecklist(prev =>
            prev.map(i => (i.id === id ? { ...i, checked: !i.checked } : i))
          )
        }
        onConfirm={() => {
          const selected = infoModalChecklist
            .filter(i => i.checked)
            .map(i => i.text);
          const cost = infoModalChecklist
            .filter(i => i.checked)
            .reduce((sum, i) => sum + i.price, 0);
          updateUserServices(selected, cost);
          setinfomodalVisible(false);
        }}
        onClose={() => setinfomodalVisible(false)}
      />

      <RatingModal
        visible={ratingModalVisible}
        rating={rating}
        onFinishRating={value => setRating(value)}
        onSubmit={() => {
          rateBarber(rating);
          setRatingModalVisible(false);
        }}
        onReset={resetRatingModalFlag}
        onClose={() => setRatingModalVisible(false)}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  ticketContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  ticketHeader: {
    backgroundColor: '#000',
    paddingVertical: 12,
    alignItems: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  ticketHeaderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  ticketBody: {
    paddingHorizontal: 20,
  },
  ticketFooter: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  positionContainer: {
    alignItems: 'center',
  },
  positionLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  positionValue: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  waitTimeContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  waitTimeLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  waitTimeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
  },
  servicesSection: {
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  servicesScroll: {
    flexGrow: 0,
    marginBottom: 5,
  },
  servicePill: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  serviceName: {
    fontSize: 14,
    color: '#333',
    marginRight: 6,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 10,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifyButton: {
    backgroundColor: '#333',
    marginRight: 10,
  },
  leaveButton: {
    backgroundColor: '#d32f2f',
    marginLeft: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rateListContainer: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rateText: {
    fontSize: 16,
    color: '#333',
  },
  ratePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: 'green',
  },
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(237, 236, 236, 0.77)',
    zIndex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 2,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    zIndex: 2,
  },
  chooseShopButton: {
    padding: 10,
    backgroundColor: 'blue',
    borderRadius: 8,
    height: 40,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: 'black',
    marginHorizontal: 10,
  },
  queue: {
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: '#28a745',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  userCode: {
    marginTop: 20,
    fontSize: 72,
    fontWeight: '700',
    color: '#333',
    zIndex: 2,
    textAlign: 'center',
  },
  positionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  positionLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginRight: 8,
  },
  userPosition: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#186ac8',
    textAlign: 'center',
    lineHeight: 70,
    fontSize: 48,
    fontWeight: '700',
    color: '#186ac8',
  },
  waitTimeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  timerDisplay: {
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  timerText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF5722',
  },
  namesContainer: {
    flex: 1,
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  userCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userName: {
    fontSize: 35,
    fontWeight: '500',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  servicesTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 4,
    color: '#333',
    alignSelf: 'flex-start',
  },
  servicesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  serviceItem: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    margin: 4,
    fontSize: 16,
    color: '#555',
  },
  totalCost: {
    fontSize: 25,
    fontWeight: '600',
    color: 'green',
    marginVertical: 12,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modifyBtn: {
    flex: 1,
    marginRight: 10,
    backgroundColor: 'rgb(24, 106, 200)',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveBtn: {
    flex: 1,
    backgroundColor: '#dc3545',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  joinButton: {
    backgroundColor: '#28a745',
    height: 60,
    width: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  joinButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  // modalContainer: {
  //   flex: 1,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   backgroundColor: 'rgba(0,0,0,0.5)',
  //   zIndex: 2,
  // },
  // modalContent: {
  //   width: '95%',
  //   maxHeight: '90%',
  //   backgroundColor: '#fff',
  //   borderRadius: 12,
  //   padding: 20,
  //   zIndex: 3,
  //   position: 'relative',
  //   alignSelf: 'center',
  // },
});
