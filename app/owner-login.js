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

// API Base URL
const API_BASE = "http://10.0.2.2:5000";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Function to register push notifications
async function registerForPushNotifications(ownerId, token) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Push notifications permission is required to receive notifications."
      );
      return;
    }
    
    const expoPushToken = (await Notifications.getExpoPushTokenAsync({
        projectId: "fdeb8267-b069-40e7-9b4e-1a0c50ee6246",
    })).data;

    const userToken = await AsyncStorage.getItem("userToken");
    if (!userToken) {
        console.error("No user token found for push notification registration.");
        return;
    }

    await fetch(`${API_BASE}/api/owners/profile`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ expopushtoken: expoPushToken }),
    });

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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot password states
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1); // 1: email, 2: otp & new password
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/owners/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pass: password }),
      });

      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.message || "Login failed");
        setLoading(false);
        return;
      }
      
      await AsyncStorage.setItem("userToken", data.data.token);
      await AsyncStorage.setItem("userName", data.data.name);
      await AsyncStorage.setItem("uid", data.data._id);
      await AsyncStorage.setItem("userType", "owner");

      await registerForPushNotifications(data.data._id, data.data.token);

      router.replace("/(superadmin)/menu");
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
      const response = await fetch(`${API_BASE}/api/owners/forgot-password`, {
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
      setForgotPasswordStep(2); // Move to OTP and new password step
    } catch (error) {
      console.error("Forgot password error:", error);
      Alert.alert("Error", "Something went wrong while sending OTP.");
    } finally {
        setForgotPasswordLoading(false);
    }
  };

  const verifyOtpAndResetPassword = async () => {
    if (!otp || !newPassword || !confirmNewPassword) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    
    setForgotPasswordLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/owners/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail, otp, newPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to reset password");
        return;
      }

      Alert.alert("Success", "Password has been reset successfully. You can now login with your new password.");
      resetForgotPasswordFlow();
    } catch (error) {
      console.error("Reset password error:", error);
      Alert.alert("Error", "Something went wrong while resetting password.");
    } finally {
        setForgotPasswordLoading(false);
    }
  };

  const resetForgotPasswordFlow = () => {
    setShowForgotPasswordModal(false);
    setForgotPasswordStep(1);
    setForgotPasswordEmail("");
    setOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setForgotPasswordLoading(false);
  };

  const renderForgotPasswordModalContent = () => {
    if (forgotPasswordStep === 1) { // Step 1: Email Input
      return (
        <>
          <Text style={styles.modalTitle}>Forgot Password</Text>
          <Text style={styles.modalSubtitle}>Enter your email to receive a reset OTP.</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Email Address"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            value={forgotPasswordEmail}
            onChangeText={setForgotPasswordEmail}
          />
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={resetForgotPasswordFlow}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.submitButton]}
              onPress={handleForgotPassword}
              disabled={forgotPasswordLoading}
            >
              {forgotPasswordLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Send OTP</Text>}
            </TouchableOpacity>
          </View>
        </>
      );
    }

    if (forgotPasswordStep === 2) { // Step 2: OTP and New Password
      return (
        <>
          <Text style={styles.modalTitle}>Reset Password</Text>
          <Text style={styles.modalSubtitle}>Enter the OTP sent to {forgotPasswordEmail} and set a new password.</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="OTP"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={otp}
            onChangeText={setOtp}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="New Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Confirm New Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
          />
          <View style={styles.modalButtonContainer}>
             <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setForgotPasswordStep(1)}>
                 <Text style={styles.cancelButtonText}>Back</Text>
             </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.submitButton]}
              onPress={verifyOtpAndResetPassword}
              disabled={forgotPasswordLoading}
            >
              {forgotPasswordLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Reset Password</Text>}
            </TouchableOpacity>
          </View>
        </>
      );
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
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Login</Text>}
            </LinearGradient>
          </TouchableOpacity>
     <View style={styles.bottomLinksContainer}>
       <TouchableOpacity 
            style={styles.forgotPasswordButton} 
            onPress={() => setShowForgotPasswordModal(true)}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/owner-signup")}>
            <Text style={styles.registerText}>
           <Text style={styles.link}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={showForgotPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={resetForgotPasswordFlow}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              {renderForgotPasswordModalContent()}
            </View>
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
 forgotPasswordText: {
    color: "rgb(255, 255, 255)",
    fontWeight: "600", // Keep this for consistency
    fontSize: 16,     // Change to 16 for consistency with registerText
  },
  registerText: {
    marginTop: 0, // This margin might push it down, remove it or adjust
    fontSize: 16,
    fontWeight: "600", // Make it 600 for consistency
    color: "rgb(255, 255, 255)",
  },
  link: {
    color: "rgb(255, 255, 255)",
    fontWeight: "600", // You might want to keep this bolder for "Sign Up"
  },
  bottomLinksContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between", // This will push "Forgot Password?" to the start and "Sign Up" to the end
    alignItems: "center", // Vertically center them
    marginTop: 0, // Add a top margin to separate it from the login button
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContainer: {
    width: "90%",
    backgroundColor: "#FFF",
    borderRadius: 15,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalContent: {
    width: "100%",
    alignItems: 'center',
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
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#f0f2f5",
    color: "#333",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: 'center',
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 1},
    shadowRadius: 2,
  },
  cancelButton: {
    backgroundColor: "#f0f2f5",
    borderWidth: 1,
    borderColor: '#dcdfe6',
  },
  submitButton: {
    backgroundColor: "#2c3e50",
  },
  cancelButtonText: {
    color: '#333333',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
    textAlign: 'center',
  },
});
