// app/(tabs)/profile.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  ScrollView,
} from "react-native";

export default function TabProfileScreen({ navigation }) {
  // Dummy data for payment history
  const paymentHistory = [
    { id: 1, date: "2025-01-10", amount: "$45.00", description: "Haircut" },
    { id: 2, date: "2024-12-05", amount: "$30.00", description: "Beard Trim" },
    { id: 3, date: "2024-11-20", amount: "$50.00", description: "Full Service" },
  ];

  // Handle the logout action
  const handleLogout = () => {
    // Add your logout logic here (e.g., clearing tokens, navigating to the login screen)
    console.log("User logged out");
    // For example, if you use React Navigation:
    // navigation.replace("Login");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header with username and logout button */}
      <View style={styles.header}>
        <Text style={styles.username}>John Doe</Text>
        <Button title="Logout" onPress={handleLogout} color="#FF4500" />
      </View>

      {/* Payment History Section */}
      <View style={styles.paymentHistoryContainer}>
        <Text style={styles.sectionTitle}>Payment History</Text>
        {paymentHistory.map((item) => (
          <View key={item.id} style={styles.paymentItem}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentDate}>{item.date}</Text>
              <Text style={styles.paymentAmount}>{item.amount}</Text>
            </View>
            <Text style={styles.paymentDescription}>{item.description}</Text>
          </View>
        ))}
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
  username: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  paymentHistoryContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
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
