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
  Modal,TextInput
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editedProfile, setEditedProfile] = useState({name:"",email:"",phone:""});
   const [user_id,setuid] = useState(null);
  const API_BASE = "https://barberqueue-24143206157.us-central1.run.app";
  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch("https://barberqueue-24143206157.us-central1.run.app/profile", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setProfile(data);
      await AsyncStorage.setItem("id", data._id);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  // useFocusEffect ensures that fetchProfile runs every time this screen is focused.
  useFocusEffect(
    useCallback(() => {
      fetchProfile();
     // setuid(AsyncStorage.getItem("id"));
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
      await AsyncStorage.removeItem("id");
      router.replace("../pre-login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };
  async function updateUserProfile(uid1, name, email) {
    const uid = await AsyncStorage.getItem("id");
    console.log(uid);
    console.log(email);
    console.log(name);
    //const uid=uid2.j;
    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, name, email })
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating user profile:", errorData);
        return;
      }
      const data = await response.json();
      console.log("User profile updated successfully:", data);
      // Optionally, update your application state or UI here.
     // await AsyncStorage.removeItem("id");
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error updating user profile:", error);
    }
  }

  return (
    <View style={styles.container}>
      {/* Fixed header */}
      <View style={styles.header}>
      <View style={styles.profileBox}>
        <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
        <TouchableOpacity style={styles.editButton} onPress={() => { setEditedProfile(profile); setIsModalVisible(true); }}>
  <Image 
    source={require("../image/editw.png")}  // Use require() for local images
    style={{ width: 25, height: 25, tintColor: "white" }} // Use tintColor for color change
  />
</TouchableOpacity>
          <Animated.View
            style={[styles.shine, { transform: [{ translateX: shineTranslateX }, { translateY: shineTranslateY }, { rotate: "45deg" }] }]}
          >
            <LinearGradient colors={["transparent", "rgba(255, 255, 255, 0.3)", "transparent"]} style={styles.shineGradient} />
          </Animated.View>
          <View style={styles.profileContent}>
            <Image source={require("../image/user.png")} style={styles.profileImage} />
            <View style={styles.profileDetails}>
              {loading ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <View>
                  <Text style={styles.username}>{profile?.name || "User Name"}</Text>
                  <Text style={styles.userInfo}>{profile?.phone || "N/A"}</Text>
                  <Text style={styles.userInfo}>{profile?.email || "N/A"}</Text>
                </View>
              )}
            </View>
           
          </View>
        </LinearGradient>
      </View>
        <Text style={styles.historyTitle}>Service History</Text>
      </View>

      {/* Scrollable history list */}
      <ScrollView 
         style={styles.historyScroll}
         contentContainerStyle={styles.historyScrollContent}
         showsVerticalScrollIndicator={false}
      >
        <View style={styles.historyContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#333" />
          ) : profile?.history?.length > 0 ? (
            profile.history.map((item, index) => (
                
                <View key={index} style={styles.historyItem}>
                  <View style={styles.paymentRow}>
                <Text style={styles.historyService}>{item.service}</Text>
                <Text style={styles.paymentAmount}>₹{item.cost}.00</Text>
               
                </View>
                <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noHistory}>No haircut history available.</Text>
          )}
        </View>
      </ScrollView>
  
      {/* Fixed logout button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.buttonContainer} onPress={handleLogout}>
          <LinearGradient 
            colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} 
            style={styles.button}
          >
            <Text style={styles.buttonText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TextInput style={styles.input} placeholder="Name" value={editedProfile.name} onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })} />
            <TextInput style={styles.input} placeholder="Phone" value={editedProfile.phone} onChangeText={(text) => setEditedProfile({ ...editedProfile, phone: text })} />
            <TextInput style={styles.input} placeholder="Email" value={editedProfile.email} onChangeText={(text) => setEditedProfile({ ...editedProfile, email: text })} />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={() => updateUserProfile(user_id, editedProfile.name, editedProfile.email)}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
    bottom:10,
    right: 5,
    padding: 3,
    borderRadius: 6,
    alignItems: "center"
  },
  editButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
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
  paymentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
  historyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  historyScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  historyScrollContent: {
    paddingBottom: 20,
  },
  historyContainer: {
    width: "100%",
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    padding: 15,
  },
  historyItem: { backgroundColor: "#F9F9F9", padding: 11, borderRadius: 10, marginBottom: 10, elevation: 3 },
  historyService: {
    fontSize: 15, color: "#777", marginTop: 4
  },
  paymentAmount: { fontSize: 16, fontWeight: "bold", color: "rgb(16, 98, 13)" },
  historyDate: {
    fontSize: 14, color: "#555" 
  },
  noHistory: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  footer: {
    padding: 20,
    alignItems: "center",
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
});
