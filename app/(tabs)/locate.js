// app/(tabs)/locate.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Button,
  Linking,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import * as Location from "expo-location";
import MapViewDirections from "react-native-maps-directions";

// Replace with your Google Maps API Key (ensure the Directions API is enabled)
const GOOGLE_MAPS_APIKEY = "key";

export default function LocateScreen() {
  const [currentRegion, setCurrentRegion] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const mapRef = useRef(null);

  // Destination coordinate (e.g., a barber shop)
  const destination = {
    latitude: 26.7323339,
    longitude: 83.4292296,
  };

  // Get user's current location
  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  if (!currentRegion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        {errorMsg ? <Text>{errorMsg}</Text> : <Text>Fetching location...</Text>}
      </View>
    );
  }

  // "Locate" button handler: Animate map, show marker and draw in-app navigation route
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
        1000 // animation duration in milliseconds
      );
    }
  };

  // "Navigate" button handler: Open external navigation (Google Maps)
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
        showsUserLocation={true} // Shows your current location as a blue dot
      >
        {/* Destination Marker */}
        <Marker
          coordinate={destination}
          title="Destination"
          description="Your selected location"
        />

        {/* In-app navigation: Draw the blue route once the "Locate" button is pressed */}
        {showNavigation && (
          <MapViewDirections
            origin={{
              latitude: currentRegion.latitude,
              longitude: currentRegion.longitude,
            }}
            destination={destination}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="blue"
            onError={(errorMessage) =>
              console.log("Error fetching directions", errorMessage)
            }
          />
        )}
      </MapView>

      {/* Overlay title */}
     

      {/* Two Buttons: "Locate" to show the blue line and "Navigate" for external maps */}
      <View style={styles.buttonContainer}>
       
        <View style={styles.button}>
          <Button title="Navigate" onPress={handleNavigate} color="#FF4500" />
        </View>
        <View style={styles.button}>
          <Button title="Locate" onPress={handleLocate} color="#1E90FF" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 10,
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
});
