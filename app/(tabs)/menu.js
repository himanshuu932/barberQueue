import React, { useState, useEffect } from "react";
import { TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Button,
  Alert,
  ImageBackground,
} from "react-native";
import * as Notifications from "expo-notifications";

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
  const [loading, setLoading] = useState(true);
  const [notified, setNotified] = useState(false);
  const [userName, setUserName] = useState(null);
  const [uid, setUid] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);

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

  const API_BASE = "https://barber-queue.vercel.app";

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${API_BASE}/queue`);
      const data = await response.json();
      if (data.queueLength !== queueLength || JSON.stringify(data.names) !== JSON.stringify(names)) {
        setQueueLength(data.queueLength);
        setNames(data.names);
      }
    } catch (error) {
      console.error("Error fetching queue data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
    const intervalId = setInterval(() => {
      fetchQueueData();
    }, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const userPosition = combinedName && names.includes(combinedName) ? names.indexOf(combinedName) + 1 : null;
  const avgServiceTime = 10;
  const initialWaitTime = userPosition ? userPosition * avgServiceTime * 60 : null;

  useEffect(() => {
    setRemainingTime(initialWaitTime);

    if (initialWaitTime) {
      const timer = setInterval(() => {
        setRemainingTime((prevTime) => (prevTime > 0 ? prevTime - 1 : 0));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [userPosition]);

  useEffect(() => {
    if (userPosition !== null && userPosition <= 3 && !notified) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Almost Your Turn!",
          body: `You're number ${userPosition} in line. Please get ready for your service.`,
        },
        trigger: null,
      });
      setNotified(true);
    } else if (userPosition === null || userPosition > 3) {
      setNotified(false);
    }
  }, [userPosition]);

  const joinQueue = async () => {
    if (!combinedName) {
      Alert.alert("Error", "User information not loaded yet.");
      return;
    }
  
    Alert.alert(
      "Confirm Join",
      "Are you sure you want to join the queue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "OK",
          onPress: async () => {
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
          },
        },
      ]
    );
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
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "OK",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE}/queue?name=${encodeURIComponent(combinedName)}`,
                { method: "DELETE" }
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
          },
        },
      ]
    );
  };
  

  const formatTime = (seconds) => {
    if (seconds === null || seconds <= 0) return "Ready!";
    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${minutes}m ${sec}s`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
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
        <ScrollView style={styles.namesContainer} nestedScrollEnabled={true} 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 10 }}>
          {names.map((name, index) => (
            <View key={index} style={styles.queueCard}>
              <Text style={styles.queueNumber}>{index + 1}.</Text>
              <Text style={styles.queueName}>{name}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.buttonContainer}>
          {combinedName && names.includes(combinedName) ? (
            <TouchableOpacity style={styles.leaveButton} onPress={leaveQueue}>
              <Icon name="sign-out" size={24} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.joinButton} onPress={joinQueue}>
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
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(237, 236, 236, 0.77)", // White overlay with 50% opacity
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
    color: "black",  // Ensure text is visible on background
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
    alignItems:"center",
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
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  queueName: {
    fontSize: 15,
    color: "#777",
  },
  joinButton: {
    width: 50, // Circular button size
    height: 50,
    borderRadius: 12, // Fully round button
    backgroundColor: "rgb(48, 139, 36)",
    justifyContent: "center", // Center icon vertically
    alignItems: "center", // Center icon horizontally
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
    bottom: 20, // Adjust as needed
    right: 25,  // Adjust as needed
    flexDirection: "row",
    gap: 10, // Space between join & leave buttons
  },
  
});

