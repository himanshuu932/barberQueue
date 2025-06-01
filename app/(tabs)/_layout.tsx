import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons"; // Icons for the tabs
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

export default function Layout() {
  return (
    <>
     
      <View style={styles.header}>
      
        <Text style={styles.title}>Numbr</Text>
      </View>

      
      <Tabs
        screenOptions={{
          tabBarStyle: { backgroundColor: "black", height: 90 },
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
      
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 70,
    backgroundColor: "black",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    marginLeft: 15,
    marginTop: 15,
  },
});
