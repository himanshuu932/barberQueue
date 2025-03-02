import React, { useState, useEffect } from "react";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  // While we’re checking AsyncStorage, render nothing (or a splash/loading)
  if (isLoggedIn === null) {
    return null;
  }

  // Use a nested (or chained) ternary to redirect properly
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
