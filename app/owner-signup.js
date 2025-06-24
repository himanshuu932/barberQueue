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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(""); // Changed from email to phone
  const [password, setPassword] = useState("");
  const [addressText, setAddressText] = useState("");
  const [expoPushToken, setExpoPushToken] = useState("");
  const [location, setLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  // New state for modal and selected location
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const API_BASE = "https://numbr-p7zc.onrender.com";

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
      projectId: "fdeb8267-b069-40e7-9b4e-1a0c50ee6246", // Use your Expo project ID
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

  // Request user location on component mount
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission to access location was denied");
        return;
      }
      try {
        let loc = await Location.getCurrentPositionAsync({});
        console.log("Fetched location:", loc);
        setLocation(loc);
        // Also initialize selectedLocation to current location for convenience
        setSelectedLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (error) {
        console.error("Error fetching location:", error);
      }
    })();
  }, []);

  const handleSignup = async () => {
    if (!name || !phone || !password) { // Changed from email to phone
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    // Address is not directly part of owner registration in the provided backend,
    // but the UI has it. If this is for a shop owner, the shop creation would handle address.
    // For now, I'll remove the address check for owner signup as per backend.
    // If address is intended for the owner, the Owner model would need an address field.

    setIsLoading(true);
    try {
      // The `ownerController.js` does not handle `address` or `expoPushToken` during registration directly.
      // `expopushtoken` is handled via `updateOwnerProfile`.
      // `address` would typically be part of a `Shop` model.
      // For now, only sending `name`, `phone`, `pass` as per `registerOwner` controller.

      const response = await fetch(`${API_BASE}/api/owners/register`, { // Corrected endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, pass: password }), // Corrected fields
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.message || "Signup failed"); // Use data.message
        setIsLoading(false);
        return;
      }
      console.log("Signup successful:", data);

      await AsyncStorage.setItem("userToken", data.data.token); // Access token from data.data
      await AsyncStorage.setItem("userName", data.data.name); // Access name from data.data
      await AsyncStorage.setItem("uid", data.data._id); // Store owner ID
      let userType = "owner";
      await AsyncStorage.setItem("userType", userType);

      // Now update the owner's profile with the push token
      if (expoPushToken) {
        const updateResponse = await fetch(`${API_BASE}/api/owners/profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.data.token}`, // Use the newly received token
          },
          body: JSON.stringify({ expopushtoken: expoPushToken }),
        });
        if (!updateResponse.ok) {
          const updateErrorData = await updateResponse.json();
          console.error("Error updating owner push token:", updateErrorData);
          Alert.alert("Push Token Error", `Failed to register push token: ${updateErrorData.message || "Unknown error"}`);
        } else {
          console.log("Owner push token updated successfully.");
        }
      }

      Alert.alert("Success", `Signed up as: ${data.data.phone}`); // Use phone for alert
      router.replace("/owner-login"); // Redirect to login after successful signup
    } catch (error) {
      console.error("Signup error:", error);
      Alert.alert("Error", "Something went wrong during signup.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler when user confirms location in modal
  const confirmLocationSelection = () => {
    if (selectedLocation) {
      // Update main location state with the chosen location
      setLocation({ coords: selectedLocation });
      setIsLocationModalVisible(false);
      // You might want to reverse geocode the selected location to get a human-readable address
      // and set it to `addressText` here.
      // For this example, we'll just keep the coordinates.
    } else {
      Alert.alert("Please select a location on the map.");
    }
  };

  return (
    <ImageBackground source={require("./image/bglogin.png")} style={styles.background}>
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Owner Sign Up</Text> {/* Changed title to Owner Sign Up */}

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
            placeholder="Phone Number" // Changed from email to phone
            placeholderTextColor="rgb(0, 0, 0)"
            keyboardType="phone-pad" // Changed keyboardType
            autoCapitalize="none"
            value={phone}
            onChangeText={setPhone} // Changed setter
          />

          {/* Address field with locate icon on the right */}
          {/* Keep this section if shops will be created immediately after owner signup with this address */}
          {/* Note: The current backend owner registration doesn't take address, this would be for shop creation */}
          <View style={styles.addressContainer}>
            <TextInput
              style={styles.addressInput}
              placeholder="Address (for your shop)" // Clarified placeholder
              placeholderTextColor="rgb(0, 0, 0)"
              value={addressText}
              onChangeText={setAddressText}
            />
            <TouchableOpacity
              style={styles.locateButton}
              onPress={() => setIsLocationModalVisible(true)}
            >
              <Ionicons name="location-outline" size={24} color="white" />
            </TouchableOpacity>
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
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/owner-login")}>
            <Text style={styles.registerText}>
              Already have an account? <Text style={styles.link}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal for choosing location */}
      <Modal visible={isLocationModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Your Location</Text>
            {location || selectedLocation ? (
              <MapView
                style={styles.modalMap}
                initialRegion={{
                  latitude: selectedLocation ? selectedLocation.latitude : (location ? location.coords.latitude : 0),
                  longitude: selectedLocation ? selectedLocation.longitude : (location ? location.coords.longitude : 0),
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={(e) => setSelectedLocation(e.nativeEvent.coordinate)}
              >
                {selectedLocation && <Marker coordinate={selectedLocation} />}
              </MapView>
            ) : (
              <Text style={styles.locationText}>Fetching current location...</Text>
            )}
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setIsLocationModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={confirmLocationSelection}>
                <Text style={styles.modalButtonText}>Confirm</Text>
              </TouchableOpacity>
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