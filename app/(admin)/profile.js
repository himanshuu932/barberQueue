import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  ImageBackground
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from '@react-navigation/native';
export default function TabProfileScreen({ navigation }) {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [barber, setBarber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchBarberDetails = async () => {
    try {
      // Fetch the barber's UID from AsyncStorage
      const uid = await AsyncStorage.getItem("uid");
      if (!uid) {
        throw new Error("Barber ID not found");
      }

      // Fetch barber details from the backend
      const response = await fetch(`https://barberqueue-24143206157.us-central1.run.app/barber/${uid}`);
      if (!response.ok) {
        throw new Error("Failed to fetch barber details");
      }

      const data = await response.json();
      setBarber(data);
    } catch (error) {
      console.error("Error fetching barber details:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch barber details

useFocusEffect(
    React.useCallback(() => {
      fetchBarberDetails();
    }, [])
  );
  // Shine animation
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
      await AsyncStorage.removeItem("userType");
      router.replace("../pre-login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
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
              <Text style={styles.username}>{barber?.name || "John Doe"}</Text>
              <Text style={styles.userInfo}>{barber?.phone || "+1 234 567 8900"}</Text>
              <Text style={styles.userInfo}>{barber?.email || "user@example.com"}</Text>
              <Text style={styles.userInfo}>Customers Served: {barber?.totalCustomersServed || 0}</Text>
              <Text style={styles.userInfo}>
                Average Rating: {barber?.totalRatings > 0 ? (barber.totalStarsEarned / barber.totalRatings).toFixed(1) : "N/A"}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>
      <View style={styles.paymentHistoryContainer}>
        <Text style={styles.sectionTitle}>Payment History</Text>
        <View style={styles.paymentBox}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
            {barber?.history?.map((item, index) => (
              <View key={index} style={styles.paymentCard}>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentDate}>{new Date(item.date).toLocaleDateString()}</Text>
                  <Text style={styles.paymentAmount}>₹{item.totalCost}</Text>
                </View>
                <Text style={styles.paymentDescription}>{item.services}</Text>
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

  container: 
  { 
    flex: 1,
    alignItems: "center",
    justifyContent:"space-between",
    padding: 20,
    // backgroundColor: "#fff" 
  },
  loadingContainer: 
  { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  errorContainer: 
  { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  errorText: 
  { 
    fontSize: 16, 
    color: "red" 
  },
  profileBox: 
  { 
    width: "100%", 
    height: 180, 
    borderRadius: 10, 
    overflow: "hidden", 
    marginBottom: 20 
  },
  profileBackground: 
  { 
    width: "100%", 
    height: "100%", 
    justifyContent: "center", 
    alignItems: "center" 
  },
  shine: 
  { 
    position: "absolute", 
    top: 0, 
    left: 0, 
    width: 300, 
    height: "300%" 
  },
  shineGradient: 
  { 
    width: "100%", 
    height: "100%" 
  },
  profileContent: 
  { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 20 
  },
  profileImage: 
  { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    borderWidth: 2, 
    borderColor: "#fff", 
    marginRight: 15 
  },
  username: 
  { 
    fontSize: 22, 
    fontWeight: "900", 
    color: "#fff" 
  },
  userInfo: 
  { 
    fontSize: 16, 
    fontWeight: "bold", 
    color: "#fff", 
    marginTop: 2 
  },
  sectionTitle: 
  { 
    fontSize: 20, 
    fontWeight: "bold", 
    marginBottom: 10, 
    color: "#000",
  },
  paymentHistoryContainer: { 
    width: "100%", 
    alignItems: "center", 
    marginBottom: "auto", 
  },
  paymentBox: { 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    width: "100%", 
    padding: 10, 
    maxHeight: 300, // Adjust the height dynamically
    elevation: 5,
    overflow: "hidden", // Prevents content from spilling
  },
  paymentCard: 
  { 
    backgroundColor: "#F9F9F9", 
    padding: 11, 
    borderRadius: 10, 
    marginBottom: 10, 
    elevation: 3 
  },
  paymentRow: 
  { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  paymentDate: 
  { 
    fontSize: 14, 
    color: "#555" 
  },
  paymentAmount: 
  { 
    fontSize: 16, 
    fontWeight: "bold", 
    color: "rgb(16, 98, 13)" 
  },
  paymentDescription: 
  { 
    fontSize: 15, 
    color: "#777", 
    marginTop: 4 
  },
  buttonContainer: 
  { 
    position: "absolute",
    bottom: "auto",
    width: "90%", 
    marginBottom: 10 
  },
  button: 
  { padding: 12, 
    alignItems: "center", 
    borderRadius: 8 
  },
  buttonText: 
  { 
    color: "#FFFFFF", 
    fontSize: 16, 
    fontWeight: "bold" 
  },
});