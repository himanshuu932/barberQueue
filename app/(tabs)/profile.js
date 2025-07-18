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
const API_BASE = "https://numbr-exq6.onrender.com/api";

export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [passwordStep, setPasswordStep] = useState(1); // 1 = initiate, 2 = confirm
  const [passwordData, setPasswordData] = useState({
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
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

const handleInitiatePasswordChange = async () => {
  // console.log("[Password Change] 1. Initiate function called");
  
  try {
    // console.log("[Password Change] 2. Setting loading state to true");
    setIsPasswordLoading(true);

    // console.log("[Password Change] 3. Retrieving user token from AsyncStorage");
    const userToken = await AsyncStorage.getItem("userToken");
    // console.log("[Password Change] 4. Retrieved token:", userToken ? "exists" : "missing");

    if (!userToken) {
      console.error("[Password Change] Error: No user token found");
      throw new Error("Authentication token missing");
    }

    // console.log("[Password Change] 5. Making API request to:", `${API_BASE}/users/change-password/initiate`);
    const startTime = Date.now();
    const response = await fetch(`${API_BASE}/users/change-password/initiate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
    });
    const responseTime = Date.now() - startTime;
    // console.log(`[Password Change] 6. API response received in ${responseTime}ms`);

    // console.log("[Password Change] 7. Response status:", response.status);
    // console.log("[Password Change] 8. Response ok:", response.ok);

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      console.error("[Password Change] 9. Error response:", errorResponse);
      throw new Error(errorResponse.message || "Failed to initiate password change");
    }

    const responseData = await response.json().catch(() => ({}));
    // console.log("[Password Change] 10. Success response:", responseData);

    Alert.alert("Success", "OTP sent to your registered email");
    // console.log("[Password Change] 11. Moving to step 2 (OTP confirmation)");
    setPasswordStep(2);
  } catch (error) {
    console.error("[Password Change] ERROR:", error);
    console.error("[Password Change] Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    let errorMessage = "Failed to initiate password change";
    if (error.message.includes("Network request failed")) {
      errorMessage = "Network error - please check your internet connection";
    } else if (error.message.includes("token")) {
      errorMessage = "Session expired - please login again";
    }

    Alert.alert("Error", errorMessage);
  } finally {
    // console.log("[Password Change] 12. Setting loading state to false");
    setIsPasswordLoading(false);
  }
};


  const handleConfirmPasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert("Error", "Passwords don't match");
      return;
    }

    try {
      setIsPasswordLoading(true);
      const userToken = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_BASE}/users/change-password/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          otp: passwordData.otp,
          newPassword: passwordData.newPassword
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to change password");
      }

      Alert.alert("Success", "Password changed successfully");
      setIsPasswordModalVisible(false);
      setPasswordStep(1);
      setPasswordData({
        otp: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error("Error changing password:", error);
      Alert.alert("Error", "Failed to change password. Please check your OTP.");
    } finally {
      setIsPasswordLoading(false);
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

  const handleRateService = () => {
    setIsHistoryDetailModalVisible(false);
    setIsRatingModalVisible(true);
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

              {/* [MODIFIED] Removed Change Password Button from here */}

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
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={editedProfile.email}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, email: text })}
              />
            </View>
            
            {/* [MODIFIED] Added Change Password link/button here */}
            <TouchableOpacity
              style={styles.changePasswordLink}
              onPress={() => {
                setIsModalVisible(false); // Hide edit modal
                setIsPasswordModalVisible(true); // Show password modal
              }}
            >
              <Text style={styles.changePasswordLinkText}>Change Password?</Text>
            </TouchableOpacity>

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

      {/* Change Password Modal */}
      <Modal visible={isPasswordModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {passwordStep === 1 ? 'Initiate Password Change' : 'Confirm New Password'}
            </Text>
            
            {passwordStep === 1 ? (
              <>
                <Text style={styles.modalMessage}>
                  We'll send an OTP to your registered email to verify your identity.
                </Text>
                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setIsPasswordModalVisible(false);
                      setPasswordStep(1);
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleInitiatePasswordChange}
                    disabled={isPasswordLoading}
                  >
                    {isPasswordLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalButtonText}>Send OTP</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>OTP</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter OTP"
                    value={passwordData.otp}
                    onChangeText={(text) => setPasswordData({...passwordData, otp: text})}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    value={passwordData.newPassword}
                    onChangeText={(text) => setPasswordData({...passwordData, newPassword: text})}
                    secureTextEntry
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChangeText={(text) => setPasswordData({...passwordData, confirmPassword: text})}
                    secureTextEntry
                  />
                </View>
                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setIsPasswordModalVisible(false);
                      setPasswordStep(1);
                      setPasswordData({
                        otp: '',
                        newPassword: '',
                        confirmPassword: ''
                      });
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleConfirmPasswordChange}
                    disabled={isPasswordLoading}
                  >
                    {isPasswordLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalButtonText}>Change Password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
          <View style={styles.detailModalContent}>
            <View style={styles.detailModalHeader}>
              <Text style={styles.detailModalTitle}>Service Details</Text>
              <TouchableOpacity 
                style={styles.detailModalCloseButton}
                onPress={() => setIsHistoryDetailModalVisible(false)}
              >
                <Icon name="times" size={screenWidth * 0.06} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedHistoryItem && (
              <ScrollView style={styles.detailScrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Icon name="calendar" size={screenWidth * 0.05} color="#666" style={styles.detailIcon} />
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Date: </Text> 
                      {new Date(selectedHistoryItem.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </View>

                  <View style={styles.detailDivider} />

                  <View style={styles.detailRow}>
                    <Icon name="money" size={screenWidth * 0.05} color="#666" style={styles.detailIcon} />
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Total Cost: </Text> 
                      <Text style={styles.detailAmount}>₹{selectedHistoryItem.totalCost?.toFixed(2) || '0.00'}</Text>
                    </Text>
                  </View>

                  <View style={styles.detailDivider} />

                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <Icon name="scissors" size={screenWidth * 0.05} color="#666" style={styles.detailIcon} />
                      <Text style={styles.detailSectionTitle}>Services</Text>
                    </View>
                    {selectedHistoryItem.services?.length > 0 ? (
                      selectedHistoryItem.services.map((s, idx) => (
                        <View key={idx} style={styles.serviceItem}>
                          <View style={styles.serviceInfo}>
                            <Text style={styles.serviceName}>• {s.name || 'Unknown Service'}</Text>
                            <Text style={styles.servicePrice}>₹{s.price?.toFixed(2) || 'N/A'}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noServicesText}>No services listed</Text>
                    )}
                  </View>

                  <View style={styles.detailDivider} />

                  <View style={styles.barberShopContainer}>
                    {/* Barber Section */}
                    <View style={styles.barberShopSection}>
                      <View style={styles.barberShopHeader}>
                        <Icon name="user" size={screenWidth * 0.05} color="#666" style={styles.detailIcon} />
                        <Text style={styles.barberShopLabel}>Barber</Text>
                      </View>
                      <Text style={styles.barberShopValue}>
                        {selectedHistoryItem.barber?.name || 'Unknown'}
                      </Text>
                    </View>

                    {/* Shop Section */}
                    <View style={styles.barberShopSection}>
                      <View style={styles.barberShopHeader}>
                        <Icon name="home" size={screenWidth * 0.05} color="#666" style={styles.detailIcon} />
                        <Text style={styles.barberShopLabel}>Shop</Text>
                      </View>
                      <Text style={styles.barberShopValue}>
                        {selectedHistoryItem.shop?.name || 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  {selectedHistoryItem.isRated ? (
                    <>
                      <View style={styles.detailDivider} />
                      <View style={styles.ratingdetailSection}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailSectionTitle}>Your Rating</Text>
                        </View>
                        <View style={styles.ratingContainer}>
                          <Text style={styles.ratingText}>{selectedHistoryItem.rating}</Text>
                          <Icon name="star" size={screenWidth * 0.05} color="#FFD700" />
                        </View>
                      </View>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.rateButton}
                      onPress={handleRateService}
                    >
                      <Text style={styles.rateButtonText}>Rate This Service</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
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
  changePasswordLink: {
    marginTop: 15,
    marginBottom: 5,
    alignItems: 'center',
  },
  changePasswordLinkText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: screenWidth * 0.04,
    textDecorationLine: 'underline',
  },
  barberShopContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: screenHeight * 0.02,
  },
  barberShopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.005,
  },
  barberShopLabel: {
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    color: '#333',
  },
  barberShopValue: {
    fontSize: screenWidth * 0.038,
    color: '#555',
  },
  ratingdetailSection: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  detailModalContent: {
    width: "90%",
    maxWidth: screenWidth * 0.9,
    backgroundColor: "#fff",
    borderRadius: screenWidth * 0.04,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: screenHeight * 0.005 },
    shadowOpacity: 0.2,
    shadowRadius: screenWidth * 0.02,
    maxHeight: screenHeight * 0.8,
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: screenWidth * 0.05,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailModalTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: '700',
    color: '#333',
  },
  detailModalCloseButton: {
    padding: screenWidth * 0.01,
  },
  detailScrollView: {
    paddingHorizontal: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.02,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: screenWidth * 0.03,
    padding: screenWidth * 0.04,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.01,
  },
  detailIcon: {
    marginRight: screenWidth * 0.03,
  },
  detailText: {
    fontSize: screenWidth * 0.042,
    color: '#555',
    lineHeight: screenHeight * 0.028,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#333',
  },
  detailAmount: {
    fontWeight: '700',
    color: '#28a745',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: screenHeight * 0.015,
  },
  detailSection: {
    marginBottom: screenHeight * 0.01,
  },
  detailSectionTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
    color: '#333',
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: screenHeight * 0.008,
    paddingHorizontal: screenWidth * 0.02,
    backgroundColor: '#f9f9f9',
    borderRadius: screenWidth * 0.02,
    marginBottom: screenHeight * 0.008,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceName: {
    fontSize: screenWidth * 0.038,
    color: '#555',
    flex: 1,
  },
  servicePrice: {
    fontSize: screenWidth * 0.038,
    fontWeight: '600',
    color: '#333',
    marginLeft: screenWidth * 0.02,
  },
  noServicesText: {
    fontSize: screenWidth * 0.038,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: screenHeight * 0.01,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: "baseline",
  },
  ratingText: {
    fontSize: screenWidth * 0.045,
    fontWeight: '700',
    color: '#FFD700',
    marginRight: screenWidth * 0.01,
  },
  rateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: screenHeight * 0.015,
    borderRadius: screenWidth * 0.02,
    marginTop: screenHeight * 0.02,
  },
  rateButtonText: {
    color: '#fff',
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    marginRight: screenWidth * 0.01,
  },
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