import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";

export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    name: "",
    phone: "",
    expopushtoken: "",
  });
  const [ownerId, setOwnerId] = useState(null);
  const API_BASE = "http://10.0.2.2:5000";

  useFocusEffect(
    useCallback(() => {
      const getOwnerIdAndProfile = async () => {
        try {
          const token = await AsyncStorage.getItem("userToken");
          const uid = await AsyncStorage.getItem("uid");
        //  console.log("Token:", token);
          if (!uid) {
            console.error("Owner ID not found in AsyncStorage");
            return;
          }
          setOwnerId(uid);
          await fetchProfile(uid);
        } catch (error) {
          console.error("Error in useFocusEffect:", error);
        }
      };
      getOwnerIdAndProfile();
    }, [])
  );

  // Fetch owner profile by ownerId
  const fetchProfile = async (uid) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_BASE}/api/owners/profile`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
    //  console.log("Profile data:", data);
      setProfile(data.data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

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
      await AsyncStorage.removeItem("uid");
       await AsyncStorage.removeItem("userType");
        await AsyncStorage.removeItem("userName");
      router.replace("../pre-login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Update owner profile
  async function updateOwnerProfile() {
    try {
      const { name, phone, expopushtoken } = editedProfile;
      const token = await AsyncStorage.getItem("userToken");
      
      const response = await fetch(`${API_BASE}/api/owners/profile`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, phone, expopushtoken }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating profile:", errorData);
        Alert.alert("Error", errorData.message || "Failed to update profile");
        return;
      }
      
      const data = await response.json();
     // console.log("Profile updated successfully:", data);
      setIsModalVisible(false);
      fetchProfile(ownerId);
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile");
    }
  }

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.container}>
        <View style={styles.overlay} />
        {/* Fixed header */}
        <View style={styles.header}>
          <View style={styles.profileBox}>
            <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setEditedProfile({
                    name: profile?.name || "",
                    phone: profile?.phone || "",
                    expopushtoken: profile?.expopushtoken || "",
                  });
                  setIsModalVisible(true);
                }}
              >
                <Image source={require("../image/editw.png")} style={{ width: 25, height: 25, tintColor: "white" }} />
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
                      <Text style={styles.username}>{profile?.name || "Owner Name"}</Text>
                      <Text style={styles.userInfo}>Phone: {profile?.phone || "N/A"}</Text>
                      
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Company / Info Section */}
        <View style={styles.companyContainer}>
          <LinearGradient colors={["#1a1a1a", "#2c2c2c", "#1a1a1a"]} style={styles.companyBackground}>
            <Text style={styles.companyTitle}>Bludgers Technologies</Text>
            <Text style={styles.companyTagline}>Innovating Daily Living</Text>
            <Text style={styles.companyDescription}>
              Bludgers Technologies is dedicated to crafting seamless and intuitive mobile applications,
              ensuring the best user experience with cutting-edge solutions.
            </Text>
            <View style={styles.divider} />
            <TouchableOpacity onPress={() => Linking.openURL("mailto:bludgers52@gmail.com")}>
              <Text style={styles.companyWebsite}>📧 Mail: bludgers52@gmail.com</Text>
            </TouchableOpacity>
            <View style={styles.phoneContainer}>
              <TouchableOpacity onPress={() => Linking.openURL("tel:8601346652")}>
                <View style={styles.phoneContainer}>
                  <Icon name="phone" size={18} color="#00aaff" />
                  <Text style={styles.numberText}>Phone :- 8601346652</Text>
                </View>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Fixed logout button */}
        <View style={styles.footer}>
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

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  value={editedProfile.name}
                  onChangeText={(text) => {
                    setEditedProfile({ ...editedProfile, name: text });
                  }}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Phone"
                  value={editedProfile.phone}
                  keyboardType="phone-pad"
                  onChangeText={(text) => {
                    setEditedProfile({ ...editedProfile, phone: text });
                  }}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Expo Push Token</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Push Token"
                  value={editedProfile.expopushtoken}
                  onChangeText={(text) => {
                    setEditedProfile({ ...editedProfile, expopushtoken: text });
                  }}
                />
              </View>

              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={updateOwnerProfile}>
                  <Text style={styles.modalButtonText}>Save</Text>
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
  header: {
    padding: 20,
    alignItems: "center",
  },
  profileBox: {
    width: "100%",
    height: 180,
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
  editButton: {
    position: "absolute",
    top: 0,
    right: 5,
    padding: 3,
    borderRadius: 6,
    alignItems: "center",
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
  renewButton: {
    marginTop: 10,
    backgroundColor: "#28a745",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignSelf: "flex-start",
  },
  renewButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  companyContainer: {
    width: "90%",
    borderRadius: 10,
    overflow: "hidden",
    left: "5%",
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
  footer: {
    position: "absolute",
    width: "90%",
    bottom: 20,
    left: "5%",
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContainer: {
    width: "100%",
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
  inputContainer: {
    marginBottom: 10,
  },
  inputLabel: {
    marginBottom: 5,
    fontSize: 16,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  chooseLocationButton: {
    backgroundColor: "#000",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1e7e34",
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
  cancelButton: {},
  saveButton: {},
  locationPreview: {
    height: 150,
    marginBottom: 15,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  previewMap: {
    width: "100%",
    height: "100%",
  },
  locationPreviewPlaceholder: {
    height: 100,
    marginBottom: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  locationPreviewText: {
    color: "#888",
    marginTop: 5,
  },
  locationModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  locationModalContent: {
    width: "90%",
    height: "70%",
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
  },
  locationMap: {
    flex: 1,
  },
  locationModalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
  },
  planOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  radioButton: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#1a1a1a",
    marginRight: 10,
  },
  radioButtonSelected: {
    backgroundColor: "#1a1a1a",
  },
  planLabel: {
    fontSize: 16,
  },
});

export { TabProfileScreen };
