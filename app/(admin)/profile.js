import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  ImageBackground,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const API_BASE_URL = "http://10.0.2.2:5000/api"; // Corrected API base URL

export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [barber, setBarber] = useState(null);
  const [history, setHistory] = useState([]); // New state for history
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [uid, setUid] = useState(null); // State to store barber's UID
  const [shopId, setShopId] = useState(null);
  const [userToken, setUserToken] = useState(null); // State to store user token

  // New states for editing profile and updating status
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editedProfile, setEditedProfile] = useState({ name: "", phone: "" }); // Removed email, using phone
  const [updating, setUpdating] = useState(false);

  // Fetch necessary data from AsyncStorage on mount
  useEffect(() => {
    const fetchDataFromStorage = async () => {
      const storedUid = await AsyncStorage.getItem("uid");
      const storedShopId = await AsyncStorage.getItem("shopId");
      const storedToken = await AsyncStorage.getItem("userToken");

      if (!storedUid) {
        setError("Barber ID not found in storage");
        setLoading(false);
        return;
      }
      if (!storedShopId) {
        setError("Shop ID not found in storage");
        setLoading(false);
        return;
      }
      if (!storedToken) {
        setError("User token not found in storage. Please log in again.");
        setLoading(false);
        return;
      }
      setUid(storedUid);
      setShopId(storedShopId);
      setUserToken(storedToken);
    };
    fetchDataFromStorage();
  }, []);

  const fetchBarberDetails = async () => {
    if (!uid || !shopId || !userToken) {
      return; // Wait for all necessary data to be loaded from AsyncStorage
    }

    try {
      const response = await fetch(`${API_BASE_URL}/barbers/${uid}`, { // Corrected API path
        headers: {
          'Authorization': `Bearer ${userToken}` // Pass authentication token
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch barber details");
      }
      const data = await response.json();
     // console.log("Fetched barber details:", data);
      setBarber(data.data);
      setLoading(false); // Only set loading to false after successful fetch
    } catch (error) {
      console.error("Error fetching barber details:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchBarberHistory = async () => {
    if (!uid || !userToken) {
      return; // Wait for all necessary data to be loaded from AsyncStorage
    }
    try {
      const response = await fetch(`${API_BASE_URL}/history/me`, { // Use /history/me for logged-in barber's history
        headers: {
          'Authorization': `Bearer ${userToken}` // Pass authentication token
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch history");
      }
      const data = await response.json();
      setHistory(data.data); // Assuming the history is in a 'data' field
    } catch (error) {
      console.error("Error fetching barber history:", error);
      // Don't set error state globally, as profile might still load
    }
  };

  // Fetch barber details and history when the screen is focused and all data is available
  useFocusEffect(
    React.useCallback(() => {
      if (uid && shopId && userToken) {
        fetchBarberDetails();
        fetchBarberHistory();
      }
    }, [uid, shopId, userToken]) // Re-run when these dependencies change
  );

  // Shine animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shineAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shineAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shineAnimation]);

  const shineTranslateX = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 900],
  });

  const shineTranslateY = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 250],
  });

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("userToken");
      await AsyncStorage.removeItem("userType");
      await AsyncStorage.removeItem("uid");
      await AsyncStorage.removeItem("shopId");
      router.replace("../pre-login");
    } catch (error) {
      console.error("Error logging out:", error);
      Alert.alert("Logout Error", "Failed to log out. Please try again.");
    }
  };

  // Function to update barber profile using the provided backend route
  const updateUserProfile = async () => {
    if (!barber?._id || !userToken) {
      Alert.alert("Error", "Missing barber ID or authentication token.");
      return;
    }

    try {
      setUpdating(true);
      const response = await fetch(`${API_BASE_URL}/barbers/${barber._id}`, { // Use PUT for updating a specific barber by ID
        method: "PUT", // Changed to PUT as per barberRoutes.js update route
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}` // Pass authentication token
        },
        body: JSON.stringify({
          name: editedProfile.name,
          phone: editedProfile.phone, // Changed from email to phone
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating barber profile:", errorData);
        Alert.alert("Error", errorData.error || "Failed to update profile");
        return;
      }
      const data = await response.json();
      setBarber(data.data); // Assuming the updated barber data is in 'data' field
      setIsModalVisible(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      console.error("Error updating barber profile:", error);
      Alert.alert("Error", "An error occurred while updating your profile.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
      <View style={styles.container}>
        <View style={styles.profileBox}>
          <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
            {/* Edit Button */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setEditedProfile({
                  name: barber?.name || "",
                  phone: barber?.phone || "", // Initialize with phone, not email
                });
                setIsModalVisible(true);
              }}
            >
              <Image
                source={require("../image/editw.png")}
                style={{ width: 25, height: 25, tintColor: "white" }}
              />
            </TouchableOpacity>
            <Animated.View
              style={[
                styles.shine,
                {
                  transform: [
                    { translateX: shineTranslateX },
                    { translateY: shineTranslateY },
                    { rotate: "45deg" },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={["transparent", "rgba(255, 255, 255, 0.3)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.shineGradient}
              />
            </Animated.View>
            <View style={styles.profileContent}>
              <Image source={require("../image/user.png")} style={styles.profileImage} />
              <View>
                <Text style={styles.username}>{barber?.name || "John Doe"}</Text>
                <Text style={styles.userInfo}>Phone: {barber?.phone || "+1 234 567 8900"}</Text>
                {/* Removed email display as it's not in the Barber model */}
                <Text style={styles.userInfo}>Customers Served: {barber?.customersServed || 0}</Text> 
                <Text style={styles.userInfo}>
                  Average Rating: {barber?.rating !== undefined ? barber.rating.toFixed(1) : "N/A"}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
        <View style={styles.paymentHistoryContainer}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          <View style={styles.paymentBox}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
              {(!history || history.length === 0) ? (
                <Text style={styles.noHistoryText}>No payment history available.</Text>
              ) : (
                history.map((item, index) => (
                  <View key={item._id || index} style={styles.paymentCard}> {/* Use item._id for key if available */}
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentDate}>{new Date(item.date).toLocaleDateString()}</Text>
                      <Text style={styles.paymentAmount}>₹{item.totalCost}</Text>
                    </View>
                    <Text style={styles.paymentDescription}>{item.services.map(s => s.service.name).join(', ')}</Text> {/* Assuming services is an array of objects with service.name */}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
        <TouchableOpacity style={styles.buttonContainer} onPress={handleLogout}>
          <LinearGradient colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} style={styles.button}>
            <Text style={styles.buttonText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      {/* Modal for editing profile */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={editedProfile.name}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone"
              value={editedProfile.phone}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, phone: text })} // Changed to phone
              keyboardType="phone-pad"
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={updateUserProfile} disabled={updating}>
                {updating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(237, 236, 236, 0.77)",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  errorText: {
    fontSize: 16,
    color: "red"
  },
  profileBox: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
    position: "relative"
  },
  profileBackground: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center"
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 300,
    height: "300%"
  },
  shineGradient: {
    width: "100%",
    height: "100%"
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#fff",
    marginRight: 15
  },
  username: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff"
  },
  userInfo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 2
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#000"
  },
  paymentHistoryContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: "auto",
  },
  paymentBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    padding: 10,
    maxHeight: 300,
    elevation: 5,
    overflow: "hidden",
  },
  paymentCard: {
    backgroundColor: "#F9F9F9",
    padding: 11,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 3
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  paymentDate: {
    fontSize: 14,
    color: "#555"
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "rgb(16, 98, 13)"
  },
  paymentDescription: {
    fontSize: 15,
    color: "#777",
    marginTop: 4
  },
  noHistoryText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginTop: 10,
  },
  buttonContainer: {
    position: "absolute",
    width: "90%",
    bottom:"-1%",
    marginBottom: "1.5%"
  },
  button: {
    padding: 12,
    alignItems: "center",
    borderRadius: 8
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold"
  },
  editButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 5,
    backgroundColor: "transparent",
    borderRadius: 5,
    zIndex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginHorizontal: 5,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});