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
  Modal,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

export default function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: email entry, 2: OTP verification, 3: registration
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [addressText, setAddressText] = useState("");
  const [expoPushToken, setExpoPushToken] = useState("");
  const [location, setLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const API_BASE = "https://numbr-exq6.onrender.com";

  // Register for push notifications
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => setExpoPushToken(token));
  }, []);

  async function registerForPushNotificationsAsync() {
    let token;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      Alert.alert("Failed to get push token for push notifications!");
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: "fdeb8267-b069-40e7-9b4e-1a0c50ee6246",
    })).data;
    console.log("Expo Push Token:", token);

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
    return token;
  }

  const handleSendOTP = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to send OTP");
      }

      Alert.alert("Success", "OTP sent to your email");
      setStep(2); // Move to OTP verification step
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      Alert.alert("Error", "Please enter the OTP");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "OTP verification failed");
      }

      Alert.alert("Success", "Email verified successfully");
      setStep(3); // Move to registration details step
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!name || !password ) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    setIsLoading(true);
    console.log("nams and emial",name," ",email," pass",password);
    try {
      const response = await fetch(`${API_BASE}/api/owners/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, pass: password }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.log(data);
        throw new Error(data.message || "Signup failed");
      }

      Alert.alert("Success", `Signed up as: ${data.data.email}`);
      router.replace("/owner-login");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };


  const renderStepOne = () => (
    <>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="rgb(0, 0, 0)"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      
      <TouchableOpacity
        style={[styles.buttonContainer, { marginBottom: 15 }]}
        onPress={handleSendOTP}
        disabled={isLoading}
      >
        <LinearGradient
          colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Send Verification Code</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </>
  );

  const renderStepTwo = () => (
    <>
      <Text style={styles.otpMessage}>Verification code sent to {email}</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter OTP"
        placeholderTextColor="rgb(0, 0, 0)"
        keyboardType="number-pad"
        value={otp}
        onChangeText={setOtp}
        maxLength={6}
      />
      
      <TouchableOpacity
        style={[styles.buttonContainer, { marginBottom: 15 }]}
        onPress={handleVerifyOTP}
        disabled={isLoading}
      >
        <LinearGradient
          colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Verify Code</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => setStep(1)}>
        <Text style={styles.link}>Change Email</Text>
      </TouchableOpacity>
    </>
  );

  const renderStepThree = () => (
    <>
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
        placeholder="Password"
        placeholderTextColor="rgb(0, 0, 0)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity 
        style={styles.buttonContainer} 
        onPress={handleSignup}
        disabled={isLoading}
      >
        <LinearGradient
          colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Complete Sign Up</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </>
  );

  return (
    <ImageBackground source={require("./image/bglogin.png")} style={styles.background}>
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>
            {step === 1 ? "Owner Sign Up" : step === 2 ? "Verify Email" : "Complete Registration"}
          </Text>

          {step === 1 && renderStepOne()}
          {step === 2 && renderStepTwo()}
          {step === 3 && renderStepThree()}

          {step === 1 && (
            <TouchableOpacity onPress={() => router.push("/owner-login")}>
              <Text style={styles.registerText}>
                Already have an account? <Text style={styles.link}>Login</Text>
              </Text>
            </TouchableOpacity>
          )}
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
  otpMessage: {
    color: "#FFFFFF",
    marginBottom: 15,
    textAlign: "center",
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 15,
  },
  addressInput: {
    flex: 1,
    fontWeight: "400",
    fontSize: 16,
    padding: 12,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    color: "rgb(0, 0, 0)",
  },
  locateButton: {
    backgroundColor: "#1a1a1a",
    padding: 12,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    elevation: 10,
    justifyContent: "center",
    alignItems: "center",
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
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    padding: 15,
    textAlign: "center",
    backgroundColor: "#f2f2f2",
  },
  modalMap: {
    width: "100%",
    height: 300,
  },
  locationText: {
    padding: 15,
    textAlign: "center",
    fontSize: 16,
    color: "#000",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    padding: 15,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});