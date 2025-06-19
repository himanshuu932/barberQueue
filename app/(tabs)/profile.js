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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";

const { width } = Dimensions.get('window');
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

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
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
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

          {/* Company Info */}
          <View style={styles.companyContainer}>
            <LinearGradient colors={["#1a1a1a", "#2c2c2c", "#1a1a1a"]} style={styles.companyBackground}>
              <Text style={styles.companyTitle}>Bludgers Technologies</Text>
              <Text style={styles.companyTagline}>Innovating Daily Living</Text>
              <Text style={styles.companyDescription}>
                Bludgers Technologies is dedicated to crafting seamless and intuitive mobile applications,
                ensuring the best user experience with cutting-edge solutions.
              </Text>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL("mailto:bludgers52@gmail.com")}>
                <Text style={styles.companyWebsite}>📧 Mail: bludgers52@gmail.com</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL("tel:8601346652")}>
                <View style={styles.phoneContainer}>
                  <Icon name="phone" size={18} color="#00aaff" />
                  <Text style={styles.numberText}>Phone: 8601346652</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.divider} />
              <View style={styles.infoGrid}>
                <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.example.com/terms")}>
                  <Text style={styles.infoLinkText}>Terms and Conditions</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.example.com/privacy")}>
                  <Text style={styles.infoLinkText}>Privacy Policy</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </ScrollView>
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
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: 20,
    alignItems: "center",
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
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
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
    maxHeight: 280,
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
  // Company Info Styles
  companyContainer: {
    width: "95%",
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  companyBackground: {
    padding: 20,
    borderRadius: 15,
  },
  companyTitle: {
    fontSize: width * 0.065,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  companyTagline: {
    fontSize: width * 0.045,
    color: "#ddd",
    marginBottom: 15,
    fontStyle: "italic",
    textAlign: "center",
  },
  companyDescription: {
    fontSize: width * 0.04,
    color: "#ccc",
    textAlign: "justify",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  companyWebsite: {
    fontSize: width * 0.04,
    color: "#00c0ff",
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "#555",
    width: "80%",
    marginVertical: 18,
    alignSelf: 'center',
  },
  contactItem: {
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  numberText: {
    fontSize: width * 0.04,
    fontWeight: "bold",
    color: "#00c0ff",
    marginLeft: 8,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 15,
    paddingHorizontal: 10,
  },
  infoGridItem: {
    width: '45%',
    paddingVertical: 8,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  infoLinkText: {
    fontSize: width * 0.035,
    color: "#ADD8E6",
    textDecorationLine: "underline",
    textAlign: "left",
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
});