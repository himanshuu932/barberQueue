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
  Linking
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";

export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editedProfile, setEditedProfile] = useState({ name: "", email: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const API_BASE = "http://10.0.2.2:5000/api"; // Ensure this is correct for your setup

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
    outputRange: [-200, 900],
  });

  const shineTranslateY = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 250],
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
                  style={{ width: 25, height: 25, tintColor: "white" }}
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
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
              {profile?.history?.length ? (
                profile.history.map((item, index) => (
                  <View key={index} style={styles.historyCard}>
                    <View style={styles.paymentRow}>
                      <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
                      <Text style={styles.paymentAmount}>₹{item.totalCost?.toFixed(2) || '0.00'}</Text>
                    </View>
                    <Text style={styles.historyService}>
                      {item.services?.map(s => s.service?.name || 'Unknown Service').join(', ')}
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
    fontSize: 20, 
    fontWeight: "bold", 
    marginBottom: 10, 
    color: "#000",
  },
  serviceHistoryContainer: {
    width: "100%", 
    alignItems: "center", 
    marginBottom: 20, 
  },
  historyBox: {
    backgroundColor: "#fff", 
    borderRadius: 12, 
    width: "90%", 
    padding: 10, 
    maxHeight: 300,
    elevation: 5,
    overflow: "hidden",
  },
  historyCard: {
    backgroundColor: "#F9F9F9", 
    padding: 11, 
    borderRadius: 10, 
    marginBottom: 10, 
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
  editButton: {
    position: "absolute",
    top: 0,
    right: 5,
    padding: 3,
    borderRadius: 6,
    alignItems: "center"
  },
  container: {
    flex: 1,
    width: "100%",
  },
  header: {
    padding: 20,
    alignItems: "center",
  },
  profileBox: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
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
    width: 300,
    height: "300%",
  },
  shineGradient: {
    width: "100%",
    height: "100%",
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  paymentRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderColor: "#fff",
    borderWidth: 2,
    marginRight: 15,
  },
  profileDetails: {
    flex: 1,
  },
  username: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
  },
  userInfo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 2,
  },
  subscriptionText: { // New style for subscription info
    fontSize: 14,
    color: "#fff",
    marginTop: 2,
  },
  historyService: {
    fontSize: 15,
    color: "#777",
    marginTop: 4,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "rgb(16, 98, 13)",
  },
  historyDate: {
    fontSize: 14,
    color: "#555",
  },
  noHistory: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  footer: {
    padding: 8,
    alignItems: "center",
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  buttonContainer: {
    width: "90%",
  },
  button: {
    padding: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  companyContainer: {
    width: "90%",
    borderRadius: 10,
    overflow: "hidden",
    marginLeft: "5%",
    marginBottom: 80, // Increased margin to prevent touching logout button
  },
  companyBackground: {
    padding: 20,
    borderRadius: 12,
  },
  companyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  companyTagline: {
    fontSize: 16,
    color: "#ddd",
    marginBottom: 10,
    fontStyle: "italic",
    textAlign: "center",
  },
  companyDescription: {
    fontSize: 14,
    color: "#ccc",
    textAlign: "justify",
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  companyWebsite: {
    fontSize: 16,
    color: "#00aaff",
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "#444",
    width: "100%",
    marginVertical: 15,
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    justifyContent: "flex-start",
  },
  numberText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00aaff",
    marginLeft: 5,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  infoGridItem: {
    width: '48%',
    paddingVertical: 5,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  infoLinkText: {
    fontSize: 13,
    color: "#ADD8E6",
    textDecorationLine: "underline",
    textAlign: "left",
  },
});
