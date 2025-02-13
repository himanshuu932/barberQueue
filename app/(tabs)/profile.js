// app/(tabs)/profile.js
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  ScrollView,
  Image,
} from "react-native";

export default function TabProfileScreen({ navigation }) {
  const router = useRouter();
  // Extended dummy data for payment history
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

  // Handle the logout action
  const handleLogout = async () => {
    try {
      // Remove the token from AsyncStorage
      await AsyncStorage.removeItem("userToken");
      await AsyncStorage.removeItem("userType");
      console.log("User logged out");
      // Navigate to the login screen
      router.replace("../login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };
  

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header with profile image, username and logout button */}
      <View style={styles.header}>
        <View style={styles.profileContainer}>
          <Image
            source={{ uri: "https://via.placeholder.com/50" }} // Replace with your image URL or local asset
            style={styles.profileImage}
          />
          <Text style={styles.username}>John Doe</Text>
        </View>
        <Button title="Logout" onPress={handleLogout} color="#FF4500" />
      </View>

      {/* Payment History Section */}
      <View style={styles.paymentHistoryContainer}>
        <Text style={styles.sectionTitle}>Payment History</Text>
        {/* Nested ScrollView for payment history items */}
        <ScrollView style={styles.paymentHistoryScroll} nestedScrollEnabled={true}>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  header: {
    marginBottom: 20,
    alignItems: "center",
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
  },
  paymentHistoryContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  paymentHistoryScroll: {
    maxHeight: 400, // Adjust the height as needed
  },
  paymentItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginBottom: 10,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paymentDate: {
    fontSize: 14,
    color: "#555",
  },
  paymentAmount: {
    fontSize: 16,
    color: "#1E90FF",
    fontWeight: "500",
  },
  paymentDescription: {
    fontSize: 16,
    color: "#333",
    marginTop: 4,
  },
});
