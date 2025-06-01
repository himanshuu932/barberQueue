import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialIcons";

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Show an alert when the app is in the foreground
    shouldPlaySound: true, // Play a sound when the notification is received
    shouldSetBadge: true, // Set the app badge count
  }),
});

// Function to register push notifications
async function registerForPushNotifications(ownerId, token) {
  console.log("Registering for push notifications for ownerId:", ownerId);
  console.log("Expo Push Token:", token);

  try {
    // Step 1: Check and request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log("Existing permission status:", existingStatus);

    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log("Requested permission status:", finalStatus);
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notifications!");
      Alert.alert(
        "Permission Denied",
        "Push notifications permission is required to receive notifications. Please enable it in your device settings."
      );
      return;
    }

    // Step 2: Send token to your custom backend to update owner profile
    try {
      // Retrieve the user token from AsyncStorage for authentication
      const userToken = await AsyncStorage.getItem("userToken");
      if (!userToken) {
        console.error("No user token found for push notification registration.");
        return;
      }

      const response = await fetch(
        "http://10.0.2.2:5000/api/owners/profile", // Correct route for updating owner profile
        {
          method: "PUT", // Use PUT for updating profile
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`, // Send the user token
          },
          body: JSON.stringify({ expopushtoken: token }), // Send the push token
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend error updating push token:", errorData);
        Alert.alert(
          "Backend Error",
          `Failed to register push token: ${errorData.message || "Unknown error"}`
        );
        return;
      }

      const resData = await response.json();
      console.log("Backend response for push token update:", resData);
    } catch (error) {
      console.error("Error sending push token to backend:", error);
      Alert.alert(
        "Network Error",
        "Failed to send push token to the backend. Please check your internet connection."
      );
    }

    // Step 3: Configure Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
  } catch (error) {
    console.error("Error in registerForPushNotifications:", error);
    Alert.alert(
      "Error",
      "An unexpected error occurred while setting up push notifications. Please try again later."
    );
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState(""); // Changed from email to phone
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) { // Changed from email to phone
      Alert.alert("Error", "Please enter both phone number and password.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        "http://10.0.2.2:5000/api/owners/login", // Corrected endpoint
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, pass: password }), // Corrected fields
        }
      );

      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.message || "Login failed"); // Use data.message
        setLoading(false);
        return;
      }
      console.log("Login successful:", data);
      console.log("Owner ID:", data.data._id); // Access _id from data.data

      // Store token and owner data
      await AsyncStorage.setItem("userToken", data.data.token);
      await AsyncStorage.setItem("userName", data.data.name);
      await AsyncStorage.setItem("uid", data.data._id); // Store owner ID
      let userType = "owner"; 
      await AsyncStorage.setItem("userType", userType);

      // Get Expo Push Token and then register it with the backend
      let expoPushToken;
      try {
        expoPushToken = (
          await Notifications.getExpoPushTokenAsync({
            projectId: "fdeb8267-b069-40e7-9b4e-1a0c50ee6246", // Use your Expo project ID
          })
        ).data;
        await registerForPushNotifications(data.data._id, expoPushToken); // Pass owner ID and token
      } catch (error) {
        console.error("Error getting Expo Push Token or registering:", error);
      }


      // Navigate immediately and remove this screen from the stack
      router.replace("/(superadmin)/menu"); // Assuming the owner's menu path is /owner/menu
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Something went wrong during login.");
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={require("./image/bglogin.png")} style={styles.background}>
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Owner Login</Text>

          <TextInput
            style={styles.input}
            placeholder="Phone Number" // Changed placeholder
            placeholderTextColor="rgb(0, 0, 0)"
            keyboardType="phone-pad" // Changed keyboardType
            autoCapitalize="none"
            value={phone}
            onChangeText={setPhone} // Changed setter
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor="rgb(0, 0, 0)"
              secureTextEntry={!passwordVisible}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setPasswordVisible(!passwordVisible)}>
              <Icon name={passwordVisible ? "visibility" : "visibility-off"} size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.buttonContainer} onPress={handleLogin} disabled={loading}>
            <LinearGradient
              colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/owner-signup")}>
            <Text style={styles.registerText}>
              Don't have an account? <Text style={styles.link}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: "cover",
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(129, 125, 125, 0.64)",
    width: "100%",
  },
  formContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 20,
    borderRadius: 15,
    width: "85%",
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    fontWeight: "400",
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    color: "rgb(0, 0, 0)",
  },
  passwordContainer: {
    position: "relative",
    width: "100%",
    marginBottom: 15,
  },
  passwordInput: {
    paddingRight: 45, // Extra right padding to avoid text overlap with the eye icon
  },
  eyeButton: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: [{ translateY: -20 }],
  },
  buttonContainer: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
  },
  button: {
    padding: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: "500",
    color: "rgb(255, 255, 255)",
  },
  link: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});