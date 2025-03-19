import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet,  Text,View } from "react-native";
import ScissorsIcon from "../../components/ScissorsIcon"; // Adjust the path as needed

export default function Layout() {
  return (<>
    <View style={styles.header}>
        
          <Text style={styles.title}>Numbr</Text>
        </View>
    <View style={styles.container}>
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
          name="barber"
          options={{
            title: "Barber",
            tabBarIcon: ({ color, size }) => (
              <ScissorsIcon color={color} size={size} />
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
          transform: [{ translateY: -2 }], // adjust this value as needed
        }}
      >
        {'\u20B9'}
      </Text>
    ),
  }}
/>
         <Tabs.Screen
          name="history"
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
  },
  title: {
    color: "#fff",
    fontSize: 20,
    marginLeft: 15,
  },
});

