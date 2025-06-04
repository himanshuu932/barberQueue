import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  TouchableOpacity, Alert, View, Text, StyleSheet, ActivityIndicator,
  ScrollView, ImageBackground, FlatList, Platform, Dimensions,
} from "react-native";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { io } from "socket.io-client";
import { router } from 'expo-router';
import InfoModal from '../../components/InfoModal'; // Ensure path is correct
import ChecklistModal from '../../components/Modal'; // Ensure path is correct
import RatingModal from '../../components/RatingModal'; // Ensure path is correct

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

const { width, height } = Dimensions.get("window");
const API_BASE = "http://10.0.2.2:5000/api";
const API_BASE2 = "http://10.0.2.2:5000";
export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(0);
  const [queueItems, setQueueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notified, setNotified] = useState(false);
  const [userName, setUserName] = useState(null);
  const [uid, setUid] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null); // in seconds
  const [modalVisible, setModalVisible] = useState(false); // For ChecklistModal (joining queue)
  const [infomodalVisible, setInfomodalVisible] = useState(false); // For InfoModal (modifying services)
  const [defaultChecklist, setDefaultChecklist] = useState([]); // Full list of services from shop
  const [checklist, setChecklist] = useState([]); // Services for ChecklistModal (subset of defaultChecklist for joining)
  const [ratingModalVisible, setRatingModalVisible] = useState(false); // For RatingModal
  const [rating, setRating] = useState(0);
  const [infoModalChecklist, setInfoModalChecklist] = useState([]); // Services for InfoModal (editing)
  const [isConfirming, setIsConfirming] = useState(false); // Prevent double-clicks on modal confirm
  const [shopName, setShopName] = useState("Shop");

  const combinedName = userName && uid ? `${userName.substring(0, 2)}${uid.substring(0, 4)}` : "GUEST";

  // Effect for initial data loading (user details, pinned shop)
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      const ps = await AsyncStorage.getItem("pinnedShop");
      const storedUserName = await AsyncStorage.getItem("userName");
      const storedUid = await AsyncStorage.getItem("uid");

      setUserName(storedUserName);
      setUid(storedUid);

      if (!ps) {
        router.replace('/shop-selection'); // Use replace to prevent going back to an invalid state
        // setLoading(false) will be handled by shopId effect or lack thereof
        return;
      }
      setShopId(ps); // This will trigger other useEffects dependent on shopId
    };
    loadInitialData();
  }, []);

  // Effect to fetch shop name when shopId changes
  useEffect(() => {
    if (shopId) {
      getShopName(shopId).then(name => setShopName(name || "Shop"));
    } else {
      setShopName("No Shop Selected");
    }
  }, [shopId]);

  // Effect to fetch rate list (services) and initial queue data when shopId is set or changes
  useEffect(() => {
    if (shopId) {
      setLoading(true); // Set loading true when shopId changes and we start fetching
      fetchRateList(); // Fetches services for the shop
      fetchQueueData(); // Fetches current queue for the shop
    } else {
      // Clear shop-specific data if shopId becomes null
      setQueueItems([]);
      setQueueLength(0);
      setDefaultChecklist([]);
      setChecklist([]);
      setLoading(false);
    }
  }, [shopId]); // Dependency: shopId

  const handleShopSelection = async (selectedShopId) => {
    await AsyncStorage.setItem("pinnedShop", selectedShopId);
    setShopId(selectedShopId); // This will trigger data fetching for the new shop
    router.back();
  };

  useEffect(() => {
    Notifications.requestPermissionsAsync(); // Request notification permissions
  }, []);

  // Push notification registration token logic
  useEffect(() => {
    async function registerForPushNotifications() {
      // ... (your existing registerForPushNotifications function from the uploaded file)
      // Example:
      try {
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
        const token = (await Notifications.getExpoPushTokenAsync({ projectId: Notifications.projectId })).data;
        console.log("Expo Push Token:", token);
        // Send token to your backend
        await fetch(`${API_BASE}/users/register-push-token`, { // Ensure this endpoint exists
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, token }), // Make sure your backend expects `uid`
        });
      } catch (e) {
        console.error("Error in push notification registration:", e);
      }
    }
    if (uid) { // Only register if UID is available
      registerForPushNotifications();
    }
  }, [uid]);


  // Socket.IO connection management
  useEffect(() => {
    const newSocket = io(API_BASE2, {
      reconnectionAttempts: 5,
      transports: ['websocket'], // Prefer WebSocket
       query: { shopId: shopId } // Optionally send shopId on connect if backend supports it
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log("Socket connected:", newSocket.id);
      if (shopId) { // If shopId is already known by the time of connection
        newSocket.emit('join_shop_queue', shopId); // Join the room for this shop
        console.log(`Socket joined room for shop: ${shopId} on connect`);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log("Socket disconnected:", reason);
    });

   newSocket.on('connect_error', (err) => {
  console.log('Connection Error:', err.message);
});

    return () => {
      if (shopId && newSocket.connected) { // If connected, explicitly leave the room
        newSocket.emit('leave_shop_queue', shopId);
        console.log(`Socket left room for shop: ${shopId} on cleanup`);
      }
      newSocket.disconnect();
      console.log("Socket instance disconnected on component unmount or effect re-run.");
    };
  }, []); // Create/destroy socket instance once per component lifecycle

   // Socket event listeners and room joining/leaving based on shopId changes
  useEffect(() => {
    if (socket && shopId) {
      console.log(`Joining room for shop: ${shopId}`);
      socket.emit('join_shop_queue', shopId);

      socket.off('queue:updated'); // Remove previous listener to avoid duplicates
      socket.on('queue:updated', (data) => { // Data = { shopId, queue, count } from backend
        console.log('queue:updated event received via socket for shop:', data.shopId);
        if (data.shopId === shopId) { // Ensure update is for the current shop
            setQueueItems(data.queue || []);
            setQueueLength(data.count !== undefined ? data.count : (data.queue || []).length);
        }
      });
    }
    // When shopId changes and socket exists, this effect re-runs.
    // If you want to leave the *previous* shop's room, you'd need to store prevShopId.
    // For now, joining the new one is handled. Leaving is handled on global disconnect.
  }, [socket, shopId]); // Re-run if socket instance or shopId changes


  // Fallback Polling (can be less frequent if sockets are reliable)
  useEffect(() => {
    let intervalId;
    if (shopId && !socket?.connected) { // Poll if shopId exists AND socket is not connected
      console.log("Socket not connected, starting polling for queue data...");
      intervalId = setInterval(fetchQueueData, 30000); // Poll every 30 seconds
    }
    return () => {
        if (intervalId) {
            clearInterval(intervalId);
            console.log("Polling stopped.");
        }
    };
  }, [shopId, socket, fetchQueueData]); // Rerun if shopId or socket connection status changes


  const fetchRateList = useCallback(async () => {
    if (!shopId) return;
    console.log("Fetching rate list for shopId:", shopId);
    try {
      const response = await fetch(`${API_BASE}/shops/${shopId}/rate-list`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch rate list: ${response.status} ${errorData.message || ''}`);
      }
      const data = await response.json();
      if (data && data.success && Array.isArray(data.data)) {
        const fetchedChecklistItems = data.data.map((item) => ({
          id: item._id.toString(), // This is the service._id from the shop's services
          text: item.name,
          price: item.price,
          checked: false,
        }));
        setDefaultChecklist(fetchedChecklistItems);
        setChecklist(fetchedChecklistItems.map(i => ({ ...i, checked: false }))); // For the modal
      } else {
        console.error("Fetched rate list data is not in expected format:", data);
        setDefaultChecklist([]); setChecklist([]);
      }
    } catch (error) {
      console.error("Error fetching rate list:", error.message);
      setDefaultChecklist([]); setChecklist([]);
       Alert.alert("Error", `Could not load services for this shop. ${error.message}`);
    }
  }, [shopId]);


  const fetchQueueData = useCallback(async () => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    console.log("Fetching queue data for shop:", shopId);
    // setLoading(true); // Manage loading state carefully to avoid flickering if socket updates are fast
    try {
      const response = await fetch(`${API_BASE}/queue/shop/${shopId}`); // GET /api/queue/shop/:shopId
      const data = await response.json();

      if (data.error) {
        if (data.error.includes("Trial or subscription period has ended")) {
          await AsyncStorage.removeItem("pinnedShop");
          router.replace('/shop-selection');
          return;
        }
        console.error("Error fetching queue data (API error):", data.error);
        throw new Error(data.error);
      }

      if (data.success) {
        setQueueItems(data.data || []);
        setQueueLength(data.count !== undefined ? data.count : (data.data || []).length);
        // Additional logic for notifications if user is in queue:
        // This logic was in the original file, ensure it's adapted to the new data structure
        // ...
      } else {
        console.error("Failed to fetch queue data (success=false):", data.message || "Unknown server error");
        setQueueItems([]);
        setQueueLength(0);
      }
    } catch (error) {
      console.error("Error fetching queue data (catch block):", error.message);
      // Alert.alert("Error", `Could not load queue information. ${error.message}`);
      setQueueItems([]); // Reset on error to avoid displaying stale data
      setQueueLength(0);
    } finally {
      setLoading(false);
    }
  }, [shopId, uid]); // uid might be needed if notification logic depends on it directly here


  const totalSelectedPrice = checklist
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + item.price, 0);

  useEffect(() => { // Reset confirming state if modal closes
    if (!modalVisible) setIsConfirming(false);
  }, [modalVisible]);

  const joinQueueHandler = async () => {
    if (isConfirming) return;
    setIsConfirming(true);

    const selectedItems = checklist.filter((item) => item.checked);
    if (selectedItems.length === 0) {
      Alert.alert("No Service Selected", "Please select at least one service before proceeding.");
      setIsConfirming(false);
      return;
    }

    const servicesPayload = selectedItems.map(item => ({
        service: item.id, // service's unique _id from shop's services
        quantity: 1,      // Assuming quantity 1 for each selected service
    }));

    try {
      // UID and UserName are already in state (uid, userName)
      // ShopId is also in state (shopId)
      const requestBody = {
        shopId: shopId,
        services: servicesPayload,
        userIdFromFrontend: uid,     // Send current user's UID
        customerName: userName,      // Send current user's name (backend decides if it's guest or uses auth'd name)
        // customerPhone: "...", // If you collect phone for guests, send it here
      };
      
      const response = await fetch(`${API_BASE}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        await AsyncStorage.setItem("joinTimestamp", String(Date.now()));
        // fetchQueueData(); // Socket event 'queue:updated' should handle this if socket is connected
                           // or if not, the next poll will. For immediate feedback, can call it.
        if (!socket || !socket.connected) fetchQueueData(); // Fetch if no socket to rely on for update

        setChecklist(defaultChecklist.map((item) => ({ ...item, checked: false })));
        setModalVisible(false);
        Alert.alert("Success", "You've joined the queue!");
      } else {
        Alert.alert("Error Joining Queue", responseData.message || "Failed to join the queue. Please try again.");
      }
    } catch (error) {
      console.error("Error joining queue (catch block):", error);
      Alert.alert("Connection Error", "An error occurred while trying to join the queue. Please check your internet connection.");
    } finally {
      setIsConfirming(false);
    }
  };
  

const leaveQueue = async () => {
  console.log('[leaveQueue] Function initiated');
  
  if (!uid) {
    console.error('[leaveQueue] Error: UID not available');
    Alert.alert("Error", "User information not loaded.");
    return;
  }

  console.log('[leaveQueue] Finding user in queue...');
  const currentUserQueueEntry = queueItems.find(item => item.userId && item.userId._id === uid);

  if (!currentUserQueueEntry) {
    console.warn('[leaveQueue] User not found in queue items:', {
      uid,
      queueItems: queueItems.map(item => ({
        id: item._id,
        userId: item.userId?._id,
        status: item.status
      }))
    });
    Alert.alert("Not in Queue", "You are not currently in the queue for this shop.");
    return;
  }

  const queueEntryId = currentUserQueueEntry._id;
  console.log('[leaveQueue] Found queue entry:', {
    queueEntryId,
    status: currentUserQueueEntry.status,
    position: currentUserQueueEntry.orderOrQueueNumber
  });

  try {
    console.log('[leaveQueue] Retrieving token from storage...');
    const token = await AsyncStorage.getItem('userToken');
    console.log('[leaveQueue] Token retrieved:', token ? 'exists' : 'MISSING');
    
    if (!token) {
      console.error('[leaveQueue] No token found in storage');
      throw new Error('Authentication token not found. Please login again.');
    }

    console.log('[leaveQueue] Showing confirmation alert...');
    Alert.alert(
      "Confirm Leave", 
      "Are you sure you want to leave the queue?",
      [
        { text: "Cancel", style: "cancel", onPress: () => console.log('[leaveQueue] User canceled') },
        {
          text: "OK",
          onPress: async () => {
            console.log('[leaveQueue] User confirmed, preparing request...', {
              endpoint: `${API_BASE}/queue/${queueEntryId}/cancel`,
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token?.substring(0, 10)}...` // Log first 10 chars only
              }
            });

            try {
              const startTime = Date.now();
              console.log('[leaveQueue] Sending request...');
              
              const response = await fetch(
                `${API_BASE}/queue/${queueEntryId}/cancel`,
                { 
                  method: "PUT",
                  headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                  },
                }
              );

              const responseTime = Date.now() - startTime;
              console.log(`[leaveQueue] Received response in ${responseTime}ms`, {
                status: response.status,
                statusText: response.statusText
              });

              const responseData = await response.json();
              console.log('[leaveQueue] Response data:', responseData);

              if (!response.ok) {
                console.error('[leaveQueue] Backend error response:', {
                  status: response.status,
                  error: responseData,
                  queueEntryId,
                  tokenPresent: !!token,
                  headers: Object.fromEntries(response.headers.entries())
                });
                throw new Error(responseData.message || "Failed to leave the queue");
              }

              if (responseData.success) {
                console.log('[leaveQueue] Successfully left queue');
                if (!socket || !socket.connected) {
                  console.log('[leaveQueue] Socket not connected, manually fetching queue data');
                  fetchQueueData();
                }
                Alert.alert("Success", "You have left the queue.");
              } else {
                console.warn('[leaveQueue] Unsuccessful response:', responseData);
                Alert.alert("Error", responseData.message || "Failed to leave the queue.");
              }
            } catch (error) {
              console.error('[leaveQueue] Request failed:', {
                error: error.message,
                stack: error.stack,
                queueEntryId,
                tokenPresent: !!token,
                tokenLength: token?.length,
                isTokenValid: token && token.split('.').length === 3 // Basic JWT check
              });
              
              Alert.alert(
                "Error", 
                error.message.includes('token') 
                  ? "Session expired. Please login again."
                  : error.message || "An error occurred while leaving the queue. Please try again."
              );
              
              // Additional debug info for network errors
              if (error.message.includes('Network request failed')) {
                console.error('[leaveQueue] Network failure details:', {
                  isOnline: await checkNetworkStatus(), // You'd need to implement this
                  apiBase: API_BASE,
                  reachable: await checkApiReachable() // You'd need to implement this
                });
              }
            }
          },
        },
      ]
    );
  } catch (error) {
    console.error('[leaveQueue] Outer catch block error:', {
      error: error.message,
      stack: error.stack
    });
    Alert.alert(
      "Authentication Error", 
      "Please login again to perform this action."
    );
    
    // You might want to add automatic logout here
    // await AsyncStorage.multiRemove(['token', 'refreshToken', 'uid', 'userName']);
    // router.replace('/login');
  }
};



// Helper functions you could add:
async function checkNetworkStatus() {
  // Implementation depends on your React Native version
  return true; // Simplified
}

async function checkApiReachable() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

  // Placeholder for updateUserServices - requires backend implementation for PATCH /api/queue/:id/services
const updateUserServices = async () => {
  const selected = infoModalChecklist.filter(i => i.checked);
  if (selected.length === 0) {
    Alert.alert("No Services", "Please select at least one service.");
    return;
  }

  const queueEntryId = currentUserQueueEntry?._id;
  if (!queueEntryId) return;

  const token = await AsyncStorage.getItem("userToken");
  if (!token) {
    Alert.alert("Error", "You are not logged in.");
    return;
  }

  const servicesPayload = selected.map(item => ({
    service: item.id,
    quantity: 1,
  }));

  try {
    const response = await fetch(`${API_BASE}/queue/${queueEntryId}/services`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ services: servicesPayload }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      Alert.alert("Success", "Services updated!");
      setInfomodalVisible(false);
    } else {
      throw new Error(data.message || "Failed to update.");
    }
  } catch (err) {
    console.error("Update error:", err);
    Alert.alert("Error", err.message || "Something went wrong.");
  }
};



  const currentUserQueueEntry = queueItems.find(item => item.userId && item.userId._id === uid);
  const userPositionInQueue = currentUserQueueEntry ? queueItems.findIndex(item => item._id === currentUserQueueEntry._id) + 1 : null;
  const avgServiceTimePerPerson = 10; // minutes

  useEffect(() => {
    let timer;
    const updateRemainingTime = async () => {
      if (currentUserQueueEntry && userPositionInQueue) {
        const joinTimeStr = await AsyncStorage.getItem("joinTimestamp"); // This might be for *this* user specifically
        const joinedAt = currentUserQueueEntry.createdAt ? new Date(currentUserQueueEntry.createdAt).getTime() : (joinTimeStr ? Number(joinTimeStr) : Date.now());
        
        const elapsedSinceJoin = Math.floor((Date.now() - joinedAt) / 1000); // seconds
        const peopleAhead = userPositionInQueue - 1;
        const estimatedWaitTimeForPeopleAhead = peopleAhead * avgServiceTimePerPerson * 60; // seconds
        
        // This needs refinement: if user just joined, elapsed might be small.
        // A better approach is to estimate based on queue position only, or time service started for person ahead.
        // Simple estimation based on position:
        let newRemainingTime = estimatedWaitTimeForPeopleAhead;
        // If this user is #1, and their service hasn't started (status pending), this is their wait time.
        // If their service is in-progress, remainingTime is not relevant in this way.
        setRemainingTime(newRemainingTime > 0 ? newRemainingTime : 0);

      } else {
        setRemainingTime(null);
      }
    };

    if (userPositionInQueue) {
      updateRemainingTime();
      timer = setInterval(updateRemainingTime, 5000); // Update less frequently, e.g., every 5s or when queue changes
    } else {
      setRemainingTime(null); // Clear if not in position
    }
    return () => clearInterval(timer);
  }, [userPositionInQueue, currentUserQueueEntry, avgServiceTimePerPerson]);


  const formatTime = (seconds) => {
    if (seconds === null || seconds < 0) return "--";
    if (currentUserQueueEntry && currentUserQueueEntry.status === 'in-progress') return "In Service";
    if (seconds === 0 && userPositionInQueue === 1 && (!currentUserQueueEntry || currentUserQueueEntry.status === 'pending')) return "You're Next!";
    if (seconds === 0) return "Soon";
    const minutes = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${minutes}m ${sec}s`;
  };

  async function getShopName(sId) {
    if (!sId) return "Shop";
    try {
      const response = await fetch(`${API_BASE}/shops/${sId}`);
      if (!response.ok) throw new Error('Failed to fetch shop name');
      const data = await response.json();
      return data.data.name || "Shop";
    } catch (error) {
      console.error("Error fetching shop name:", error.message);
      return "Shop";
    }
  }

  // Loading state for initial shop determination and data fetch
  if (loading && !shopId && !defaultChecklist.length) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Loading Shop Details...</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage} resizeMode="cover">
      <View style={styles.overlay} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.chooseShopButton}
            onPress={() => router.navigate('/shop-selection', { onShopSelected: handleShopSelection })}
          >
            <FontAwesome5 name="store" solid size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
          <Text style={styles.queue}>👥 {queueLength}</Text>
        </View>

        <Text style={styles.userCode}>{combinedName}</Text>

        {loading && <View style={styles.centered}><ActivityIndicator size="large" color="#007bff" /><Text>Loading Queue...</Text></View>}

        {!loading && (
            <ScrollView style={{width: '100%'}} contentContainerStyle={{alignItems: 'center'}}>
            {currentUserQueueEntry ? (
                <View style={styles.ticketContainer}>
                {/* ... Ticket rendering as in previous response ... */}
                  <View style={styles.ticketHeader}><Text style={styles.ticketHeaderText}>QUEUE TICKET</Text></View>
                  <View style={styles.ticketBody}>
                    <View style={styles.positionContainer}>
                      <Text style={styles.positionLabel}>YOUR POSITION</Text>
                      <Text style={styles.positionValue}>#{userPositionInQueue}</Text>
                    </View>
                    <View style={styles.waitTimeContainer}>
                      <Text style={styles.waitTimeLabel}>ESTIMATED WAIT</Text>
                      <Text style={styles.waitTimeValue}>{formatTime(remainingTime)}</Text>
                    </View>
                    <View style={styles.servicesSection}>
                      <Text style={styles.sectionTitle}>YOUR SERVICES</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesScroll}>
                          {currentUserQueueEntry.services.map((serviceObj, index) => (
                          <View key={index} style={styles.servicePill}>
                              <Text style={styles.serviceName}>{serviceObj.name}</Text>
                              <Text style={styles.servicePrice}>₹{serviceObj.price}</Text>
                          </View>
                          ))}
                      </ScrollView>
                    </View>
                    <View style={styles.totalContainer}>
                      <Text style={styles.totalLabel}>TOTAL</Text>
                      <Text style={styles.totalPrice}>₹{currentUserQueueEntry.totalCost}</Text>
                    </View>
                  </View>
                  <View style={styles.ticketFooter}><Text style={styles.footerText}>Present this ticket when called</Text></View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.button, styles.modifyButton]}
                      onPress={() => {
                        const currentServicesNames = currentUserQueueEntry.services.map(s => s.name);
                        const updatedInfoChecklist = defaultChecklist.map(i => ({
                          ...i, checked: currentServicesNames.includes(i.text),
                        }));
                        setInfoModalChecklist(updatedInfoChecklist);
                        setInfomodalVisible(true);
                      }}
                    >
                      <Text style={styles.buttonText}>MODIFY</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.leaveButton]} onPress={leaveQueue}>
                      <Text style={styles.buttonText}>LEAVE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
            ) : ( // User is NOT in the queue
                <>
                {defaultChecklist.length > 0 ? (
                    <View style={styles.rateListContainer}>
                        <Text style={styles.servicesTitle}>Available Services</Text>
                        <FlatList
                            data={defaultChecklist}
                            keyExtractor={item => item.id.toString()}
                            renderItem={({ item }) => (
                            <View style={styles.rateItem}>
                                <Text style={styles.rateText}>{item.text}</Text>
                                <Text style={styles.ratePrice}>₹{item.price}</Text>
                            </View>
                            )}
                            ListEmptyComponent={<Text>No services available for this shop.</Text>}
                        />
                    </View>
                ) : (
                    <View style={styles.centered}><Text>No services listed for this shop.</Text></View>
                )}
                <TouchableOpacity
                    style={[styles.joinButton, (defaultChecklist.length === 0 || loading) && styles.disabledButton]}
                    onPress={() => {
                        setChecklist(defaultChecklist.map(i => ({ ...i, checked: false })));
                        setModalVisible(true);
                    }}
                    disabled={defaultChecklist.length === 0 || loading}
                >
                    <View style={styles.joinButtonContent}>
                    <Svg fill="white" width={22} height={22} viewBox="0 0 16 16"><Path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"/></Svg>
                    <Text style={styles.joinButtonText}>Join Queue</Text>
                    </View>
                </TouchableOpacity>
                </>
            )}
            </ScrollView>
        )}
      </View>

      <ChecklistModal
        visible={modalVisible}
        checklist={checklist}
        totalPrice={totalSelectedPrice}
        onToggleItem={id => setChecklist(prev => prev.map(i => (i.id === id ? { ...i, checked: !i.checked } : i)))}
        onConfirm={joinQueueHandler}
        onClose={() => setModalVisible(false)}
        confirming={isConfirming}
      />
      <InfoModal
        visible={infomodalVisible}
        checklist={infoModalChecklist}
        onToggleItem={id => setInfoModalChecklist(prev => prev.map(i => (i.id === id ? { ...i, checked: !i.checked } : i)))}
        onConfirm={updateUserServices} // Placeholder - needs backend for modification
        onClose={() => setInfomodalVisible(false)}
      />
      {/* RatingModal can be added here if needed */}
    </ImageBackground>
  );
}

