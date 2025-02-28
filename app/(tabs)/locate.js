import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import * as Location from "expo-location";
import MapViewDirections from "react-native-maps-directions";
import Icon from "react-native-vector-icons/MaterialIcons";
import Constants from "expo-constants";
import { useFocusEffect } from "@react-navigation/native";

const GOOGLE_MAPS_APIKEY = Constants.expoConfig?.extra?.googleMapsApiKey;
console.log("API Key:", GOOGLE_MAPS_APIKEY);

export default function LocateScreen() {
  const [currentRegion, setCurrentRegion] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  const destination = {
    latitude: 26.7323339,
    longitude: 83.4292296,
  };

  // Function to request permission and get the current location
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

  // Run on mount: request permission and subscribe to location changes
  useEffect(() => {
    (async () => {
      await requestLocationPermissionAndSetLocation();
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

  // Check for permissions on screen focus and prompt if not granted
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          await requestLocationPermissionAndSetLocation();
        }
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

  const handleLocate = () => {
    setShowNavigation(true);
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: destination.latitude,
          longitude: destination.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

  const handleNavigate = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
    Linking.openURL(url);
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
        <Marker
          coordinate={destination}
          title="Destination"
          description="Your selected location"
        />
        {showNavigation && (
          <MapViewDirections
            origin={{
              latitude: currentRegion.latitude,
              longitude: currentRegion.longitude,
            }}
            destination={destination}
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
