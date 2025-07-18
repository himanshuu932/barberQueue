import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: email entry, 2: OTP verification, 3: complete registration
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const API_BASE = "http://10.0.2.2:5000";

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSendOTP = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }
    
    if (!isValidEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || "Failed to send OTP");
      }

      setOtpSent(true);
      Alert.alert("Success", "OTP sent to your email");
      setStep(2); // Move to OTP verification step
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      Alert.alert("Error", "Please enter the OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || "OTP verification failed");
      }

      Alert.alert("Success", "Email verified successfully");
      setStep(3); // Move to registration details step
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!name || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password should be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, pass: password }),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || "Signup failed");
      }

      await AsyncStorage.setItem("userToken", responseData.data.token);
      await AsyncStorage.setItem("userName", responseData.data.name);
      await AsyncStorage.setItem("uid", responseData.data._id);
      await AsyncStorage.setItem("userType", "user");

      Alert.alert("Success", `Signed up as: ${responseData.data.email}`);
      router.replace("/login");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
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
        disabled={loading}
      >
        <LinearGradient
          colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {loading ? (
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
        disabled={loading}
      >
        <LinearGradient
          colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {loading ? (
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
        style={styles.buttonContainer}
        onPress={handleSignup}
        disabled={loading}
      >
        <LinearGradient
          colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
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
            {step === 1 ? "Sign Up" : step === 2 ? "Verify Email" : "Complete Registration"}
          </Text>

          {step === 1 && renderStepOne()}
          {step === 2 && renderStepTwo()}
          {step === 3 && renderStepThree()}

          {step === 1 && (
            <TouchableOpacity onPress={() => router.push("/login")}>
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
  registerText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: "500",
    color: "rgb(255, 255, 255)",
  },
  link: {
    color: "rgba(255, 255, 255, 1)",
    fontWeight: "900",
  },
  otpMessage: {
    color: "#FFFFFF",
    marginBottom: 15,
    textAlign: "center",
    width: "100%",
  },
});