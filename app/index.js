import React, { useState, useEffect } from "react";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [userType, setUserType] = useState(null);
  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await AsyncStorage.getItem("userToken");
      const type = await AsyncStorage.getItem("userType");
      setUserType(type);
      setIsLoggedIn(!!token);
    };
    checkLoginStatus();
  }, []);

  if (isLoggedIn === null) return null; // While checking login status

  return <Redirect href={isLoggedIn ? userType==='admin'? "/(admin)/menu" :"/(tabs)/menu" : "/login"} />;
}
