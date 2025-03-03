import React, { useState } from "react";
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
import Constants from "expo-constants";

async function registerForPushNotifications(uid) {
  console.log("Registering for push notifications for uid:", uid);
  // if (!Constants.isDevice) {
  //   console.log("Must use a physical device for Push Notifications");
  //   return;
  // }
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
    return;
  }
  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId: 'fdeb8267-b069-40e7-9b4e-1a0c50ee6246', // Replace with your Expo Project ID
    })
  ).data;
  console.log("Expo Push Token generated:", token);
  // Send token to your backend so it can be stored in the user record
  try {
    const response = await fetch("https://barberqueue-24143206157.us-central1.run.app/register-push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, token }),
    });
    const resData = await response.json();
    console.log("Backend response for push token registration:", resData);
  } catch (error) {
    console.error("Error sending push token to backend:", error);
  }
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
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
      const response = await fetch("https://barberqueue-24143206157.us-central1.run.app/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.error || "Login failed");
        return;
      }
      // Store token and user data
      await AsyncStorage.setItem("userToken", data.token);
      await AsyncStorage.setItem("userName", data.user.name);
      await AsyncStorage.setItem("uid", data.user.id);

      // Determine userType (example logic)
      let userType = "user";
      if (email === "admin") {
        userType = "admin";
      } else if (email === "superadmin") {
        userType = "superadmin";
      }
      await AsyncStorage.setItem("userType", userType);

      Alert.alert("Success", `Logged in as: ${email}`);

      // Register push notifications for this user
      await registerForPushNotifications(data.user.id);

      // Navigate based on userType
      if (userType === "admin") {
        router.replace("/(admin)/menu");
      } else if (userType === "superadmin") {
        router.replace("/(superadmin)/menu");
      } else {
        router.replace("/(tabs)/menu");
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Something went wrong during login.");
    }
  };

  return (
    <ImageBackground
      source={require("./image/bglogin.png")}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Login</Text>

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
