import React, { useState } from "react";
import { View, Text, TextInput, Alert, TouchableOpacity, ImageBackground, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const API_BASE = "https://barber-queue.vercel.app";
  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    try {
      const response = await fetch("https://barber-queue.vercel.app/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.error || "Signup failed");
        return;
      }
      await AsyncStorage.setItem("userToken", data.token);
      await AsyncStorage.setItem("userName", data.user.name);
      Alert.alert("Success", `Signed up as: ${data.user.email}`);
      email==="admin"?router.replace("/(admin)/menu"):router.replace("/(tabs)/menu");
    } catch (error) {
      console.error("Signup error:", error);
      Alert.alert("Error", "Something went wrong during signup.");
    }
  };

  return (
    <ImageBackground source={require("./image/bglogin.png")} style={styles.background}>
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Sign Up</Text>

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
            placeholder="Password"
            placeholderTextColor="rgb(0, 0, 0)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Metallic Gradient Button */}
          <TouchableOpacity style={styles.buttonContainer} onPress={handleSignup}>
            <LinearGradient
              colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} // Metallic gradient colors
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Sign Up</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/login")}>
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
    backgroundColor: "rgba(129, 125, 125, 0.64)", // Semi-transparent background for readability
    width: "100%",
  },
  formContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.3)", // Barely visible background for the form container
    padding: 20,
    borderRadius: 15,
    width: "85%", // Adjust the width as needed
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
    backgroundColor: "rgba(255, 255, 255, 0.8)", // Semi-transparent input
    color: "rgb(0, 0, 0)",
  },
  buttonContainer: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden", // Ensures the gradient stays inside the button's border radius
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
