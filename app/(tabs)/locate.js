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
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import * as Location from "expo-location";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
        const response = await fetch(
          `https://numbr-p7zc.onrender.com/shop/coordinates?id=${shopId}`
        );
        const data = await response.json();
        //console.log("Shop coordinates API response:", data);
        if (response.ok && data.x !== undefined && data.y !== undefined) {
          // Swap the values so that y becomes latitude and x becomes longitude.
          setShopDestination({
            latitude: data.x,
            longitude: data.y,
          });
          //console.log("Set shop destination to:", { latitude: data.x, longitude: data.y });
        } else {
          console.error("Error fetching shop coordinates:", data.message);
        }
      } else {
        console.error("Shop ID not found in AsyncStorage");
      }
    } catch (error) {
      console.error("Error fetching shop coordinates:", error);
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
      //console.log("Animating map to current location:", currentRegion);
      mapRef.current.animateToRegion(currentRegion, 1000);
    }
  };

  // Open Google Maps navigation with the shop destination
  const handleNavigate = () => {
    if (shopDestination) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${shopDestination.latitude},${shopDestination.longitude}`;
      //console.log("Opening Google Maps with URL:", url);
      Linking.openURL(url);
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
          <Icon name="store" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, styles.navigateButton]} onPress={handleNavigate}>
          <Icon name="navigation" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, styles.myLocationButton]} onPress={handleCurrentLocation}>
          <Icon name="my-location" size={24} color="#fff" />
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
    marginTop: 10,
    color: "#C0C0C0",
    fontSize: 16,
  },
  errorText: {
    marginTop: 10,
    color: "#FF6347",
    fontSize: 16,
    fontWeight: "bold",
  },
  floatingButtonContainer: {
    position: "absolute",
    bottom: 20,
    right: 20,
    alignItems: "center",
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
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
    width: 30,
    height: 30,
    borderRadius: 15, // Perfect circle for 30x30 image
    borderWidth: 2,
    borderColor: "#fff",
  },
  distanceContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  distanceText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
