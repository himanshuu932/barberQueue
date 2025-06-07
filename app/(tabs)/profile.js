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
  Dimensions, // Import Dimensions for responsiveness
  PixelRatio, // Import PixelRatio for responsive fonts
  Platform,   // Import Platform for consistent structure
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";

// Get screen dimensions for responsive styling
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const fontScale = PixelRatio.getFontScale();

// Helper function for responsive font sizes
const getResponsiveFontSize = (size) => size / fontScale;


export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editedProfile, setEditedProfile] = useState({ name: "", email: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const API_BASE = "https://numbr-p7zc.onrender.com/api"; // Ensure this is correct for your setup

  // Fetch profile data and history
  const fetchProfileAndHistory = async () => {
    setLoading(true);
    try {
      const userToken = await AsyncStorage.getItem("userToken");
      if (!userToken) {
        console.warn("No userToken found in AsyncStorage. Redirecting to pre-login.");
        router.replace("../pre-login");
        return;
      }
      console.log("Retrieved userToken:", userToken); // For debugging: check if token is present

      // Fetch user profile
      const profileResponse = await fetch(`${API_BASE}/users/profile`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${userToken}`,
        },
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text(); // Get raw error text for debugging
        console.error(`Profile fetch failed with status: ${profileResponse.status}, response: ${errorText}`);
        throw new Error(`Profile fetch failed: ${profileResponse.status}`);
      }
      const profileData = await profileResponse.json();
      console.log("Profile Data:", profileData); // For debugging: check response structure

      // Fetch user history
      const historyResponse = await fetch(`${API_BASE}/history/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${userToken}`,
        },
      });

      if (!historyResponse.ok) {
        const errorText = await historyResponse.text(); // Get raw error text for debugging
        console.error(`History fetch failed with status: ${historyResponse.status}, response: ${errorText}`);
        throw new Error(`History fetch failed: ${historyResponse.status}`);
      }
      const historyData = await historyResponse.json();
      console.log("History Data:", historyData); // For debugging: check response structure

      setProfile({
        ...profileData.data, // Assuming profileData.data contains the user object
        history: historyData.data, // Assuming historyData.data contains the history array
      });

    } catch (error) {
      console.error("Error fetching profile or history:", error);
      Alert.alert("Error", "Failed to load profile or history. Please try again.");
      // Optionally, redirect to login or show an error screen
    } finally {
      setLoading(false);
    }
  };

  // Refresh profile and history data whenever the screen is focused.
  useFocusEffect(
    useCallback(() => {
      fetchProfileAndHistory();
    }, [])
  );

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
    outputRange: [-screenWidth * 0.5, screenWidth * 2.25], // Adjusted for responsiveness
  });

  const shineTranslateY = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenHeight * 0.25, screenHeight * 0.3], // Adjusted for responsiveness
  });

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("userToken");
      router.replace("../pre-login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Validate inputs and update the profile on the server.
  const handleSaveProfile = () => {
    if (!editedProfile.name || !editedProfile.email) {
      Alert.alert("Error", "Both fields are required.");
      return;
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(editedProfile.email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }
    updateUserProfile(editedProfile.name, editedProfile.email);
  };

  async function updateUserProfile(name, email) {
    const userToken = await AsyncStorage.getItem("userToken");
    if (!userToken) {
      Alert.alert("Error", "Authentication token missing.");
      return;
    }
    try {
      setIsUpdating(true);
      const response = await fetch(`${API_BASE}/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}`,
        },
        body: JSON.stringify({ name, email }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        Alert.alert("Update Failed", errorData.message || "An error occurred during profile update.");
        return;
      }
      await response.json();
      Alert.alert("Success", "Profile updated successfully.");
      fetchProfileAndHistory(); // Refresh profile info after update.
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error updating user profile:", error);
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setIsUpdating(false);
    }
  }

  const formatTrialEndDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString(); // Formats to local date string (e.g., "6/7/2025")
  };

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
      <View style={styles.container}>
        {/* Fixed header */}
        <View style={styles.header}>
          <View style={styles.profileBox}>
            <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  // Pre-fill the edit modal with current profile data.
                  setEditedProfile({
                    name: profile?.name || "",
                    email: profile?.email || ""
                  });
                  setIsModalVisible(true);
                }}
              >
                <Image
                  source={require("../image/editw.png")}
                  style={styles.editButtonImage} // Use responsive style
                />
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
                  {loading ? (
                    <ActivityIndicator size="large" color="#fff" />
                  ) : (
                    <View>
                      <Text style={styles.username}>{profile?.name || "User Name"}</Text>
                      <Text style={styles.userInfo}>{profile?.email || profile?.phone || "N/A"}</Text>
                      {/* Display Subscription Status */}
                      {profile?.subscription?.status && (
                        <Text style={styles.subscriptionText}>
                          Subscription: {profile.subscription.status === 'trial' ? 'Trial' : profile.subscription.status.charAt(0).toUpperCase() + profile.subscription.status.slice(1)}
                        </Text>
                      )}
                      {/* Display Trial End Date if status is trial */}
                      {profile?.subscription?.status === 'trial' && profile?.subscription?.trialEndDate && (
                        <Text style={styles.subscriptionText}>
                          Trial Ends: {formatTrialEndDate(profile.subscription.trialEndDate)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Scrollable history list */}
        <View style={styles.serviceHistoryContainer}>
          <Text style={styles.sectionTitle}>Service History</Text>
          <View style={styles.historyBox}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.historyScrollView}>
              {profile?.history?.length ? (
                profile.history.map((item, index) => (
                  <View key={index} style={styles.historyCard}>
                    <View style={styles.paymentRow}>
                      <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
                      <Text style={styles.paymentAmount}>₹{item.totalCost?.toFixed(2) || '0.00'}</Text>
                    </View>
                    <Text style={styles.historyService}>
                      {item.services?.map(s => s.name || 'Unknown Service').join(', ')}
                    </Text>
                    <Text style={styles.historyService}>Barber: {item.barber?.name || 'N/A'}</Text>
                    <Text style={styles.historyService}>Shop: {item.shop?.name || 'N/A'}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noHistory}>No service history available.</Text>
              )}
            </ScrollView>
          </View>
        </View>


        {/* Fixed logout button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.buttonContainer} onPress={handleLogout}>
            <LinearGradient colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} style={styles.button}>
              <Text style={styles.buttonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Edit Profile Modal */}
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
                placeholder="Email"
                value={editedProfile.email}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, email: text })}
              />
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={styles.modalButton} onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleSaveProfile} disabled={isUpdating}>
                  {isUpdating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: "bold",
    marginBottom: screenHeight * 0.012, // Responsive margin
    color: "#000",
  },
  serviceHistoryContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: screenHeight * 0.025, // Responsive margin
  },
  historyBox: {
    backgroundColor: "#fff",
    borderRadius: screenWidth * 0.03, // Responsive border radius
    width: "90%",
    padding: screenWidth * 0.025, // Responsive padding
    maxHeight: screenHeight * 0.35, // Responsive max height
    elevation: 5,
    overflow: "hidden",
  },
  historyScrollView: {
    maxHeight: '100%', // Ensure scroll view takes full height of its container
  },
  historyCard: {
    backgroundColor: "#F9F9F9",
    padding: screenWidth * 0.027, // Responsive padding
    borderRadius: screenWidth * 0.025, // Responsive border radius
    marginBottom: screenHeight * 0.012, // Responsive margin
    elevation: 3
  },
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
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: screenWidth * 0.85, // Responsive width
    backgroundColor: "#fff",
    padding: screenWidth * 0.05, // Responsive padding
    borderRadius: screenWidth * 0.025, // Responsive border radius
    elevation: 5,
  },
  modalTitle: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: "bold",
    marginBottom: screenHeight * 0.018, // Responsive margin
    textAlign: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: screenWidth * 0.012, // Responsive border radius
    padding: screenWidth * 0.025, // Responsive padding
    marginBottom: screenHeight * 0.012, // Responsive margin
    fontSize: getResponsiveFontSize(16), // Responsive font size
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: screenHeight * 0.012, // Responsive margin
  },
  modalButton: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    padding: screenWidth * 0.025, // Responsive padding
    borderRadius: screenWidth * 0.012, // Responsive border radius
    alignItems: "center",
    marginHorizontal: screenWidth * 0.012, // Responsive margin
  },
  modalButtonText: {
    color: "#fff",
    fontSize: getResponsiveFontSize(16), // Responsive font size
    fontWeight: "bold",
  },
  editButton: {
    position: "absolute",
    top: screenHeight * 0.006, // Responsive top position
    right: screenWidth * 0.012, // Responsive right position
    padding: screenWidth * 0.0075, // Responsive padding
    borderRadius: screenWidth * 0.015, // Responsive border radius
    alignItems: "center"
  },
  editButtonImage: {
    width: screenWidth * 0.062, // Responsive width
    height: screenWidth * 0.062, // Responsive height
    tintColor: "white",
  },
  container: {
    flex: 1,
    width: "100%",
  },
  header: {
    padding: screenWidth * 0.05, // Responsive padding
    alignItems: "center",
  },
  profileBox: {
    width: "100%",
    height: screenHeight * 0.18, // Responsive height
    borderRadius: screenWidth * 0.025, // Responsive border radius
    overflow: "hidden",
    marginBottom: screenHeight * 0.025, // Responsive margin
  },
  profileBackground: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    width: screenWidth * 0.75, // Responsive width
    height: screenHeight * 0.5, // Responsive height
  },
  shineGradient: {
    width: "100%",
    height: "100%",
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: screenWidth * 0.05, // Responsive padding
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  profileImage: {
    width: screenWidth * 0.2, // Responsive width
    height: screenWidth * 0.2, // Responsive height
    borderRadius: screenWidth * 0.1, // Responsive border radius
    borderColor: "#fff",
    borderWidth: screenWidth * 0.005, // Responsive border width
    marginRight: screenWidth * 0.037, // Responsive margin
  },
  profileDetails: {
    flex: 1,
  },
  username: {
    fontSize: getResponsiveFontSize(22),
    fontWeight: "900",
    color: "#fff",
  },
  userInfo: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: "bold",
    color: "#fff",
    marginTop: screenHeight * 0.002, // Responsive margin
  },
  subscriptionText: { // New style for subscription info
    fontSize: getResponsiveFontSize(14),
    color: "#fff",
    marginTop: screenHeight * 0.002, // Responsive margin
  },
  historyService: {
    fontSize: getResponsiveFontSize(15),
    color: "#777",
    marginTop: screenHeight * 0.005, // Responsive margin
  },
  paymentAmount: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: "bold",
    color: "rgb(16, 98, 13)",
  },
  historyDate: {
    fontSize: getResponsiveFontSize(14),
    color: "#555",
  },
  noHistory: {
    fontSize: getResponsiveFontSize(16),
    color: "#999",
    textAlign: "center",
    paddingVertical: screenHeight * 0.02, // Responsive padding
  },
  footer: {
    padding: screenWidth * 0.02, // Responsive padding
    alignItems: "center",
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  buttonContainer: {
    width: "90%",
  },
  button: {
    padding: screenHeight * 0.015, // Responsive padding
    alignItems: "center",
    borderRadius: screenWidth * 0.02, // Responsive border radius
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: getResponsiveFontSize(16),
    fontWeight: "bold",
  },
  companyContainer: {
    width: "90%",
    borderRadius: screenWidth * 0.025, // Responsive border radius
    overflow: "hidden",
    marginLeft: "5%",
    marginBottom: screenHeight * 0.1, // Responsive margin
  },
  companyBackground: {
    padding: screenWidth * 0.05, // Responsive padding
    borderRadius: screenWidth * 0.03, // Responsive border radius
  },
  companyTitle: {
    fontSize: getResponsiveFontSize(24),
    fontWeight: "bold",
    color: "#fff",
    marginBottom: screenHeight * 0.012, // Responsive margin
    textAlign: "center",
  },
  companyTagline: {
    fontSize: getResponsiveFontSize(16),
    color: "#ddd",
    marginBottom: screenHeight * 0.012, // Responsive margin
    fontStyle: "italic",
    textAlign: "center",
  },
  companyDescription: {
    fontSize: getResponsiveFontSize(14),
    color: "#ccc",
    textAlign: "justify",
    marginBottom: screenHeight * 0.018, // Responsive margin
    paddingHorizontal: screenWidth * 0.037, // Responsive padding
  },
  companyWebsite: {
    fontSize: getResponsiveFontSize(16),
    color: "#00aaff",
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "#444",
    width: "100%",
    marginVertical: screenHeight * 0.018, // Responsive margin
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: screenHeight * 0.012, // Responsive margin
    justifyContent: "flex-start",
  },
  numberText: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: "bold",
    color: "#00aaff",
    marginLeft: screenWidth * 0.012, // Responsive margin
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: screenHeight * 0.012, // Responsive margin
  },
  infoGridItem: {
    width: '48%',
    paddingVertical: screenHeight * 0.006, // Responsive padding
    marginBottom: screenHeight * 0.012, // Responsive margin
    alignItems: 'flex-start',
  },
  infoLinkText: {
    fontSize: getResponsiveFontSize(13),
    color: "#ADD8E6",
    textDecorationLine: "underline",
    textAlign: "left",
  },
});
