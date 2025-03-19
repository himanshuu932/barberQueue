import React,{useState,useEffect} from "react";
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
export default function PreLoginScreen() {
  const router = useRouter();
// Add these state variables and useEffect inside your PreLoginScreen component:
const [isLoggedIn, setIsLoggedIn] = useState(null);
const [userType, setUserType] = useState(null);

useEffect(() => {
  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const type = await AsyncStorage.getItem("userType");
      setUserType(type);
      setIsLoggedIn(!!token);
      if (token) {
        if (type === "barber") {
          router.replace("/(admin)/menu");
        } else if (type === "superadmin") {
          router.replace("/(superadmin)/menu");
        } else {
          router.replace("/(tabs)/menu");
        }
      }
    } catch (error) {
      console.error("Error reading login status", error);
      setIsLoggedIn(false);
    }
  };
  checkLoginStatus();
}, [router]);

if (isLoggedIn === null) {
  // Optionally, return a loading indicator here
  return null;
}

  return (
    <ImageBackground
      source={require("./image/bglogin.png")} // Replace with your background image
      style={styles.background}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Welcome to Numbr</Text>
         
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/barber-login")}
          >
            <Text style={styles.buttonText}>Login as Barber</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.buttonText}>Login as User</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/owner-login")}
          >
            <Text style={styles.buttonText}>Login as Owner</Text>
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
  container: {
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
  subtitle: {
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 30,
  },
  button: {
    width: "100%",
    backgroundColor: "#3a3a3a",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});