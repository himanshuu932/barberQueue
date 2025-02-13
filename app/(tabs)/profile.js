import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;

  const paymentHistory = [
    { id: 1, date: "2025-01-10", amount: "$45.00", description: "Haircut" },
    { id: 2, date: "2024-12-05", amount: "$30.00", description: "Beard Trim" },
    { id: 3, date: "2024-11-20", amount: "$50.00", description: "Full Service" },
    { id: 4, date: "2024-10-15", amount: "$60.00", description: "Premium Service" },
    { id: 5, date: "2024-09-01", amount: "$35.00", description: "Regular Cut" },
    { id: 6, date: "2025-01-10", amount: "$45.00", description: "Haircut" },
    { id: 7, date: "2024-12-05", amount: "$30.00", description: "Beard Trim" },
    { id: 8, date: "2024-11-20", amount: "$50.00", description: "Full Service" },
    { id: 9, date: "2024-10-15", amount: "$60.00", description: "Premium Service" },
    { id: 10, date: "2024-09-01", amount: "$35.00", description: "Regular Cut" },
    { id: 11, date: "2024-09-01", amount: "$35.00", description: "Regular Cut" },
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

  useEffect(() => {
    const animateShine = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shineAnimation, {
            toValue: 1,
            duration: 2000, // Adjust speed here (2 seconds)
            useNativeDriver: true,
          }),
          Animated.timing(shineAnimation, {
            toValue: 0,
            duration: 0, // Reset instantly to start again
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateShine();
  }, [shineAnimation]);

  const shineTranslateX = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 900], // Horizontal movement (adjust to cover the box)
  });

  const shineTranslateY = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 250], // Vertical movement (adjust to cover the box)
  });

  return (
    <View style={styles.overlay}>
      {/* Profile Box with Diagonal Shine Animation */}
      <View style={styles.profileBox}>
        <LinearGradient
          colors={["#1a1a1a", "#333333", "#1a1a1a"]} // Darker gradient
          style={styles.profileBackground}
        >
          {/* Shine Effect */}
          <Animated.View
            style={[
              styles.shine,
              {
                transform: [
                  { translateX: shineTranslateX },
                  { translateY: shineTranslateY },
                  { rotate: "45deg" }, // Rotate the shine diagonally
                ],
              },
            ]}
          >
            <LinearGradient
              colors={["transparent", "rgba(255, 255, 255, 0.3)", "transparent"]} // Shine gradient
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shineGradient}
            />
          </Animated.View>

          {/* Profile Content */}
          <View style={styles.profileContent}>
            <Image source={require("../image/user.png")} style={styles.profileImage} />
            <View style={styles.profileDetails}>
              <Text style={styles.username}>{AsyncStorage.getItem("userName") || "User Name"}</Text>
              <Text style={styles.userInfo}>+1 234 567 8900</Text>
              <Text style={styles.userInfo}>user@example.com</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Payment History Section */}
      <View style={styles.paymentHistoryContainer}>
        <Text style={styles.sectionTitle}>Payment History</Text>
        <View style={styles.paymentBox}>
          <ScrollView
            style={styles.paymentHistoryScroll}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {paymentHistory.map((item) => (
              <View key={item.id} style={styles.paymentCard}>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentDate}>{item.date}</Text>
                  <Text style={styles.paymentAmount}>{item.amount}</Text>
                </View>
                <Text style={styles.paymentDescription}>{item.description}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.buttonContainer} onPress={handleLogout}>
        <LinearGradient colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} style={styles.button}>
          <Text style={styles.buttonText}>Logout</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    backgroundColor: "#ffffff",
    width: "100%",
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
    width: 300, // Increase width to cover the box diagonally
    height: "300%", // Increase height to cover the box diagonally
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
    color: "#fff", // White text for contrast
  },
  userInfo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff", // White text for contrast
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#000",
  },
  paymentHistoryContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  paymentBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    padding: 10,
    maxHeight: 450,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  paymentCard: {
    backgroundColor: "#F9F9F9",
    padding: 11,
    borderRadius: 10,
    marginBottom: 10,
    width: "100%",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentDate: {
    fontSize: 14,
    color: "#555",
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "rgb(16, 98, 13)",
  },
  paymentDescription: {
    fontSize: 15,
    color: "#777",
    marginTop: 4,
  },
  buttonContainer: {
    width: "90%",
    marginBottom: 10,
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