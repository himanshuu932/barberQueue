import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import ScissorsIcon from "../../components/ScissorsIcon"; // Custom icon for Barber tab
import { FontAwesome5 } from '@expo/vector-icons'; // Import FontAwesome5 for the store icon

export default function Layout() {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Numbr</Text>
      </View>
      <View style={styles.container}>
        <Tabs
          screenOptions={{
            tabBarStyle: { backgroundColor: "black", height: 60 },
            tabBarActiveTintColor: "#007bff",
            tabBarInactiveTintColor: "#ddd",
            headerShown: false, // Hide default header for all tabs
          }}
        >
          {/* New Shop Selection Tab */}
       

          <Tabs.Screen
            name="menu"
            options={{
              title: "Home",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home-outline" size={size} color={color} />
              ),
            }}
          />
             <Tabs.Screen
            name="shopselection" // This maps to app/shop-selection.js
            options={{
              title: "Shops", // Title displayed on the tab bar
              tabBarIcon: ({ color, size }) => (
                <FontAwesome5 name="store" solid size={size} color={color} />
              ),
            }}
          />
       
          <Tabs.Screen
            name="rateList"
            options={{
              title: "Rate",
              tabBarIcon: ({ color, size }) => (
                <Text
                  style={{
                    fontSize: size,
                    color,
                    transform: [{ translateY: -2 }],
                  }}
                >
                  {'\u20B9'}
                </Text>
              ),
            }}
          />
          <Tabs.Screen
            name="History"
            options={{
              title: "History",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="book-outline" size={size} color={color} />
              ),
            }}
          />
          {/* The original 'shops' tab, now named 'shops' in Expo Router */}
          {/* Note: This screen will now expect a 'shopId' param to display content */}
       
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profile",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="person-outline" size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 60,
    backgroundColor: "black",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 10, // Add padding to account for notch/status bar
  },
  title: {
    color: "#fff",
    fontSize: 20,
    marginLeft: 15,
  },
});