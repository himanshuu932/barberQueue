import React, { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Button,
  Alert,
} from "react-native";
import * as Notifications from "expo-notifications";

// Configure notifications behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(null);
  const [names, setNames] = useState([]);
  const [loading, setLoading] = useState(true); // Used for initial load
  const [notified, setNotified] = useState(false); // Track if notification has been sent

  // State for user info
  const [userName, setUserName] = useState(null);
  const [uid, setUid] = useState(null);

  // Retrieve userName and uid from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem("userName").then((value) => setUserName(value));
    AsyncStorage.getItem("uid").then((value) => setUid(value));
  }, []);

  // Create a combined name: username + first 4 characters of uid.
  const combinedName =
    userName && uid ? `${userName}${uid.substring(0, 4)}` : null;

  // Base API URL
  const API_BASE = "https://barber-queue.vercel.app";

  // Request notification permissions on mount
  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  // Function to fetch the latest queue data
  const fetchQueueData = async () => {
    try {
      // Show spinner on the first load only
      if (queueLength === null) {
        setLoading(true);
      }
      const response = await fetch(`${API_BASE}/queue`);
      const data = await response.json();
      setQueueLength(data.queueLength);
      setNames(data.names);
    } catch (error) {
      console.error("Error fetching queue data:", error);
    } finally {
      if (queueLength === null) {
        setLoading(false);
      }
    }
  };

  // Poll the API every 2 seconds
  useEffect(() => {
    fetchQueueData();
    const intervalId = setInterval(() => {
      fetchQueueData();
    }, 2000);
    return () => clearInterval(intervalId);
  }, []);

  // Determine the user's position (if they're in the queue)
  const userPosition =
    combinedName && names.includes(combinedName)
      ? names.indexOf(combinedName) + 1
      : null;
  const avgServiceTime = 10; // Average service time per person in minutes
  const estimatedWait = userPosition ? userPosition * avgServiceTime : null;

  // Use push notifications if the user's position is 3 or less and they haven't been notified yet.
  useEffect(() => {
    if (userPosition !== null && userPosition <= 3 && !notified) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Almost Your Turn!",
          body: `You're number ${userPosition} in line. Please get ready for your service.`,
        },
        trigger: null, // Trigger immediately
      });
      setNotified(true);
    }
    // Reset notification flag if the user's position increases beyond 3
    if (userPosition === null || userPosition > 3) {
      setNotified(false);
    }
  }, [userPosition]);

  // Handler to join the queue using combinedName
  const joinQueue = async () => {
    if (!combinedName) {
      Alert.alert("Error", "User information not loaded yet.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: combinedName }),
      });
      if (response.ok) {
        fetchQueueData();
      } else {
        Alert.alert("Error", "Failed to join the queue.");
      }
    } catch (error) {
      console.error("Error joining queue:", error);
      Alert.alert("Error", "An error occurred while joining the queue.");
    }
  };

  // Handler to leave the queue using combinedName
  const leaveQueue = async () => {
    if (!combinedName) {
      Alert.alert("Error", "User information not loaded yet.");
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE}/queue?name=${encodeURIComponent(combinedName)}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        fetchQueueData();
      } else {
        Alert.alert("Error", "Failed to leave the queue.");
      }
    } catch (error) {
      console.error("Error leaving queue:", error);
      Alert.alert("Error", "An error occurred while leaving the queue.");
    }
  };

  // Show spinner only if initial data hasn't been loaded.
  if (queueLength === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  // Determine if the user is in the queue using the combined name
  const isUserInQueue = combinedName && names.includes(combinedName);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Current Queue</Text>
      <Text style={styles.queue}>
        👤 {queueLength} {queueLength === 1 ? "Person" : "People"} Waiting
      </Text>
      {names.length > 0 && (
        <View style={styles.namesContainer}>
          <Text style={styles.namesTitle}>Queue List:</Text>
          {names.map((name, index) => (
            <Text key={index} style={styles.name}>
              {index + 1}. {name}
            </Text>
          ))}
        </View>
      )}

      {/* Show join or leave queue button based on whether the user is in the queue */}
      <View style={styles.buttonContainer}>
        {isUserInQueue ? (
          <Button title="Leave Queue" onPress={leaveQueue} color="#FF4500" />
        ) : (
          <Button title="Join Queue" onPress={joinQueue} color="#008000" />
        )}
      </View>

      {/* Show the user's position and estimated wait time if they are in the queue */}
      {isUserInQueue && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>Your position: {userPosition}</Text>
          <Text style={styles.infoText}>
            Estimated wait time: {estimatedWait} minutes
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  queue: {
    fontSize: 20,
    marginVertical: 10,
  },
  namesContainer: {
    marginTop: 20,
    width: "100%",
    paddingHorizontal: 20,
  },
  namesTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  name: {
    fontSize: 16,
    marginVertical: 2,
  },
  buttonContainer: {
    marginTop: 20,
  },
  infoContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  infoText: {
    fontSize: 16,
    marginVertical: 5,
  },
});
