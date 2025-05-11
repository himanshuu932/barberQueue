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
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";

export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  // Add the missing state for the location picker modal:
  const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false);
  
  // editedProfile holds name, email, and an address object (textData, x, and y)
  const [editedProfile, setEditedProfile] = useState({
    name: "",
    email: "",
    address: { textData: "", y: 0, x: 0 },
  });
  const [shopId, setShopId] = useState(null);
  const API_BASE = "https://servercheckbarber-2u89.onrender.com";
  // State to track location picked in map modal
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Define the available payment plans
  const plans = [
    { id: "monthly", label: "Monthly - ₹241", value: 241 },
    { id: "quarterly", label: "Quarterly - ₹700", value: 700 },
    { id: "halfYearly", label: "Half-Yearly - ₹2790", value: 2790 },
    { id: "yearly", label: "Yearly - ₹5500", value: 5500 },
  ];

  // Dummy payment initiation function – replace with your payment gateway integration
  const initiatePayment = async (planId) => {
    const selectedPlanData = plans.find((plan) => plan.id === planId);
    if (!selectedPlanData) {
      Alert.alert("Please select a plan");
      return;
    }
    console.log("Initiating payment for plan:", selectedPlanData);
    // Replace the following with your payment gateway code
    Alert.alert("Payment", `Payment initiated for ${selectedPlanData.label}`);
    // After payment, you may want to update trial status and close the modal:
    setPaymentModalVisible(false);
  };

  useFocusEffect(
    useCallback(() => {
      const getShopIdAndProfile = async () => {
        try {
          const uid = await AsyncStorage.getItem("uid");
          if (!uid) {
            console.error("Shop ID not found in AsyncStorage");
            return;
          }
          setShopId(uid);
          await fetchProfile(uid);
        } catch (error) {
          console.error("Error in useFocusEffect:", error);
        }
      };
      getShopIdAndProfile();
    }, [])
  );

  // Fetch profile by shopId
  const fetchProfile = async (uid) => {
    try {
      const response = await fetch(`${API_BASE}/shop/profile?id=${uid}`, {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setProfile(data);
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
      router.replace("../pre-login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // When "Fetch Current Location" is pressed, update the form's coordinate values.
  const handleGetCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission to access location was denied");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setEditedProfile((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          x: location.coords.latitude,
          y: location.coords.longitude,
        },
      }));
      Alert.alert("Location fetched", "Coordinates have been updated.");
    } catch (error) {
      console.error("Error fetching location:", error);
      Alert.alert("Error", "Unable to fetch location.");
    }
  };

  // Update user profile (including updated address coordinates) using the shopId
  async function updateUserProfile() {
    try {
      const { name, email, address } = editedProfile;
      console.log("Updating user profile with details:", { shopId, name, email, address });
      const response = await fetch(`${API_BASE}/shop/profile/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, name, email, address }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating user profile:", errorData);
        return;
      }
      const data = await response.json();
      console.log("User profile updated successfully:", data);
      setIsModalVisible(false);
      fetchProfile(shopId);
    } catch (error) {
      console.error("Error updating user profile:", error);
    }
  }

  const LocationPreview = () => {
    if (!editedProfile.address.x || !editedProfile.address.y) {
      return (
        <View style={styles.locationPreviewPlaceholder}>
          <Icon name="map-marker" size={24} color="#888" />
          <Text style={styles.locationPreviewText}>No location selected</Text>
        </View>
      );
    }

    return (
      <View style={styles.locationPreview}>
        <MapView
          style={styles.previewMap}
          region={{
            latitude: editedProfile.address.x,
            longitude: editedProfile.address.y,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          <Marker coordinate={{ latitude: editedProfile.address.x, longitude: editedProfile.address.y }} />
        </MapView>
      </View>
    );
  };

  const handleOpenLocationPicker = async () => {
    let defaultLocation;
    if (editedProfile.address.x && editedProfile.address.y) {
      defaultLocation = {
        latitude: editedProfile.address.x,
        longitude: editedProfile.address.y,
      };
    } else if (profile?.address?.x && profile?.address?.y) {
      defaultLocation = {
        latitude: profile.address.x,
        longitude: profile.address.y,
      };
    } else {
      const currentLocation = await Location.getCurrentPositionAsync({});
      defaultLocation = currentLocation
        ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }
        : { latitude: 26.7282867, longitude: 83.4410984 };
    }
    setSelectedLocation(defaultLocation);
    setIsLocationPickerVisible(true);
  };

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
                    email: profile?.email || "",
                    address: profile?.address || { textData: "", x: 0, y: 0 },
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
                      <Text style={styles.username}>{profile?.name || "User Name"}</Text>
                      <Text style={styles.userInfo}>Username: {profile?.email || "N/A"}</Text>
                      <Text style={styles.userInfo}>Status: {profile?.trialStatus || "N/A"}</Text>
                      <Text style={styles.userInfo}>
                        Ends on:{" "}
                        {profile?.trialEndDate
                          ? new Date(profile.trialEndDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "N/A"}
                      </Text>
                      <Text style={styles.userInfo}>Address: {profile?.address?.textData || ""}</Text>
                      {/* Conditionally render Renew button if trial is expired */}
                      {profile?.trialStatus?.toLowerCase() === "expired" && (
                        <TouchableOpacity style={styles.renewButton} onPress={() => setPaymentModalVisible(true)}>
                          <Text style={styles.renewButtonText}>Renew</Text>
                        </TouchableOpacity>
                      )}
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
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={editedProfile.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onChangeText={(text) => {
                    setEditedProfile({ ...editedProfile, email: text });
                  }}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Address"
                  value={editedProfile.address.textData}
                  onChangeText={(text) => {
                    setEditedProfile({ ...editedProfile, address: { ...editedProfile.address, textData: text } });
                  }}
                />
              </View>

              <LocationPreview />

              <TouchableOpacity style={styles.chooseLocationButton} onPress={handleOpenLocationPicker}>
                <Icon name="map-marker" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.modalButtonText}>Choose Location on Map</Text>
              </TouchableOpacity>

              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={updateUserProfile}>
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal for picking location on map */}
        <Modal visible={isLocationPickerVisible} transparent animationType="slide">
          <View style={styles.locationModalContainer}>
            <View style={styles.locationModalContent}>
              <MapView
                style={styles.locationMap}
                initialRegion={{
                  latitude: selectedLocation
                    ? selectedLocation.latitude
                    : profile && profile.address.x
                    ? profile.address.x
                    : 26.7282867,
                  longitude: selectedLocation
                    ? selectedLocation.longitude
                    : profile && profile.address.y
                    ? profile.address.y
                    : 83.4410984,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setSelectedLocation({ latitude, longitude });
                }}
              >
                <Marker
                  coordinate={
                    selectedLocation || {
                      latitude: profile && profile.address.x ? profile.address.x : 26.7282867,
                      longitude: profile && profile.address.y ? profile.address.y : 83.4410984,
                    }
                  }
                />
              </MapView>
              <View style={styles.locationModalButtons}>
                <TouchableOpacity style={[styles.modalButton, { flex: 1 }]} onPress={() => setIsLocationPickerVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { flex: 1 }]}
                  onPress={() => {
                    if (selectedLocation) {
                      setEditedProfile((prev) => ({
                        ...prev,
                        address: { ...prev.address, x: selectedLocation.latitude, y: selectedLocation.longitude },
                      }));
                      setIsLocationPickerVisible(false);
                    } else {
                      Alert.alert("No location selected", "Please tap on the map to choose a location.");
                    }
                  }}
                >
                  <Text style={styles.modalButtonText}>Save Location</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Payment Modal */}
        <Modal visible={isPaymentModalVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Choose a Payment Plan</Text>
              {plans.map((plan) => (
                <TouchableOpacity key={plan.id} style={styles.planOption} onPress={() => setSelectedPlan(plan.id)}>
                  <View style={[styles.radioButton, selectedPlan === plan.id && styles.radioButtonSelected]} />
                  <Text style={styles.planLabel}>{plan.label}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#aaa" }]} onPress={() => setPaymentModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={() => initiatePayment(selectedPlan)}>
                  <Text style={styles.modalButtonText}>Pay Now</Text>
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
