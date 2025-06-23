import React, { useState } from "react";
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
import Icon from "react-native-vector-icons/MaterialIcons";

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Updated API_BASE URL
const API_BASE = "https://numbr-p7zc.onrender.com";

// Function to register push notifications
async function registerForPushNotifications(uid, token) {
  console.log("Registering for push notifications for uid:", uid);

  try {
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

    let expoPushToken;
    try {
      expoPushToken = (
        await Notifications.getExpoPushTokenAsync({
          projectId: "fdeb8267-b069-40e7-9b4e-1a0c50ee6246",
        })
      ).data;
    } catch (error) {
      console.error("Error generating Expo Push Token:", error);
      Alert.alert(
        "Error Generating Push Token",
        `An error occurred while generating the push token: ${error.message}`
      );
      return;
    }

    // Get the user's token from AsyncStorage
    const userToken = await AsyncStorage.getItem("userToken");
    if (!userToken) {
        console.error("No user token found for push notification registration.");
        return;
    }

    try {
      // Send the expoPushToken to your backend's user profile update 
      const response = await fetch(`${API_BASE}/api/users/profile`, { // Updated endpoint
        method: "PUT", // Use PUT for updating profile
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}` // Send JWT token for authentication
        },
        body: JSON.stringify({ expopushtoken: expoPushToken }), // Send expoPushToken
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend error:", errorData);
        Alert.alert(
          "Backend Error",
          `Failed to register push token: ${errorData.error || "Unknown error"}`
        );
        return;
      }

      const resData = await response.json();
      console.log("Backend response for push token registration:", resData);
    } catch (error) {
      console.error("Error sending push token to backend:", error);
      Alert.alert(
        "Network Error",
        "Failed to send push token to the backend. Please check your internet connection."
      );
    }

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
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) { // Changed from email to phone
      Alert.alert("Error", "Please enter both phone number and password.");
      return;
    }
    setLoading(true);
    console.log("Logging in with phone:", phone, "and password:", password); // Changed from email to phone
    try {
      const response = await fetch(`${API_BASE}/api/users/login`, { // Updated endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pass: password }), // Changed email to phone, password to pass
      });

      const responseData = await response.json(); // Renamed data to responseData
      if (!response.ok) {
        Alert.alert("Error", responseData.error || "Login failed"); // Accessing responseData.error
        setLoading(false);
        return;
      }
      console.log(responseData);

      // Store token and user data from responseData.data
      await AsyncStorage.setItem("userToken", responseData.data.token);
      await AsyncStorage.setItem("userName", responseData.data.name);
      await AsyncStorage.setItem("uid", responseData.data._id); // Store user ID
      await AsyncStorage.setItem("userType", "user"); // Explicitly set user type

      // Register push notifications
      // Pass the obtained token from login to registerForPushNotifications if needed
      await registerForPushNotifications(responseData.data._id);

      if (responseData.data.pinnedShop) { // Access pinnedShop from responseData.data
        await AsyncStorage.setItem("pinnedShop", responseData.data.pinnedShop);
      }
      // Replace the screen so user can't navigate back to login
      router.replace("/(tabs)/menu");
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
          <Text style={styles.title}>Login</Text>

          <TextInput
            style={styles.input}
            placeholder="Phone Number" // Changed placeholder
            placeholderTextColor="rgb(0, 0, 0)"
            keyboardType="phone-pad" // Changed keyboardType
            autoCapitalize="none"
            value={phone} // Changed from email to phone
            onChangeText={setPhone} // Changed from setEmail to setPhone
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
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setPasswordVisible(!passwordVisible)}
            >
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

          <TouchableOpacity onPress={() => router.push("/signup")}>
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
    paddingRight: 45, // Extra padding to avoid overlapping with the eye icon
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
    color: "rgb(3, 75, 163)",
    fontWeight: "900",
  },
});
