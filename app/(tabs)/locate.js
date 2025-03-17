import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import * as Location from "expo-location";
import MapViewDirections from "react-native-maps-directions";
import Icon from "react-native-vector-icons/MaterialIcons";
import Constants from "expo-constants";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const GOOGLE_MAPS_APIKEY = Constants.expoConfig?.extra?.googleMapsApiKey;
console.log("API Key:", GOOGLE_MAPS_APIKEY);

export default function LocateScreen() {
  const [currentRegion, setCurrentRegion] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [shopDestination, setShopDestination] = useState(null);
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  // Request permission and get current user location
  const requestLocationPermissionAndSetLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setErrorMsg("Permission to access location was denied");
      return;
    }
    let location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;
    setCurrentRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  // Fetch shop coordinates using shopId from AsyncStorage
  const fetchShopCoordinates = async () => {
    try {
      const shopId = await AsyncStorage.getItem("pinnedShop");
      if (shopId) {
        const response = await fetch(`https://barberqueue-24143206157.us-central1.run.app/shop/coordinates?id=${shopId}`);
        const data = await response.json();
        if (response.ok && data.x !== undefined && data.y !== undefined) {
          setShopDestination({
            latitude: data.x,
            longitude: data.y,
          });
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
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 1,
        },
        (newLocation) => {
          const { latitude, longitude } = newLocation.coords;
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
        locationSubscription.current.remove();
      }
    };
  }, []);

  // On page focus, check permissions and refetch shop coordinates.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { status } = await Location.getForegroundPermissionsAsync();
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
      setShowNavigation(true);
      if (mapRef.current) {
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
    }
  };

  // Open Google Maps navigation with the shop destination
  const handleNavigate = () => {
    if (shopDestination) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${shopDestination.latitude},${shopDestination.longitude}`;
      Linking.openURL(url);
    } else {
      Alert.alert("Destination not available", "Shop coordinates not fetched yet.");
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={currentRegion}
        showsUserLocation={true}
      >
        {shopDestination && (
          <Marker
            coordinate={shopDestination}
            title="Shop Location"
            description="Destination fetched from shop details"
          />
        )}
        {showNavigation && shopDestination && (
          <MapViewDirections
            origin={{
              latitude: currentRegion.latitude,
              longitude: currentRegion.longitude,
            }}
            destination={shopDestination}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#FF4500"
          />
        )}
      </MapView>

      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.locateButton]}
          onPress={handleLocate}
        >
          <Icon name="store" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, styles.navigateButton]}
          onPress={handleNavigate}
        >
          <Icon name="navigation" size={24} color="#fff" />
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
});
