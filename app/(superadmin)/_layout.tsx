import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FontAwesome5 } from '@expo/vector-icons'; // Import FontAwesome5 for the store icon

import { View, Text, StyleSheet, SafeAreaView, Dimensions } from "react-native";

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function Layout() {
  return (
  <SafeAreaView style={styles.safeAreaContainer}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Numbr</Text>
      </View>

      {/* Tabs Component */}
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: "black",
            height: screenHeight * 0.10, // 10% of screen height for tab bar
            paddingBottom: 0, // Ensure no extra padding at the bottom of the tab bar
            borderTopWidth: 0, // Remove any default border top
          },
          tabBarActiveTintColor: "#007bff",
          tabBarInactiveTintColor: "#ddd",
          headerShown: false, // Hide the header provided by Expo Router
          tabBarLabelStyle: {
            fontSize: screenWidth * 0.03, // Adjust font size based on screen width
          },
          tabBarIconStyle: {
            paddingTop: screenHeight * 0.005, // Small padding for icon on top
          }
        }}
      >
        <Tabs.Screen
          name="menu"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        {/* New Shop Selection Tab */}
        <Tabs.Screen
          name="shopselection" // This maps to app/shopselection.js
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1, // Makes the SafeAreaView take up all available space
    backgroundColor: "black", // Ensures background behind status bar is black
  },
  header: {
    height: screenHeight * 0.06,
    backgroundColor: "black",
    flexDirection: "row",
    alignItems: "center", // Vertically centers content in the header
    paddingHorizontal: screenWidth * 0.042, // Horizontal padding remains fixed, but can be percentage if desired
    paddingTop: screenHeight * 0.03,
  },
  title: {
    color: "#fff",
    fontSize: screenWidth * 0.055, // Adjust font size based on screen width for responsiveness
    width: screenWidth * 0.5, // Adjust width to fit the title
    marginLeft: screenWidth * 0.042, // Fixed left margin, adjust if needed
  },
});
