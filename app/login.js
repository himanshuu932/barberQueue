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
  Modal,
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
const API_BASE = "https://numbr-exq6.onrender.com";

// Function to register push notifications
async function registerForPushNotifications(uid, userToken) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return;
    }

    const expoPushToken = (await Notifications.getExpoPushTokenAsync({
      projectId: "fdeb8267-b069-40e7-9b4e-1a0c50ee6246",
    })).data;

    const response = await fetch(`${API_BASE}/api/users/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userToken}`
      },
      body: JSON.stringify({ expopushtoken: expoPushToken }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Backend error:", errorData);
      return;
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
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  
  // Forgot password states
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1); // 1: email, 2: otp, 3: new password
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pass: password }),
      });

      const responseData = await response.json();
      if (!response.ok) {
        Alert.alert("Error", responseData.error || "Login failed");
        setLoading(false);
        return;
      }

      await AsyncStorage.setItem("userToken", responseData.data.token);
      await AsyncStorage.setItem("userName", responseData.data.name);
      await AsyncStorage.setItem("uid", responseData.data._id);
      await AsyncStorage.setItem("userType", "user");

      await registerForPushNotifications(responseData.data._id, responseData.data.token);

      if (responseData.data.pinnedShop) {
        await AsyncStorage.setItem("pinnedShop", responseData.data.pinnedShop);
      }
      router.replace("/(tabs)/menu");
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Something went wrong during login.");
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }
    
    setForgotPasswordLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/users/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to send OTP");
        setForgotPasswordLoading(false);
        return;
      }

      Alert.alert("Success", "OTP has been sent to your email address.");
      setForgotPasswordStep(2);
    } catch (error) {
      console.error("Forgot password error:", error);
      Alert.alert("Error", "Something went wrong while sending OTP.");
    }
    setForgotPasswordLoading(false);
  };

  const verifyOtpAndResetPassword = async () => {
    if (!otp) {
      Alert.alert("Error", "Please enter the OTP.");
      return;
    }
    
    if (!newPassword || !confirmNewPassword) {
      Alert.alert("Error", "Please enter and confirm your new password.");
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    
    setForgotPasswordLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/users/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotPasswordEmail,
          otp,
          newPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to reset password");
        setForgotPasswordLoading(false);
        return;
      }

      Alert.alert("Success", "Password has been reset successfully. You can now login with your new password.");
      resetForgotPasswordFlow();
    } catch (error) {
      console.error("Reset password error:", error);
      Alert.alert("Error", "Something went wrong while resetting password.");
    }
    setForgotPasswordLoading(false);
  };

  const resetForgotPasswordFlow = () => {
    setShowForgotPasswordModal(false);
    setForgotPasswordStep(1);
    setForgotPasswordEmail("");
    setOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const renderForgotPasswordModalContent = () => {
    switch (forgotPasswordStep) {
      case 1: // Email input
        return (
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Forgot Password</Text>
            <Text style={styles.modalSubtitle}>Enter your email address to receive a reset OTP</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Email"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={forgotPasswordEmail}
              onChangeText={setForgotPasswordEmail}
            />
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={resetForgotPasswordFlow}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]} 
                onPress={handleForgotPassword}
                disabled={forgotPasswordLoading}
              >
                {forgotPasswordLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      
      case 2: // OTP input
        return (
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify OTP</Text>
            <Text style={styles.modalSubtitle}>Enter the OTP sent to {forgotPasswordEmail}</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="OTP"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={otp}
              onChangeText={setOtp}
            />
            
            <TouchableOpacity onPress={() => setForgotPasswordStep(3)}>
              <Text style={styles.nextStepText}>Next</Text>
            </TouchableOpacity>
          </View>
        );
      
      case 3: // New password input
        return (
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set New Password</Text>
            
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.modalInput, styles.passwordInput]}
                placeholder="New Password"
                placeholderTextColor="#999"
                secureTextEntry={!passwordVisible}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setPasswordVisible(!passwordVisible)}
              >
                <Icon name={passwordVisible ? "visibility" : "visibility-off"} size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.modalInput, styles.passwordInput]}
                placeholder="Confirm New Password"
                placeholderTextColor="#999"
                secureTextEntry={!passwordVisible}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
              />
            </View>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setForgotPasswordStep(2)}
              >
                <Text style={styles.modalButtonText}>Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]} 
                onPress={verifyOtpAndResetPassword}
                disabled={forgotPasswordLoading}
              >
                {forgotPasswordLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <ImageBackground source={require("./image/bglogin.png")} style={styles.background}>
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Login</Text>

          <TextInput
            style={styles.input}
            placeholder=" Email"
            placeholderTextColor="rgb(0, 0, 0)"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
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

          <TouchableOpacity 
            style={styles.forgotPasswordButton} 
            onPress={() => setShowForgotPasswordModal(true)}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

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

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={resetForgotPasswordFlow}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {renderForgotPasswordModalContent()}
          </View>
        </View>
      </Modal>
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
    paddingRight: 45,
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
    marginBottom: 10,
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
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginBottom: 15,
  },
  forgotPasswordText: {
    color: "rgb(3, 75, 163)",
    fontWeight: "600",
    fontSize: 14,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#FFF",
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalContent: {
    width: "100%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  modalInput: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#f0f0f0",
    color: "#333",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#e0e0e0",
  },
  submitButton: {
    backgroundColor: "#1a1a1a",
  },
  modalButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  nextStepText: {
    color: "rgb(3, 75, 163)",
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
  },
});