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
  Alert, // Keep Alert for other alerts, not for rating submission anymore
  ActivityIndicator,
  Modal,
  TextInput,
  ImageBackground,
  Linking,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";
import RatingModal from "../../components/user/RatingModal"; // Import the new RatingModal

const { height,width } = Dimensions.get('window');
const API_BASE = "https://numbr-p7zc.onrender.com/api";

export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [editedProfile, setEditedProfile] = useState({ name: "", email: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isHistoryDetailModalVisible, setIsHistoryDetailModalVisible] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false); // New state for rating modal

  const fetchProfileAndHistory = async () => {
    setLoading(true);
    try {
      const userToken = await AsyncStorage.getItem("userToken");
      if (!userToken) {
        router.replace("../pre-login");
        return;
      }

      // Fetch user profile
      const profileResponse = await fetch(`${API_BASE}/users/profile`, {
        headers: { "Authorization": `Bearer ${userToken}` },
      });
      const profileData = await profileResponse.json();

      // Fetch user history
      const historyResponse = await fetch(`${API_BASE}/history/me`, {
        headers: { "Authorization": `Bearer ${userToken}` },
      });
      const historyData = await historyResponse.json();

      setProfile({
        ...profileData.data,
        history: historyData.data,
      });

    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

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

  const confirmLogout = async () => {
    try {
      await AsyncStorage.removeItem("userToken");
      router.replace("../pre-login");
    } catch (error) {
      console.error("Error logging out:", error);
      Alert.alert("Error", "Failed to log out");
    } finally {
      setIsLogoutModalVisible(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editedProfile.name || !editedProfile.email) {
      Alert.alert("Error", "Both fields are required");
      return;
    }

    try {
      setIsUpdating(true);
      const userToken = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_BASE}/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}`,
        },
        body: JSON.stringify(editedProfile),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      Alert.alert("Success", "Profile updated successfully");
      fetchProfileAndHistory();
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  const formatTrialEndDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const showHistoryDetail = (item) => {
    setSelectedHistoryItem(item);
    setIsHistoryDetailModalVisible(true);
  };

  // Updated handleRateService to show the rating modal
  const handleRateService = () => {
    setIsHistoryDetailModalVisible(false); // Close history detail modal first
    setIsRatingModalVisible(true); // Open the rating modal
  };


  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollViewContent}>
          {/* Profile Card */}
          <View style={styles.profileBox}>
            <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
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

              <TouchableOpacity
                style={styles.logoutButton}
                onPress={() => setIsLogoutModalVisible(true)}
              >
                <Icon name="sign-out" size={25} color="white" />
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
                <View style={styles.profileDetails}>
                  <Text style={styles.username}>{profile?.name || "User Name"}</Text>
                  <Text style={styles.userInfo}>{profile?.email || profile?.phone || "N/A"}</Text>

                  {profile?.subscription?.status && (
                    <Text style={styles.subscriptionText}>
                      Subscription: {profile.subscription.status === 'trial' ? 'Trial' :
                      profile.subscription.status.charAt(0).toUpperCase() + profile.subscription.status.slice(1)}
                    </Text>
                  )}

                  {profile?.subscription?.status === 'trial' && profile?.subscription?.trialEndDate && (
                    <Text style={styles.subscriptionText}>
                      Trial Ends: {formatTrialEndDate(profile.subscription.trialEndDate)}
                    </Text>
                  )}
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Service History */}
          <View style={styles.serviceHistoryContainer}>
            <Text style={styles.sectionTitle}>Service History</Text>
            <View style={styles.historyBox}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} >
                {profile?.history?.length ? (
                  profile.history.map((item, index) => (
                    <TouchableOpacity key={index} style={styles.historyCard} onPress={() => showHistoryDetail(item)}>
                      <View style={styles.paymentRow}>
                        <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
                        <Text style={styles.paymentAmount}>₹{item.totalCost?.toFixed(2) || '0.00'}</Text>
                      </View>
                      <Text style={styles.historyService}>
                        {item.services?.map(s => s.name || 'Unknown Service').join(', ')}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noHistory}>No service history available.</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </ScrollView>

        {/* Terms and Privacy Policy - STICK TO BOTTOM */}
        <View style={styles.infoGrid}>
          <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.example.com/terms")}>
            <Text style={styles.infoLinkText}>Terms and Conditions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.example.com/privacy")}>
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
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={editedProfile.email}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, email: text })}
              />
            </View>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveProfile}
                disabled={isUpdating}
              >
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

      {/* History Detail Modal */}
      <Modal visible={isHistoryDetailModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Service Details</Text>
            {selectedHistoryItem && (
              <ScrollView>
                <Text style={styles.detailText}>
                  <Text style={styles.detailLabel}>Date:</Text> {new Date(selectedHistoryItem.date).toLocaleDateString()}
                </Text>
                <Text style={styles.detailText}>
                  <Text style={styles.detailLabel}>Total Cost:</Text> ₹{selectedHistoryItem.totalCost?.toFixed(2) || '0.00'}
                </Text>
                <Text style={styles.detailLabel}>Services:</Text>
                {selectedHistoryItem.services?.length > 0 ? (
                  selectedHistoryItem.services.map((s, idx) => (
                    <Text key={idx} style={styles.detailServiceItem}>
                      - {s.name || 'Unknown Service'} (₹{s.price?.toFixed(2) || 'N/A'}) x {s.quantity || 1}
                    </Text>
                  ))

                 ) : (
                  <Text style={styles.detailServiceItem}>No services listed.</Text>
                )}
                 <Text style={styles.detailServiceItem}>Barber: {selectedHistoryItem.barber?.name || 'Unknown'}</Text>
                <Text style={styles.detailServiceItem}>Shop: {selectedHistoryItem.shop?.name || 'Unknown'}</Text>
                {/* Conditional rendering for Rate Service button or rating display */}
                {selectedHistoryItem.isRated ? (
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Your Rating:</Text> {selectedHistoryItem.rating} <Icon name="star" size={16} color="#FFD700" />
                  </Text>
                ) : (
                  <View style={styles.modalButtonContainer}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.saveButton]}
                      onPress={handleRateService}
                    >
                      <Text style={styles.modalButtonText}>Rate Service</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsHistoryDetailModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rating Modal Component */}
      <RatingModal
        isVisible={isRatingModalVisible}
        onClose={() => {setIsRatingModalVisible(false);
        fetchProfileAndHistory();
          
        }} // RatingModal now calls onClose directly after submission
        // Removed onSubmit prop since RatingModal handles submission internally
        shopId={selectedHistoryItem?.shop?._id || null}
        barberId={selectedHistoryItem?.barber?._id || null}
        historyId={selectedHistoryItem?._id || null}
      />
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
    width: "100%",
    // No flexGrow here, let children manage
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: 20, // Adjust this as needed to account for the infoGrid at the bottom
    alignItems: "center",
    // Remove justifyContent: 'space-between' and flexGrow, as infoGrid is absolute
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  // Profile Card Styles
  profileBox: {
    width: '95%',
    height: width * 0.45,
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  profileBackground: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
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
    width: "100%",
    paddingHorizontal: 0,
  },
  profileImage: {
    width: width * 0.22,
    height: width * 0.22,
    borderRadius: (width * 0.22) / 2,
    borderWidth: 3,
    borderColor: "#eee",
    marginRight: 20,
  },
  profileDetails: {
    flex: 1,
  },
  username: {
    fontSize: width * 0.06,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
  },
  userInfo: {
    fontSize: width * 0.04,
    fontWeight: "400",
    color: "#f0f0f0",
    marginTop: 2,
  },
  subscriptionText: {
    fontSize: width * 0.035,
    color: "#f0f0f0",
    marginTop: 2,
  },
  editButton: {
    position: "absolute",
    top: 15,
    right: 60,
    padding: 8,
    borderRadius: 15,
    alignItems: "center",
    zIndex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 8,
    borderRadius: 15,
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  // Service History Styles
  serviceHistoryContainer: {
    flex: 1, // Crucial: This makes the history container fill available space
    width: "100%",
    alignItems: "center",
    marginBottom: 20, // Add margin to separate from bottom elements, adjust as needed
  },
  sectionTitle: {
    fontSize: width * 0.055,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
    alignSelf: 'flex-start',
    marginLeft: 10,
  },
  historyBox: {
    backgroundColor: "#fff",
    borderRadius: 15,
    width: "95%",
    padding: 15,
    maxHeight:height * 0.47,// Let the inner box also take available space within its container
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  historyCard: {
    backgroundColor: "#F0F0F0",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  historyDate: {
    fontSize: width * 0.038,
    color: "#666",
    fontWeight: '500',
  },
  paymentAmount: {
    fontSize: width * 0.045,
    fontWeight: "bold",
    color: "rgb(16, 120, 50)",
  },
  historyService: {
    fontSize: width * 0.04,
    color: "#555",
    marginTop: 3,
    lineHeight: 20,
  },
  noHistory: {
    fontSize: width * 0.042,
    color: "#999",
    textAlign: "center",
    marginTop: 20,
    fontStyle: 'italic',
  },
  // Company Info Styles (now for T&C and Privacy)
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    // Styles to stick to the bottom
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingBottom: 20, // Padding from the very bottom of the screen
    backgroundColor: 'transparent', // Ensure it doesn't obscure content above
    zIndex: 10, // Ensure it's above other elements if there's overlap
  },
  infoGridItem: {
    width: '45%',
    paddingVertical: 8,
    marginBottom: 10,
    alignItems: 'center', // Center text within each item
  },
  infoLinkText: {
    fontSize: width * 0.035,
    fontWeight: "bold",
    color: "#000000",
    textDecorationLine: "underline",
    textAlign: "center",
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
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 15,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  modalTitle: {
    fontSize: width * 0.055,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: '#333',
  },
  modalMessage: {
    fontSize: width * 0.045,
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    marginBottom: 5,
    fontSize: width * 0.04,
    fontWeight: "bold",
    color: "#333",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: width * 0.04,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 15,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 8,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: width * 0.045,
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#dc3545",
  },
  saveButton: {
    backgroundColor: "#28a745",
  },
  detailText: {
    fontSize: width * 0.042,
    marginBottom: 8,
    color: '#333',
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  detailServiceItem: {
    fontSize: width * 0.038,
    marginLeft: 10,
    marginBottom: 3,
    color: '#555',
  },
});