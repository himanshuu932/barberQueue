import React, { useState, useEffect } from "react";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Show an alert when the app is in the foreground
    shouldPlaySound: true, // Play a sound when the notification is received
    shouldSetBadge: true, // Set the app badge count
  }),
});
export default function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [userType, setUserType] = useState(null);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        const type = await AsyncStorage.getItem("userType");
        setUserType(type);
        setIsLoggedIn(!!token);
      } catch (error) {
        console.error("Error reading AsyncStorage", error);
        setIsLoggedIn(false);
      }
    };
    checkLoginStatus();
  }, []);

   if (isLoggedIn === null) {
    return null;
  }
 return (
    <Redirect
      href={
        isLoggedIn
          ? userType === "barber"
            ? "/(admin)/menu"
            : userType === "superadmin"
            ? "/(superadmin)/menu"
            : "/(tabs)/menu"
          : "/pre-login"
      }
    />
  );
}
