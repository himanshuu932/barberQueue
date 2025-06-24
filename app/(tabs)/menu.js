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

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const API_BASE = "https://numbr-p7zc.onrender.com/api";
const API_BASE2 = "https://numbr-p7zc.onrender.com";
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
 // Initial data loading and shop selection
useEffect(() => {
  const loadInitialData = async () => {
    setLoading(true);
    const ps = await AsyncStorage.getItem("pinnedShop");
    const storedUserName = await AsyncStorage.getItem("userName");
    const storedUid = await AsyncStorage.getItem("uid");

    setUserName(storedUserName);
    setUid(storedUid);

    if (!ps) {
      router.replace('/shop-selection');
      return;
    }
    setShopId(ps);
  };
  loadInitialData();
}, []);

// Fetch shop name when shopId changes
useEffect(() => {
  if (shopId) {
    getShopName(shopId).then(name => setShopName(name || "Shop"));
  } else {
    setShopName("No Shop Selected");
  }
}, [shopId]);

// Fetch services and queue data when shopId changes
useEffect(() => {
  if (shopId) {
    setLoading(true);
    fetchRateList();
    fetchQueueData();
  } else {
    setQueueItems([]);
    setQueueLength(0);
    setDefaultChecklist([]);
    setChecklist([]);
    setLoading(false);
  }
}, [shopId]);

// Request notification permissions
useEffect(() => {
  Notifications.requestPermissionsAsync();
}, []);

