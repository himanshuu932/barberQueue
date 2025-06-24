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
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";
import RatingModal from "../../components/user/RatingModal";

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
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
  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);

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
                    name: profile?.name || "",
                    email: profile?.email || ""
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
                  {
                    transform: [
                      { translateX: shineAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-200, screenWidth * 2.5],
                      }) },
                      { translateY: shineAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-200, screenHeight * 0.3],
                      }) },
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
        

        {/* Terms and Privacy Policy */}
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
                {selectedHistoryItem.isRated ? (
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Your Rating:</Text> {selectedHistoryItem.rating} <Icon name="star" size={screenWidth * 0.04} color="#FFD700" />
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
        onClose={() => {
          setIsRatingModalVisible(false);
          fetchProfileAndHistory();
        }}
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
  subscriptionText: {
    fontSize: screenWidth * 0.035,
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
    // paddingBottom: screenHeight * 0.02,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  infoGridItem: {
    // paddingVertical: screenHeight * 0.01,
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
  detailText: {
    fontSize: screenWidth * 0.042,
    marginBottom: screenHeight * 0.008,
    color: '#333',
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  detailServiceItem: {
    fontSize: screenWidth * 0.038,
    marginLeft: screenWidth * 0.03,
    marginBottom: screenHeight * 0.003,
    color: '#555',
  },
});