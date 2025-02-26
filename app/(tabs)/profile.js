import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Animated, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function TabProfileScreen() {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        const response = await fetch("https://barber-queue.vercel.app/profile", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setProfile(data);
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const animateShine = () => {
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
    };
    animateShine();
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
      router.replace("../login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profileBox}>
        <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
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
                <>
                  <Text style={styles.username}>{profile?.name || "User Name"}</Text>
                  <Text style={styles.userInfo}>{profile?.phone || "N/A"}</Text>
                  <Text style={styles.userInfo}>{profile?.email || "N/A"}</Text>
                </>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>

      <Text style={styles.historyTitle}>Haircut History</Text>
      <View style={styles.historyContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#333" />
        ) : profile?.history?.length > 0 ? (
          profile.history.map((item, index) => (
            <View key={index} style={styles.historyItem}>
              <Text style={styles.historyService}>{item.service}</Text>
              <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noHistory}>No haircut history available.</Text>
        )}
      </View>

      <TouchableOpacity style={styles.buttonContainer} onPress={handleLogout}>
        <LinearGradient colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} style={styles.button}>
          <Text style={styles.buttonText}>Logout</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  historyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  historyContainer: {
    width: "100%",
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    padding: 15,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  historyService: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  historyDate: {
    fontSize: 14,
    color: "#666",
  },
  noHistory: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  buttonContainer: {
    marginTop: 20,
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

