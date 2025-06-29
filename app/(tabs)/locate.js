import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
  Dimensions, // Import Dimensions for responsiveness
  PixelRatio, // Import PixelRatio for responsive fonts
  Platform,   // Import Platform for consistent structure
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import * as Location from "expo-location";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Get screen dimensions for responsive styling
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const fontScale = PixelRatio.getFontScale();

// Helper function for responsive font sizes
const getResponsiveFontSize = (size) => size / fontScale;

export default function LocateScreen() {
  const [currentRegion, setCurrentRegion] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [shopDestination, setShopDestination] = useState(null);
  const [distance, setDistance] = useState(null);
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  // Helper: convert degrees to radians.
  const toRad = (value) => (value * Math.PI) / 180;

  // Helper: calculate haversine distance (in km) between two coordinates.
  // Note: This is the straight-line distance, not the route (driving) distance.
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Update distance whenever currentRegion or shopDestination changes.
  useEffect(() => {
    if (currentRegion && shopDestination) {
      const d = calculateDistance(
        currentRegion.latitude,
        currentRegion.longitude,
        shopDestination.latitude,
        shopDestination.longitude
      );
      setDistance(d);
    }
  }, [currentRegion, shopDestination]);

  // Request permission and get current user location
  const requestLocationPermissionAndSetLocation = async () => {
    //console.log("Requesting location permission...");
    let { status } = await Location.requestForegroundPermissionsAsync();
    //console.log("Location permission status:", status);
    if (status !== "granted") {
      setErrorMsg("Permission to access location was denied");
      console.error("Location permission was denied");
      return;
    }
    let location = await Location.getCurrentPositionAsync({});
    //console.log("Fetched current location:", location);
    const { latitude, longitude } = location.coords;
    setCurrentRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    //console.log("Set current region to:", { latitude, longitude });
  };

  // Fetch shop coordinates using shopId from AsyncStorage with your requested swapping logic.
  const fetchShopCoordinates = async () => {
    try {
      //console.log("Fetching shop coordinates...");
      const shopId = await AsyncStorage.getItem("pinnedShop");
      //console.log("Fetched pinnedShop from AsyncStorage:", shopId);
      if (shopId) {
        // Corrected URL to fetch coordinates for a specific shop
        const response = await fetch(
          `https://numbr-exq6.onrender.com/api/shops/${shopId}/coordinates`
        );
        const data = await response.json();
        //console.log("Shop coordinates API response:", data);
        if (response.ok && data.success && data.data && Array.isArray(data.data.coordinates) && data.data.coordinates.length === 2) {
          // The backend returns coordinates as [longitude, latitude]
          // So, for React Native Maps (which expects { latitude, longitude }), we need to swap them.
          const [longitude, latitude] = data.data.coordinates;
          setShopDestination({
            latitude: latitude, // Use latitude from backend
            longitude: longitude, // Use longitude from backend
          });
          //console.log("Set shop destination to:", { latitude: latitude, longitude: longitude });
        } else {
          console.error("Error fetching shop coordinates or data format invalid:", data.message || data);
          Alert.alert("Error", data.message || "Failed to fetch shop coordinates. Invalid data format.");
        }
      } else {
        console.error("Shop ID not found in AsyncStorage");
        Alert.alert("Error", "No pinned shop found. Please select a shop first.");
      }
    } catch (error) {
      console.error("Error fetching shop coordinates:", error);
      Alert.alert("Error", "Failed to connect to the server to fetch shop coordinates.");
    }
  };

  // On mount, request location and fetch shop coordinates. Also subscribe to location updates.
  useEffect(() => {
    (async () => {
      await requestLocationPermissionAndSetLocation();
      await fetchShopCoordinates();
      //console.log("Setting up location watch subscription...");
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 1,
        },
        (newLocation) => {
          const { latitude, longitude } = newLocation.coords;
          //console.log("Location update received:", { latitude, longitude });
          setCurrentRegion({
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      );
      locationSubscription.current = subscription;
    })();
    return () => {
      if (locationSubscription.current) {
        //console.log("Removing location subscription...");
        locationSubscription.current.remove();
      }
    };
  }, []);

  // On page focus, recheck location permissions and refetch shop coordinates.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        //console.log("Page focused. Rechecking location permissions...");
        const { status } = await Location.getForegroundPermissionsAsync();
        //console.log("Foreground permissions status on focus:", status);
        if (status !== "granted") {
          await requestLocationPermissionAndSetLocation();
        }
        await fetchShopCoordinates();
      })();
    }, [])
  );

  if (!currentRegion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
        {errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : (
          <Text style={styles.loadingText}>Fetching location...</Text>
        )}
      </View>
    );
  }

  // Animate map to the shop destination
  const handleLocate = () => {
    if (shopDestination) {
      if (mapRef.current) {
        //console.log("Animating map to shop destination:", shopDestination);
        mapRef.current.animateToRegion(
          {
            latitude: shopDestination.latitude,
            longitude: shopDestination.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000
        );
      }
    } else {
      Alert.alert("Destination not available", "Shop coordinates not fetched yet.");
      console.error("Shop destination is not available.");
    }
  };

  // Animate map to the user's current location
  const handleCurrentLocation = () => {
    if (currentRegion && mapRef.current) {
      mapRef.current.animateToRegion(currentRegion, 1000);
    }
  };

  // Open Google Maps navigation with the shop destination
  const handleNavigate = () => {
    if (shopDestination) {
      // Corrected URL for Google Maps navigation
      const url = Platform.select({
        ios: `maps://app?daddr=${shopDestination.latitude},${shopDestination.longitude}&dirflg=d`,
        android: `google.navigation:q=${shopDestination.latitude},${shopDestination.longitude}`,
      });
      Linking.openURL(url).catch(err => Alert.alert("Error", "Could not open navigation app. Please ensure you have Google Maps installed."));
    } else {
      Alert.alert("Destination not available", "Shop coordinates not fetched yet.");
      console.error("Shop destination is not available for navigation.");
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={currentRegion}
      >
        {/* Custom user marker in place of default blue dot */}
        {currentRegion && (
          <Marker coordinate={currentRegion}>
            <Image source={require("../image/user.png")} style={styles.profileImage} />
          </Marker>
        )}
        {shopDestination && (
          <Marker
            coordinate={shopDestination}
            title="Shop Location"
            description="Destination fetched from shop details"
          />
        )}
      </MapView>

      {/* Distance overlay in top right corner */}
      {distance !== null && (
        <View style={styles.distanceContainer}>
          <Text style={styles.distanceText}>{distance.toFixed(2)} km</Text>
        </View>
      )}

      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity style={[styles.fab, styles.locateButton]} onPress={handleLocate}>
          <Icon name="store" size={getResponsiveFontSize(24)} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, styles.navigateButton]} onPress={handleNavigate}>
          <Icon name="navigation" size={getResponsiveFontSize(24)} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, styles.myLocationButton]} onPress={handleCurrentLocation}>
          <Icon name="my-location" size={getResponsiveFontSize(24)} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1B1B1B",
  },
  loadingText: {
    marginTop: screenHeight * 0.012, // Responsive margin-top
    color: "#C0C0C0",
    fontSize: getResponsiveFontSize(16), // Responsive font size
  },
  errorText: {
    marginTop: screenHeight * 0.012, // Responsive margin-top
    color: "#FF6347",
    fontSize: getResponsiveFontSize(16), // Responsive font size
    fontWeight: "bold",
  },
  floatingButtonContainer: {
    position: "absolute",
    bottom: screenHeight * 0.025, // Responsive bottom position (approx 20px)
    right: screenWidth * 0.05, // Responsive right position (approx 20px)
    alignItems: "center",
  },
  fab: {
    width: screenWidth * 0.14, // Responsive width (approx 50px)
    height: screenWidth * 0.14, // Responsive height (approx 50px, keep square)
    borderRadius: (screenWidth * 0.14) / 2, // Responsive border radius
    justifyContent: "center",
    alignItems: "center",
    marginBottom: screenHeight * 0.012, // Responsive margin-bottom (approx 10px)
    elevation: 6, // Android shadow, fixed value is often acceptable here
    shadowColor: "#000",
    shadowOffset: { width: 0, height: screenHeight * 0.004 }, // Responsive shadow offset (approx 3px)
    shadowOpacity: 0.3,
    shadowRadius: screenWidth * 0.008, // Responsive shadow radius (approx 3px)
  },
  locateButton: {
    backgroundColor: "#1E90FF",
  },
  navigateButton: {
    backgroundColor: "#28A745",
  },
  myLocationButton: {
    backgroundColor: "#FF8C00",
  },
  profileImage: {
    width: screenWidth * 0.075, // Responsive width (approx 30px)
    height: screenWidth * 0.075, // Responsive height (approx 30px)
    borderRadius: (screenWidth * 0.075) / 2, // Responsive border radius
    borderWidth: screenWidth * 0.005, // Responsive border width (approx 2px)
    borderColor: "#fff",
  },
  distanceContainer: {
    position: "absolute",
    top: screenHeight * 0.025, // Responsive top position (approx 20px)
    right: screenWidth * 0.05, // Responsive right position (approx 20px)
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingVertical: screenHeight * 0.0075, // Responsive padding vertical (approx 6px)
    paddingHorizontal: screenWidth * 0.025, // Responsive padding horizontal (approx 10px)
    borderRadius: screenWidth * 0.02, // Responsive border radius (approx 8px)
  },
  distanceText: {
    color: "#fff",
    fontSize: getResponsiveFontSize(14), // Responsive font size
    fontWeight: "600",
  },
});