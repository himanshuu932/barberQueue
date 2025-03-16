import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Show an alert when the app is in the foreground
    shouldPlaySound: true, // Play a sound when the notification is received
    shouldSetBadge: true, // Set the app badge count
  }),
});
import { useFocusEffect } from '@react-navigation/native';

// Function to register push notifications
async function registerForPushNotifications(uid) {
  console.log("Registering for push notifications for uid:", uid);

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

    // Step 2: Generate Expo Push Token
    let token;
    try {
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: "fdeb8267-b069-40e7-9b4e-1a0c50ee6246", // Use your Expo project ID
        })
      ).data;
      // console.log("Expo Push Token generated:", token);
      // Alert.alert("Expo Push Token generated:", token);
    } catch (error) {
      console.error("Error generating Expo Push Token:", error);
      Alert.alert(
        "Error Generating Push Token",
        `An error occurred while generating the push token: ${error.message}`
      );
      return; // Exit the function if token generation fails
    }

    // Step 3: Send token to your custom backend
    try {
      const response = await fetch(
        "https://barberqueue-24143206157.us-central1.run.app/shop/register-push-token",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, token }),
        }
      );

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

    // Step 4: Configure Android notification channel
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    try {
      const response = await fetch(
        "https://barberqueue-24143206157.us-central1.run.app/shop/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.error || "Login failed");
        return;
      }
      console.log(data.shop.id);
      // Store token and user data
      await AsyncStorage.setItem("userToken", data.token);
      await AsyncStorage.setItem("userName", data.shop.name);
      await AsyncStorage.setItem("uid", data.shop.id);
      
      let userType = "superadmin";
      await AsyncStorage.setItem("userType", userType);

     // Alert.alert("Success", `Logged in as: ${email}`);
     await registerForPushNotifications(data.shop.id);
      // Navigate immediately
         router.replace("/(superadmin)/menu");
      

      // Register push notifications without awaiting (to avoid delay)
     
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Something went wrong during login.");
    }
  };

  return (
    <ImageBackground source={require("./image/bglogin.png")} style={styles.background}>
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Owner Login</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="rgb(0, 0, 0)"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="rgb(0, 0, 0)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.buttonContainer} onPress={handleLogin}>
            <LinearGradient
              colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Login</Text>
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