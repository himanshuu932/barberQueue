// FileName: ShopsList.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";

import ShopHeader from "./ShopHeader";
import TodayStats from "./TodayStats";
import ServicesList from "./ServicesList";
import BarbersList from "./BarbersList";
import DangerZone from "./DangerZone";

const API_BASE_URL = 'https://numbr-p7zc.onrender.com/api';

const isShopCurrentlyOpen = (openingTime, closingTime) => {
  try {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const [openHours, openMinutes] = openingTime.split(':').map(Number);
    const [closeHours, closeMinutes] = closingTime.split(':').map(Number);
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const openTimeInMinutes = openHours * 60 + openMinutes;
    const closeTimeInMinutes = closeHours * 60 + closeMinutes;
    if (openTimeInMinutes <= closeTimeInMinutes) {
      return currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes;
    } else {
      return currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes < closeTimeInMinutes;
    }
  } catch (e) {
    console.error("Error parsing time:", e);
    return false;
  }
};

const ShopsList = ({ shopId, onClose, userToken, fetchOwnerShops }) => {
  const [currentShop, setCurrentShop] = useState(null);
  const [barbersList, setBarbersList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBarbersForShop = useCallback(async (currentShopId, token) => {
    if (!currentShopId || !token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/barbers/shop/${currentShopId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch barbers.');
      }
      const data = await response.json();
      setBarbersList(data.data || []);
    } catch (err) {
      console.error('Error fetching barbers:', err);
      Alert.alert("Barber Fetch Error", err.message || 'Could not load barbers.');
      setBarbersList([]);
    }
  }, []);

  const fetchShopDetails = useCallback(async () => {
    if (!shopId || !userToken) {
      setError('Shop ID or token missing.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch shop details.');
      }
      const data = await response.json();
      const fetchedShop = data.data;

      const formattedShop = {
        _id: fetchedShop._id,
        name: fetchedShop.name,
        address: fetchedShop.address.fullDetails,
        openingTime: fetchedShop.openingTime,
        closingTime: fetchedShop.closingTime,
        carouselImages: fetchedShop.photos || [],
        shopRating: fetchedShop.rating ? { average: fetchedShop.rating, count: 0 } : { average: 0, count: 0 },
        isManuallyOverridden: fetchedShop.isManuallyOverridden,
        isOpen: fetchedShop.isManuallyOverridden ? fetchedShop.isOpen : isShopCurrentlyOpen(fetchedShop.openingTime, fetchedShop.closingTime),
        todayStats: { earnings: 0, customers: 0, popularService: 'N/A', topEmployee: 'N/A' },
        services: fetchedShop.services || [],
        subscription: fetchedShop.subscription || { status: 'N/A', trialEndDate: null },
      };

      setCurrentShop(formattedShop);
      await fetchBarbersForShop(fetchedShop._id, userToken);
    } catch (err) {
      console.error('Error fetching shop details:', err);
      setError(err.message || 'Failed to load shop details.');
      Alert.alert("Error", err.message || 'Failed to load shop details.');
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [shopId, userToken, onClose, fetchBarbersForShop]);

  useEffect(() => {
    fetchShopDetails();
  }, [fetchShopDetails]);

  const executeDeleteShop = async () => {
    if (!currentShop || !userToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/shops/${currentShop._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${userToken}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to delete shop.');
      }
      Alert.alert("Success", "Shop deleted!");
      onClose();
      if (fetchOwnerShops) await fetchOwnerShops(userToken);
    } catch (err) {
      console.error('Error deleting shop:', err);
      Alert.alert("Error", err.message);
    }
  };

  const handleDataRefresh = async () => {
      await fetchShopDetails();
      if(fetchOwnerShops) await fetchOwnerShops(userToken);
  }

  if (isLoading || !currentShop) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchShopDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Numbr</Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <ShopHeader
          shop={currentShop}
          userToken={userToken}
          onShopUpdate={handleDataRefresh}
        />

        <TodayStats stats={currentShop.todayStats} />

        <ServicesList
          services={currentShop.services}
          shopId={currentShop._id}
          userToken={userToken}
          onServicesUpdate={fetchShopDetails}
        />

        <BarbersList
          barbers={barbersList}
          shopId={currentShop._id}
          userToken={userToken}
          onBarbersUpdate={() => fetchBarbersForShop(currentShop._id, userToken)}
        />

        <DangerZone
          shopName={currentShop.name}
          onDelete={executeDeleteShop}
        />
      </ScrollView>

      <TouchableOpacity style={styles.backButton} onPress={onClose}>
        <Text style={styles.backButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8EDF2',
  },
  header: {
    height: 70,
    backgroundColor: "black",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'flex-start',
    paddingTop: 15,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 100,
    paddingTop: 15,
  },
  backButton: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    right: 15,
    backgroundColor: 'black',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8EDF2',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: '#333'
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default ShopsList;