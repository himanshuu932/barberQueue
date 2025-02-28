import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Animated,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
export default function TabProfileScreen({ navigation }) {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;

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

  const paymentHistory = [
    { id: 1, date: "2025-01-10", amount: "$45.00", description: "Haircut" },
    { id: 2, date: "2024-12-05", amount: "$30.00", description: "Beard Trim" },
  ];

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("userToken");
      await AsyncStorage.removeItem("userType");
      router.replace("../login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileBox}>
        <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
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
            <Image source={{ uri: "https://via.placeholder.com/80" }} style={styles.profileImage} />
            <View>
              <Text style={styles.username}>John Doe</Text>
              <Text style={styles.userInfo}>+1 234 567 8900</Text>
              <Text style={styles.userInfo}>user@example.com</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.paymentHistoryContainer}>
        <Text style={styles.sectionTitle}>Payment History</Text>
        <View style={styles.paymentBox}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
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

      <TouchableOpacity style={styles.buttonContainer} onPress={handleLogout}>
        <LinearGradient colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} style={styles.button}>
          <Text style={styles.buttonText}>Logout</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", padding: 20, backgroundColor: "#fff" },
  profileBox: { width: "100%", height: 150, borderRadius: 10, overflow: "hidden", marginBottom: 20 },
  profileBackground: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  shine: { position: "absolute", top: 0, left: 0, width: 300, height: "300%" },
  shineGradient: { width: "100%", height: "100%" },
  profileContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  profileImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: "#fff", marginRight: 15 },
  username: { fontSize: 22, fontWeight: "900", color: "#fff" },
  userInfo: { fontSize: 16, fontWeight: "bold", color: "#fff", marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10, color: "#000" },
  paymentHistoryContainer: { width: "100%", alignItems: "center", marginBottom: 10 },
  paymentBox: { backgroundColor: "#fff", borderRadius: 12, width: "100%", padding: 10, maxHeight: 450, elevation: 5 },
  paymentCard: { backgroundColor: "#F9F9F9", padding: 11, borderRadius: 10, marginBottom: 10, elevation: 3 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  paymentDate: { fontSize: 14, color: "#555" },
  paymentAmount: { fontSize: 16, fontWeight: "bold", color: "rgb(16, 98, 13)" },
  paymentDescription: { fontSize: 15, color: "#777", marginTop: 4 },
  buttonContainer: { width: "90%", marginBottom: 10 },
  button: { padding: 12, alignItems: "center", borderRadius: 8 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});