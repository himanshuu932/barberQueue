import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Alert, TouchableOpacity, ImageBackground, StyleSheet, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [addressText, setAddressText] = useState("");
  const [expoPushToken, setExpoPushToken] = useState("");
  const [location, setLocation] = useState(null);

  const API_BASE = "https://barberqueue-24143206157.us-central1.run.app";

  // Register for push notifications
  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));
  }, []);

  async function registerForPushNotificationsAsync() {
    let token;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Failed to get push token for push notifications!');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("Expo Push Token:", token);
  
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  
    return token;
  }

  // Request user location on component mount
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission to access location was denied");
        return;
      }
      try {
        let loc = await Location.getCurrentPositionAsync({});
        console.log("Fetched location:", loc);
        setLocation(loc);
      } catch (error) {
        console.error("Error fetching location:", error);
      }
    })();
  }, []);
  
  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    try {
      // Build the address object with textData and location coordinates
      const address = {
        textData: addressText,
        x: location ? location.coords.longitude : 0,
        y: location ? location.coords.latitude : 0,
      };

      const response = await fetch(`${API_BASE}/shop/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, expoPushToken, address }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.message || "Signup failed");
        return;
      }
      await AsyncStorage.setItem("userToken", data.token);
      await AsyncStorage.setItem("userName", data.shop.name);
      Alert.alert("Success", `Signed up as: ${data.shop.email}`);
      router.replace("/owner-login");
    } catch (error) {
      console.error("Signup error:", error);
      Alert.alert("Error", "Something went wrong during signup.");
    }
  };

  return (
    <ImageBackground source={require("./image/bglogin.png")} style={styles.background}>
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Shop Sign Up</Text>

          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="rgb(0, 0, 0)"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />

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
            placeholder="Address (optional)"
            placeholderTextColor="rgb(0, 0, 0)"
            value={addressText}
            onChangeText={setAddressText}
          />

          {/* Display the current location coordinates */}
          <View style={styles.locationContainer}>
            {location ? (
              <Text style={styles.locationText}>
                Location: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
              </Text>
            ) : (
              <Text style={styles.locationText}>Fetching location...</Text>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="rgb(0, 0, 0)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.buttonContainer} onPress={handleSignup}>
            <LinearGradient
              colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Sign Up</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/owner-login")}>
            <Text style={styles.registerText}>
              Already have an account? <Text style={styles.link}>Login</Text>
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
  locationContainer: {
    marginBottom: 15,
  },
  locationText: {
    color: "rgb(255, 255, 255)",
    fontSize: 14,
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
