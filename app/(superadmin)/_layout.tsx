import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet } from "react-native";

export default function Layout() {
  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My App</Text>
      </View>

      {/* Tabs Component */}
      <Tabs
        screenOptions={{
          tabBarStyle: { backgroundColor: "black", height: 60 },
          tabBarActiveTintColor: "#007bff",
          tabBarInactiveTintColor: "#ddd",
          headerShown: false,
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
  },
  title: {
    color: "#fff",
    fontSize: 20,
    marginLeft: 15,
  },
});
