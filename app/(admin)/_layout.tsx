import React, { createContext, useState, Dispatch, SetStateAction } from "react";
import { Tabs, usePathname } from "expo-router"; // Import usePathname
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

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
    <PlusButtonContext.Provider value={{ plusButtonHandler, setPlusButtonHandler }}>
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

      {/* Floating Plus Button: Only Visible on Home (menu) Screen */}
      {pathname === "/menu" && (
        <TouchableOpacity style={styles.floatingButton} onPress={plusButtonHandler}>
          <Ionicons name="add" size={36} color="#fff" />
        </TouchableOpacity>
      )}
    </PlusButtonContext.Provider>
  );
}

const styles = StyleSheet.create({
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
  floatingButton: {
    position: "absolute",
    bottom: 0,
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
