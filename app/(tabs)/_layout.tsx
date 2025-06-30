import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons"; // Icons for the tabs
import { View, Text, StyleSheet, SafeAreaView, Dimensions } from "react-native";

// Get screen dimensions for potential future use (though not strictly necessary for this basic layout)
const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function Layout() {
  return (
    <SafeAreaView style={styles.safeAreaContainer}>
     
      <View style={styles.header}>
        <Text style={styles.title}>Numbr</Text>
      </View>

      {/* Tabs component takes up the remaining space */}
      <Tabs
            screenOptions={{
            tabBarStyle: {
              backgroundColor: "black",
              height: screenHeight * 0.075, // 10% of screen height for tab bar
              paddingBottom: 11, // Ensure no extra padding at the bottom of the tab bar
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
        <Tabs.Screen
          name="locate"
          options={{
            title: "Locate",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="locate" size={size} color={color} />
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
    height: screenHeight * 0.07,
    backgroundColor: "black",
    flexDirection: "row",
    alignItems: "center", // Vertically centers content in the header
    paddingHorizontal: screenWidth * 0.042, // Horizontal padding remains fixed, but can be percentage if desired
    // paddingTop : screenHeight * 0.01
  },
  title: {
    color: "#fff",
    fontSize: screenWidth * 0.055, // Adjust font size based on screen width for responsiveness
    width: screenWidth * 0.5, // Adjust width to fit the title
    marginLeft: screenWidth * 0.042, // Fixed left margin, adjust if needed
  },

});