// Styles (ensure these match your application's theme and requirements)
const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  backgroundImage: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(240, 240, 240, 0.8)', zIndex: 1 },
  container: { flex: 1, paddingTop: Platform.OS === 'ios' ? 80 : 70, paddingHorizontal: 15, alignItems: 'center', zIndex: 2 },
  header: {
    position: 'absolute', top: Platform.OS === 'ios' ? 30 : 15, left: 15, right: 15,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, zIndex: 3,
  },
  chooseShopButton: { padding: 8, backgroundColor: 'rgba(0,0,200,0.7)', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  shopName: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#333', marginHorizontal: 8, },
  queue: { fontSize: 15, fontWeight: 'bold', backgroundColor: '#28a745', color: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, },
  userCode: { fontSize: Math.min(width * 0.18, 70) , fontWeight: 'bold', color: '#333', marginBottom: 15, textAlign: 'center' },
  
  ticketContainer: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6, borderWidth: 1, borderColor: '#ddd' },
  ticketHeader: { backgroundColor: '#333', paddingVertical: 10, alignItems: 'center' },
  ticketHeaderText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  ticketBody: { padding: 15 },
  positionContainer: { alignItems: 'center', marginBottom: 12 },
  positionLabel: { fontSize: 13, color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  positionValue: { fontSize: 44, fontWeight: 'bold', color: '#222' },
  waitTimeContainer: { alignItems: 'center', marginBottom: 18 },
  waitTimeLabel: { fontSize: 13, color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  waitTimeValue: { fontSize: 22, fontWeight: 'bold', color: '#d32f2f' },
  servicesSection: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, color: '#444', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  servicesScroll: { maxHeight: 80 },
  servicePill: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, marginBottom: 6, alignItems: 'center', borderWidth: 1, borderColor: '#e5e5e5' },
  serviceName: { fontSize: 13, color: '#333', marginRight: 5 },
  servicePrice: { fontSize: 13, fontWeight: 'bold', color: '#28a745' },
  totalContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12, marginTop:8 },
  totalLabel: { fontSize: 14, color: '#444', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalPrice: { fontSize: 20, fontWeight: 'bold', color: '#28a745' },
  ticketFooter: { backgroundColor: '#f9f9f9', padding: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee' },
  footerText: { color: '#777', fontSize: 11, fontWeight: '500' },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal:5, borderTopWidth:1, borderTopColor: '#f0f0f0' },
  button: { flex: 1, paddingVertical: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  modifyButton: { backgroundColor: '#5bc0de' },
  leaveButton: { backgroundColor: '#d9534f' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.3 },
  
  rateListContainer: { width: '100%', maxHeight: height * 0.45, marginBottom: 15, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: 15, borderWidth:1, borderColor:'#eee' },
  servicesTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign:'center' },
  rateItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rateItemLast: { borderBottomWidth: 0 },
  rateText: { fontSize: 15, color: '#444' },
  ratePrice: { fontSize: 15, fontWeight: 'bold', color: '#28a745' },
  
  joinButton: { backgroundColor: '#28a745', height: 55, width: '90%', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginVertical: 15, flexDirection: 'row', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, },
  disabledButton: { backgroundColor: '#aaa' },
  joinButtonContent: { flexDirection: 'row', alignItems: 'center' },
  joinButtonText: { fontSize: 17, fontWeight: 'bold', color: '#fff', marginLeft: 8 },
});