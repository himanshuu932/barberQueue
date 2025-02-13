import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";

export default function TabProfileScreen() {
  const router = useRouter();
  
  const paymentHistory = [
    { id: 1, date: "2025-01-10", amount: "$45.00", description: "Haircut" },
    { id: 2, date: "2024-12-05", amount: "$30.00", description: "Beard Trim" },
    { id: 3, date: "2024-11-20", amount: "$50.00", description: "Full Service" },
    { id: 4, date: "2024-10-15", amount: "$60.00", description: "Premium Service" },
    { id: 5, date: "2024-09-01", amount: "$35.00", description: "Regular Cut" },
    { id: 6, date: "2024-08-20", amount: "$40.00", description: "Style & Trim" },
    { id: 7, date: "2024-07-15", amount: "$55.00", description: "Beard Styling" },
    { id: 8, date: "2024-06-30", amount: "$65.00", description: "Luxury Treatment" },
  ];

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("userToken");
      await AsyncStorage.removeItem("userType");
      await AsyncStorage.removeItem("userName");
      router.replace("../login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.profileBox}>
        <Image
          source={{ uri: "https://via.placeholder.com/100" }} // Replace with actual image
          style={styles.profileImage}
        />
        <View style={styles.profileDetails}>
          <Text style={styles.username}>{AsyncStorage.getItem("userName")}</Text>
          <TouchableOpacity style={styles.buttonContainer} onPress={handleLogout}>
            <LinearGradient colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} style={styles.button}>
              <Text style={styles.buttonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.paymentHistoryContainer}>
  <Text style={styles.sectionTitle}>Payment History</Text>
  
  {/* Gradient Fade at the Top */}
  <LinearGradient 
    colors={["rgba(255,255,255,1)", "rgba(255,255,255,0)"]}
    style={styles.gradientTop}
  />

  <ScrollView 
    style={styles.paymentHistoryScroll} 
    nestedScrollEnabled={true} 
    showsVerticalScrollIndicator={false}
  >
    {paymentHistory.map((item) => (
      <View key={item.id} style={styles.paymentItem}>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentDate}>{item.date}</Text>
          <Text style={styles.paymentAmount}>{item.amount}</Text>
        </View>
        <Text style={styles.paymentDescription}>{item.description}</Text>
      </View>
    ))}
  </ScrollView>

  {/* Gradient Fade at the Bottom */}
  <LinearGradient 
    colors={["rgba(255,255,255,0)", "rgba(255,255,255,1)"]}
    style={styles.gradientBottom}
  />
</View>

    </View>
  );
}

const styles = StyleSheet.create({
  gradientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 15, // Adjust height of fade effect
    zIndex: 1,
  },
  gradientBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 15, // Adjust height of fade effect
    zIndex: 1,
  },
  
  overlay: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgb(255, 255, 255)",
    width: "100%",
  },
  profileBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5, 5, 5, 0.32)",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderColor: "#fff",
    borderWidth: 2,
  },
  profileDetails: {
    marginLeft: 40,
    flex: 1,
    justifyContent: "center",
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  buttonContainer: {
    width: "60%",
    marginTop: 10,
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
  paymentHistoryContainer: {
    flex: 1,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "rgba(0,0,0)",
  },
  paymentHistoryScroll: {
    flex: 1,
    width: "100%",
  },
  paymentItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    marginBottom: 10,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paymentDate: {
    fontSize: 14,
    color: "rgba(0,0,0)",
  },
  paymentAmount: {
    fontSize: 16,
    color: "#FFD700",
    fontWeight: "500",
  },
  paymentDescription: {
    fontSize: 16,
    color: "rgba(0,0,0)",
    marginTop: 4,
  },
});
