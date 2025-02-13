import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const API_BASE = "https://barber-queue.vercel.app";
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.error || "Login failed");
        return;
      }
      // Save the token in AsyncStorage
      await AsyncStorage.setItem("userToken", data.token);
      email==="admin"? await AsyncStorage.setItem("userType", 'admin'): await AsyncStorage.setItem("userType", 'user');
      Alert.alert("Success", `Logged in as: ${data.user.email}`);
      email==="admin"?router.replace("/(admin)/menu"):router.replace("/(tabs)/menu");
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Something went wrong during login.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button title="Login" onPress={handleLogin} />

      <TouchableOpacity onPress={() => router.push("/signup")}>
        <Text style={styles.registerText}>
          Don't have an account? <Text style={styles.link}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#fff",
  },
  registerText: {
    marginTop: 15,
    fontSize: 14,
  },
  link: {
    color: "blue",
    fontWeight: "bold",
  },
});
