import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ImageBackground,
  Linking,
  Dimensions,
  Platform // Import Dimensions
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";

const API_BASE_URL = "http://10.0.2.2:5000/api"; // Corrected API base URL

// Get screen width for responsive calculations
const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [barber, setBarber] = useState(null);
  const [history, setHistory] = useState([]); // New state for history
  const [loading, setLoading] = useState(true); // Corrected this line
  const [error, setError] = useState(null);

  const [uid, setUid] = useState(null); // State to store barber's UID
  const [shopId, setShopId] = useState(null);
  const [userToken, setUserToken] = useState(null); // State to store user token

  // New states for editing profile and updating status
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editedProfile, setEditedProfile] = useState({ name: "", phone: "" }); // Removed email, using phone
  const [updating, setUpdating] = useState(false);

  // New state for logout confirmation modal
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

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
    
      setBarber(data.data);
      setLoading(false); // Only set loading to false after successful fetch
    } catch (error) {
      console.error("Error fetching barber details:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchBarberHistory = async () => {
    if (!uid || !userToken) return;

    try {
      const response = await fetch(`${API_BASE_URL}/history/barber/${uid}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        },
      });

      if (!response.ok) throw new Error('Failed to fetch history');

      const data = await response.json();


      const validatedHistory = (data.data || []).map(item => ({
        ...item,
        services: (item.services || []).map(s => ({
          ...s,
          service: { name: s.name || 'Unknown service' }
        })),
        user: item.user || null,
        customerName: item.customerName || null,
        shop: item.shop || { name: 'N/A' }
      }));

  
      setHistory(validatedHistory);
    } catch (error) {
      console.error("Error fetching barber history:", error);
      setHistory([]);
    }
  };


  // Fetch barber details and history when the screen is focused and all data is available
  useFocusEffect(
    useCallback(() => {
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
    outputRange: [-screenWidth * 0.5, screenWidth * 1.8],
  });

  const shineTranslateY = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenHeight * 0.9, screenHeight * 0.3],
  });

  const confirmLogout = async () => {
    try {
     await AsyncStorage.removeItem("userToken");
            await AsyncStorage.removeItem("uid");
            await AsyncStorage.removeItem("userType");
            await AsyncStorage.removeItem("userName");
      await AsyncStorage.removeItem("shopId");
      router.replace("../pre-login");
    } catch (error) {
      console.error("Error logging out:", error);
      Alert.alert("Logout Error", "Failed to log out. Please try again.");
    } finally {
      setIsLogoutModalVisible(false); // Close the modal regardless of success or failure
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

  // In the barber profile file (replace the return statement with this):

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage} resizeMode="cover">
      <View style={styles.overlay} />
      <View style={styles.container}>
        {/* Profile Card */}
        <View style={styles.profileBox}>
          <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setEditedProfile({
                  name: barber?.name || "",
                  phone: barber?.phone || ""
                });
                setIsModalVisible(true);
              }}
            >
              <Image
                source={require("../image/editw.png")}
                style={{ width: screenWidth * 0.06, height: screenWidth * 0.06, tintColor: "white" }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => setIsLogoutModalVisible(true)}
            >
              <Icon name="sign-out" size={screenWidth * 0.06} color="white" />
            </TouchableOpacity>

            <Animated.View
              style={[
                styles.shine,
                { transform: [{ translateX: shineTranslateX }, { translateY: shineTranslateY }, { rotate: "45deg" }] },
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
              <View style={styles.profileDetails}>
                <Text style={styles.username}>{barber?.name || "Barber Name"}</Text>
                <Text style={styles.userInfo}>{barber?.email|| "N/A"}</Text>
                <Text style={styles.userInfo}>Customers Served: {barber?.customersServed || 0}</Text>
                <Text style={styles.userInfo}>
                  Average Rating: {barber?.rating !== undefined ? barber.rating.toFixed(1) : "N/A"} ⭐ 
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Service History */}
        <View style={styles.serviceHistoryContainer}>
          <Text style={styles.sectionTitle}>Service History</Text>
          <View style={styles.historyBox}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {(!history || history.length === 0) ? (
                <Text style={styles.noHistory}>No service history available.</Text>
              ) : (
                history.map((item, index) => (
                  <TouchableOpacity key={item._id || index} style={styles.historyCard}>
                    <View style={styles.paymentRow}>
                      <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
                      <Text style={styles.paymentAmount}>₹{item.totalCost?.toFixed(2) || '0.00'}</Text>
                    </View>
                    <Text style={styles.historyService}>
                      {item.services.map(s => s.name || 'Unknown Service').join(', ')}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>

        {/* Terms and Privacy Policy */}
        <View style={styles.infoGrid}>
          <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.numbrapp.in/terms")}>
            <Text style={styles.infoLinkText}>Terms and Conditions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.numbrapp.in/privacy")}>
            <Text style={styles.infoLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit Profile Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={editedProfile.name}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone"
                value={editedProfile.phone}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, phone: text })}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={updateUserProfile}
                disabled={updating}
              >
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

      {/* Logout Confirmation Modal */}
      <Modal visible={isLogoutModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Logout</Text>
            <Text style={styles.modalMessage}>Are you sure you want to log out?</Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#FF6347' }]}
                onPress={() => setIsLogoutModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#1a1a1a' }]}
                onPress={confirmLogout}
              >
                <Text style={styles.modalButtonText}>Logout</Text>
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
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(237, 236, 236, 0.77)",
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? screenHeight * 0.06 : screenHeight * 0.04,
    paddingHorizontal: screenWidth * 0.04,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  // Profile Card Styles
  profileBox: {
    width: '100%',
    height: screenHeight * 0.20,
    borderRadius: screenWidth * 0.04,
    overflow: "hidden",
    marginBottom: screenHeight * 0.02,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: screenHeight * 0.005 },
    shadowOpacity: 0.3,
    shadowRadius: screenWidth * 0.02,
  },
  profileBackground: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: screenWidth * 0.05,
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    width: screenWidth * 0.8,
    height: screenHeight * 1.5,
  },
  shineGradient: {
    width: "100%",
    height: "100%"
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  profileImage: {
    width: screenWidth * 0.22,
    height: screenWidth * 0.22,
    borderRadius: screenWidth * 0.11,
    borderWidth: screenWidth * 0.007,
    borderColor: "#eee",
    marginRight: screenWidth * 0.05,
  },
  profileDetails: {
    flex: 1,
  },
  username: {
    fontSize: screenWidth * 0.06,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: screenHeight * 0.005,
  },
  userInfo: {
    fontSize: screenWidth * 0.04,
    fontWeight: "400",
    color: "#f0f0f0",
    marginTop: screenHeight * 0.002,
  },
  editButton: {
    position: "absolute",
    top: screenHeight * 0.02,
    right: screenWidth * 0.15,
    padding: screenWidth * 0.02,
    borderRadius: screenWidth * 0.04,
    alignItems: "center",
    zIndex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutButton: {
    position: 'absolute',
    top: screenHeight * 0.02,
    right: screenWidth * 0.04,
    padding: screenWidth * 0.02,
    borderRadius: screenWidth * 0.04,
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  // Service History Styles
  serviceHistoryContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: screenHeight * 0.02,
  },
  sectionTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: "bold",
    marginBottom: screenHeight * 0.015,
    color: "#333",
    alignSelf: 'flex-start',
    marginLeft: screenWidth * 0.03,
  },
  historyBox: {
    backgroundColor: "#fff",
    borderRadius: screenWidth * 0.04,
    width: "100%",
    padding: screenWidth * 0.04,
    maxHeight: screenHeight * 0.45,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: screenHeight * 0.005 },
    shadowOpacity: 0.2,
    shadowRadius: screenWidth * 0.015,
  },
  historyCard: {
    backgroundColor: "#F0F0F0",
    padding: screenWidth * 0.04,
    borderRadius: screenWidth * 0.03,
    marginBottom: screenHeight * 0.01,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: screenHeight * 0.002 },
    shadowOpacity: 0.1,
    shadowRadius: screenWidth * 0.008,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: screenHeight * 0.005,
  },
  historyDate: {
    fontSize: screenWidth * 0.038,
    color: "#666",
    fontWeight: '500',
  },
  paymentAmount: {
    fontSize: screenWidth * 0.045,
    fontWeight: "bold",
    color: "rgb(16, 120, 50)",
  },
  historyService: {
    fontSize: screenWidth * 0.04,
    color: "#555",
    marginTop: screenHeight * 0.003,
    lineHeight: screenHeight * 0.025,
  },
  noHistory: {
    fontSize: screenWidth * 0.042,
    color: "#999",
    textAlign: "center",
    marginTop: screenHeight * 0.02,
    fontStyle: 'italic',
  },
  // Info Grid Styles
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: screenHeight * 0.01,
    width: '100%',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  infoGridItem: {
    alignItems: 'center',
    marginLeft: screenWidth * 0.07
  },
  infoLinkText: {
    fontSize: screenWidth * 0.035,
    fontWeight: "bold",
    color: "#000000",
    textDecorationLine: "underline",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    width: "88%",
    maxWidth: screenWidth * 0.9,
    backgroundColor: "#fff",
    padding: screenWidth * 0.06,
    borderRadius: screenWidth * 0.04,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: screenHeight * 0.005 },
    shadowOpacity: 0.25,
    shadowRadius: screenWidth * 0.015,
  },
  modalTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: "bold",
    marginBottom: screenHeight * 0.02,
    textAlign: "center",
    color: '#333',
  },
  modalMessage: {
    fontSize: screenWidth * 0.045,
    textAlign: 'center',
    marginBottom: screenHeight * 0.02,
    color: '#555',
  },
  inputContainer: {
    marginBottom: screenHeight * 0.015,
  },
  inputLabel: {
    marginBottom: screenHeight * 0.005,
    fontSize: screenWidth * 0.04,
    fontWeight: "bold",
    color: "#333",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: screenWidth * 0.02,
    padding: screenWidth * 0.03,
    fontSize: screenWidth * 0.04,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: screenHeight * 0.015,
  },
  modalButton: {
    flex: 1,
    padding: screenHeight * 0.015,
    borderRadius: screenWidth * 0.02,
    alignItems: "center",
    marginHorizontal: screenWidth * 0.02,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: screenWidth * 0.045,
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#dc3545",
  },
  saveButton: {
    backgroundColor: "#28a745",
  },
});