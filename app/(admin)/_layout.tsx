import React, { createContext, useState, Dispatch, SetStateAction } from "react";
import { Tabs, usePathname } from "expo-router"; // Import usePathname
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet, SafeAreaView, Dimensions, TouchableOpacity, } from "react-native";

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

// Define a type for the context
interface PlusButtonContextType {
  plusButtonHandler: () => void;
  setPlusButtonHandler: Dispatch<SetStateAction<() => void>>;
}

// Create the context with the proper types
export const PlusButtonContext = createContext<PlusButtonContextType>({
  plusButtonHandler: () => {},
  setPlusButtonHandler: () => {},
});

export default function Layout() {
  const [plusButtonHandler, setPlusButtonHandler] = useState<() => void>(() => () => {});
  const pathname = usePathname(); // Get the current route

  return (
    // Wrap the entire content in SafeAreaView for consistent layout across devices
    <SafeAreaView style={styles.safeAreaContainer}>
      <PlusButtonContext.Provider value={{ plusButtonHandler, setPlusButtonHandler }}>
        {/* Custom Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Numbr</Text>
        </View>

        {/* Tabs Component */}
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
          {/* Added 'locate' screen as per the original uploaded file */}
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

        {/* Floating Plus Button: Only Visible on Home (menu) Screen */}
        {pathname === "/menu" && (
          <TouchableOpacity style={styles.floatingButton} onPress={plusButtonHandler}>
            <Ionicons name="add" size={36} color="#fff" />
          </TouchableOpacity>
        )}
      </PlusButtonContext.Provider>
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
    // paddingTop: screenHeight * 0.01
  },
  title: {
    color: "#fff",
    fontSize: screenWidth * 0.055, // Adjust font size based on screen width for responsiveness
    width: screenWidth * 0.5, // Adjust width to fit the title
    marginLeft: screenWidth * 0.042, // Fixed left margin, adjust if needed
  },
  floatingButton: {
    position: "absolute",
    bottom: screenHeight * 0.02,
    alignSelf: "center",
    transform: [{ translateY: -20 }], // Slight bulge above the navbar
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(0, 123, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