// Push notification registration
useEffect(() => {
  async function registerForPushNotifications() {
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
      await fetch(`${API_BASE}/users/register-push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, token }),
      });
    } catch (e) {
      console.error("Error in push notification registration:", e);
    }
  }
  if (uid) {
    registerForPushNotifications();
  }
}, [uid]);

// Socket.IO connection and event handling
useEffect(() => {
  const newSocket = io(API_BASE2, {
    reconnectionAttempts: 5,
    transports: ['websocket'],
    query: { shopId: shopId }
  });
  setSocket(newSocket);

  // Connection handlers
  newSocket.on('connect', () => {
    console.log("Socket connected with ID:", newSocket.id);
    if (shopId) {
      newSocket.emit('join_shop_queue', shopId);
    }
    if (uid) {
      newSocket.emit('join_user_room', uid);
      console.log(`Joined user room for UID: ${uid}`);
    }
  });

  newSocket.on('disconnect', (reason) => {
    console.log("Socket disconnected:", reason);
  });

  newSocket.on('connect_error', (err) => {
    console.log('Connection Error:', err.message);
  });

  // Cleanup function
  return () => {
    if (shopId && newSocket.connected) {
      newSocket.emit('leave_shop_queue', shopId);
    }
    if (uid && newSocket.connected) {
      newSocket.emit('leave_user_room', uid);
    }
    newSocket.disconnect();
  };
}, [uid, shopId]);

// Socket event listeners
useEffect(() => {
  if (!socket) return;

  // Queue updates for the current shop
  const handleQueueUpdate = (data) => {
    console.log('queue:updated event received for shop:', data.shopId);
    if (data.shopId === shopId) {
      setQueueItems(data.queue || []);
      setQueueLength(data.count !== undefined ? data.count : (data.queue || []).length);
    }
  };

  // Position change notifications
  const handlePositionChange = (data) => {
    console.log('Position changed:', data);
    Alert.alert(
      data.title, 
      data.message,
      [{ text: "OK", onPress: () => fetchQueueData() }] // Refresh queue when alert dismissed
    );
  };

  // Join responses
  const handleJoinResponse = (response) => {
    console.log('Join response:', response);
  };

  // Error handling
  const handleError = (error) => {
    console.error('Socket error:', error);
  };

   const handleServiceCompleted = (data) => {
    Alert.alert(
      data.title, 
      data.message,
      [{ text: "OK", onPress: () => fetchQueueData() }]
    );
  };

  const handleQueueCancelled = (data) => {
    Alert.alert(
      data.title, 
      data.message,
      [{ text: "OK", onPress: () => fetchQueueData() }]
    );
  };


    // Set up listeners
  socket.on('queue:service_completed', handleServiceCompleted);
  socket.on('queue:cancelled', handleQueueCancelled);
  socket.on('queue:updated', handleQueueUpdate);
  socket.on('queue:position_changed', handlePositionChange);
  socket.on('join_user_room', handleJoinResponse);
  socket.on('error', handleError);

  // Clean up listeners
  return () => {
    socket.off('queue:service_completed', handleServiceCompleted);
    socket.off('queue:cancelled', handleQueueCancelled);
    socket.off('queue:updated', handleQueueUpdate);
    socket.off('queue:position_changed', handlePositionChange);
    socket.off('join_user_room', handleJoinResponse);
    socket.off('error', handleError);
  };
}, [socket, shopId, fetchQueueData]);

// Fallback polling when socket is disconnected
useEffect(() => {
  let intervalId;
  if (shopId && !socket?.connected) {
    console.log("Starting polling for queue data...");
    intervalId = setInterval(fetchQueueData, 30000);
    fetchQueueData(); // Initial fetch
  }
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      console.log("Polling stopped.");
    }
  };
}, [shopId, socket, fetchQueueData]);

// Handle position change notifications separately for better reliability
useEffect(() => {
  if (!socket || !uid) return;

  const handlePositionNotification = (data) => {
    if (data.data?.queueId) {
      console.log('Position change for queue entry:', data.data.queueId);
      Alert.alert(data.title, data.message);
      fetchQueueData();
    }
  };

  socket.on('queue:position_changed', handlePositionNotification);

  return () => {
    socket.off('queue:position_changed', handlePositionNotification);
  };
}, [socket, uid, fetchQueueData]);



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
      if (currentUserQueueEntry && userPositionInQueue !== null) { // Ensure userPositionInQueue is not null
        // Calculate estimated total time based on people ahead and average service time
        const peopleAhead = userPositionInQueue - 1;
        const estimatedTotalWaitTimeSeconds = peopleAhead * avgServiceTimePerPerson * 60; // seconds

        // Determine the actual join time for the countdown
        // Prioritize `currentUserQueueEntry.createdAt` from the backend for accuracy.
        // Fallback to `joinTimestamp` from AsyncStorage if backend data is not available,
        // otherwise, use current time as a last resort (less accurate for a countdown).
        const joinedAt = currentUserQueueEntry.createdAt
          ? new Date(currentUserQueueEntry.createdAt).getTime()
          : (await AsyncStorage.getItem("joinTimestamp") ? Number(await AsyncStorage.getItem("joinTimestamp")) : Date.now());

        // Calculate elapsed time since joining the queue
        const elapsedSinceJoin = Math.floor((Date.now() - joinedAt) / 1000); // seconds

        // Calculate remaining time by subtracting elapsed time from the total estimated time
        let newRemainingTime = estimatedTotalWaitTimeSeconds - elapsedSinceJoin;

        // Ensure remaining time doesn't go below zero
        setRemainingTime(newRemainingTime > 0 ? newRemainingTime : 0);

      } else {
        setRemainingTime(null); // Clear remaining time if user is not in queue
      }
    };

    // Start updating the timer only if the user is in the queue
    if (userPositionInQueue !== null) {
      updateRemainingTime(); // Initial call to set time immediately
      timer = setInterval(updateRemainingTime, 1000); // Update every 1 second for a smooth countdown
    } else {
      setRemainingTime(null); // Clear if not in position
    }
    return () => clearInterval(timer); // Cleanup timer on unmount or dependency change
  }, [userPositionInQueue, currentUserQueueEntry, avgServiceTimePerPerson]); // Dependencies to re-run effect


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
    console.log("Fetching shop name for shopId:", sId);
    if (!sId) return "Shop";
    try {
      const response = await fetch(`${API_BASE}/shops/${sId}`);
      if (!response.ok) throw new Error('Failed to fetch shop name');
      const data = await response.json();
      console.log("Shop name data received:", data.data.shop.name);
      return data.data.shop.name || "Shop";
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
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: screenWidth * 0.056 
  },
  backgroundImage: { 
    flex: 1 
  },
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(240, 240, 240, 0.8)', 
    zIndex: 1 
  },
  container: { 
    flex: 1, 
    paddingTop: Platform.OS === 'ios' ? screenHeight * 0.1 : screenHeight * 0.0875, 
    paddingHorizontal: screenWidth * 0.04, 
    alignItems: 'center', 
    zIndex: 2 
  },
  header: {
    position: 'absolute', 
    top: Platform.OS === 'ios' ? screenHeight * 0.038 : screenHeight * 0.019, 
    left: screenWidth * 0.042, 
    right: screenWidth * 0.042,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: screenHeight * 0.0125, 
    zIndex: 3,
  },
  chooseShopButton: { 
    padding: screenWidth * 0.022, 
    backgroundColor: 'rgba(0,0,200,0.7)', 
    borderRadius: "20%", 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  shopName: { 
    flex: 1, 
    textAlign: 'center', 
    fontSize: screenWidth * 0.06, 
    fontWeight: 'bold', 
    color: '#333', 
    // marginHorizontal: 8, 
  },
  queue: { 
    fontSize: screenWidth * 0.041, 
    fontWeight: 'bold', 
    backgroundColor: '#28a745', 
    color: '#fff', 
    paddingHorizontal: screenWidth * 0.027, 
    paddingVertical: screenHeight * 0.0075, 
    borderRadius: 8, 
  },
  userCode: { 
    fontSize: Math.min(screenWidth * 0.18, screenWidth * 0.19) , 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: screenHeight * 0.02, 
    textAlign: 'center' 
  },
  
  ticketContainer: { 
    width: '100%', 
    maxWidth: 400, 
    backgroundColor: '#fff', 
    borderRadius: "4%", 
    overflow: 'hidden', 
    // marginBottom: 20, 
    // shadowColor: '#000', 
    // shadowOffset: { width: 0, height: 2 }, 
    // shadowOpacity: 0.15, 
    // shadowRadius: 8, 
    // elevation: 6, 
    borderWidth: 1, 
    borderColor: '#ddd' 
},
  ticketHeader: { 
    backgroundColor: '#333', 
    paddingVertical: screenHeight * 0.012, 
    alignItems: 'center'  
  },
  ticketHeaderText: { 
    color: '#fff', 
    fontSize: screenWidth * 0.045, 
    fontWeight: 'bold', 
    letterSpacing: screenWidth * 0.001 
  },
  ticketBody: { 
    padding: screenWidth * 0.04 
  },
  positionContainer: { 
    alignItems: 'center', 
    marginBottom: screenHeight * 0.015
  },
  positionLabel: { 
    fontSize: screenWidth * 0.037, 
    color: '#555', 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    letterSpacing: screenWidth * 0.001, 
    // marginBottom: 1 
  },
  positionValue: { 
    fontSize: screenWidth * 0.12, 
    fontWeight: 'bold', 
    color: '#222' 
  },
  waitTimeContainer: { 
    alignItems: 'center', 
    marginBottom: screenHeight * 0.023 
  },
  waitTimeLabel: { 
    fontSize: screenWidth * 0.036, 
    color: '#555', 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    letterSpacing: screenWidth * 0.001, 
    // marginBottom: 1 
  },
  waitTimeValue: { 
    fontSize: screenWidth * 0.06, 
    fontWeight: 'bold', 
    color: '#d32f2f'
   },
  servicesSection: { 
    // marginBottom: 12 
  },
  sectionTitle: { 
    fontSize: screenWidth * 0.036, 
    color: '#444', 
    fontWeight: '600', 
    marginBottom: 6, 
    textTransform: 'uppercase', 
    letterSpacing: screenWidth * 0.001, 
  },
  servicesScroll: { 
    maxHeight: 80 
  },
  servicePill: { 
    flexDirection: 'row', 
    backgroundColor: '#f5f5f5', 
    borderRadius: 14, 
    paddingHorizontal: screenWidth * 0.03, 
    paddingVertical: screenWidth * 0.015, 
    marginRight: screenWidth * 0.02, 
    marginBottom: screenHeight * 0.008, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#e5e5e5' 
  },
  serviceName: { 
    fontSize: screenWidth * 0.035, 
    color: '#333', 
    marginRight: screenWidth * 0.015 
  },
  servicePrice: { 
    fontSize: screenWidth * 0.035, 
    fontWeight: 'bold', 
    color: '#28a745' 
  },
  totalContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderTopColor: '#eee', 
    paddingTop: screenHeight * 0.015, 
    marginTop: screenHeight * 0.006 
  },
  totalLabel: { 
    fontSize: screenWidth * 0.04, 
    color: '#444', 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    letterSpacing: screenWidth * 0.001 
  },
  totalPrice: { 
    fontSize: screenWidth * 0.055, 
    fontWeight: 'bold', 
    color: '#28a745' 
  },
  ticketFooter: { 
    backgroundColor: '#f9f9f9', 
    padding: screenWidth * 0.03, 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderTopColor: '#eee' 
  },
  footerText: { 
    color: '#777', 
    fontSize: screenWidth * 0.03, 
    fontWeight: '500' 
  },
  actionButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: screenHeight * 0.01, 
    paddingHorizontal: screenWidth * 0.015, 
    borderTopWidth:1, 
    borderTopColor: '#f0f0f0' 
  },
  button: { 
    flex: 1, 
    paddingVertical: screenHeight * 0.015, 
    borderRadius: 6, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginHorizontal: screenWidth * 0.015 
  },
  modifyButton: { 
    backgroundColor: '#5bc0de' 
  },
  leaveButton: { 
    backgroundColor: '#d9534f' 
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: screenWidth * 0.035, 
    textTransform: 'uppercase', 
    letterSpacing: screenWidth * 0.0015 
  },
  
  rateListContainer: { 
    width: '100%', 
    maxHeight: screenHeight * 0.45, 
    marginBottom: screenHeight * 0.02, 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    borderRadius: 10, 
    padding: screenWidth * 0.041, 
    borderWidth:1, 
    borderColor:'#eee' 
  },
  servicesTitle: { 
    fontSize: screenWidth * 0.048, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: screenHeight * 0.01, 
    textAlign:'center' 
  },
  rateItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: screenHeight * 0.013, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  rateItemLast: { 
    borderBottomWidth: 0 
  },
  rateText: { 
    fontSize: screenWidth * 0.04, 
    color: '#444' 
  },
  ratePrice: { 
    fontSize: screenWidth * 0.04, 
    fontWeight: 'bold', 
    color: '#28a745' 
  },
  
  joinButton: { 
    backgroundColor: '#28a745', 
    height: screenHeight * 0.068, 
    width: '90%', 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginVertical: screenHeight * 0.018, 
    flexDirection: 'row', 
    // elevation: 2, 
    // shadowColor: '#000', 
    // shadowOffset: { width: 0, height: 1 }, 
    // shadowOpacity: 0.1, 
    // shadowRadius: 2, 
  },
  disabledButton: { 
    backgroundColor: '#aaa' 
  },
  joinButtonContent: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  joinButtonText: { 
    fontSize: screenWidth * 0.048, 
    fontWeight: 'bold', 
    color: '#fff', 
    marginLeft: screenWidth * 0.025 
  },
});