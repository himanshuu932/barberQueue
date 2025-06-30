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
  Dimensions
} from "react-native";

import ShopHeader from "./ShopHeader";
import TodayStats from "./TodayStats";
import ServicesList from "./ServicesList";
import BarbersList from "./BarbersList";
import DangerZone from "./DangerZone";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const API_BASE_URL = 'https://numbr-exq6.onrender.com/api';

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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || 'Failed to fetch shop details.');
    }

    const data = await response.json();
    const fetchedShop = data.data.shop;
    const history = data.data.history || [];

    // 🧠 Process today's stats
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    let earnings = 0, customers = 0;
    const serviceCounter = {}, employeeCounter = {};

    history.forEach(entry => {
      const entryDate = new Date(entry.date).toISOString().slice(0, 10);
      if (entryDate === today) {
        earnings += entry.totalCost || 0;
        customers += 1;

        // Count services
        entry.services.forEach(s => {
          const serviceName = s.name || 'Unknown';
          serviceCounter[serviceName] = (serviceCounter[serviceName] || 0) + 1;
        });

        // Count barber
        const barberName = entry.barber?.name || 'Unknown';
        employeeCounter[barberName] = (employeeCounter[barberName] || 0) + 1;
      }
    });

    const mostPopularService = Object.entries(serviceCounter).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const topEmployee = Object.entries(employeeCounter).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // 🏪 Format shop data
    const formattedShop = {
      _id: fetchedShop._id,
      name: fetchedShop.name,
      address: fetchedShop.address,
      openingTime: fetchedShop.openingTime,
      closingTime: fetchedShop.closingTime,
     photos: fetchedShop.photos || [], 

      shopRating: fetchedShop.rating ? { average: fetchedShop.rating, count: 0 } : { average: 0, count: 0 },
      isManuallyOverridden: fetchedShop.isManuallyOverridden,
      isOpen: fetchedShop.isManuallyOverridden
        ? fetchedShop.isOpen
        : isShopCurrentlyOpen(fetchedShop.openingTime, fetchedShop.closingTime),
      todayStats: {
        earnings,
        customers,
        popularService: mostPopularService,
        topEmployee,
      },
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
    height: screenHeight * 0.06,
    backgroundColor: "black",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: screenWidth * 0.042,
    paddingTop: screenHeight * 0.01
  },
  title: {
    color: "#fff",
    fontSize: screenWidth * 0.055,
    marginLeft: screenWidth * 0.042
    // fontWeight: '800',
    // letterSpacing: 1.2,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: screenWidth * 0.042,
    paddingBottom: screenHeight * 0.1,
    paddingTop: screenHeight * 0.015,
  },
  backButton: {
    position: 'absolute',
    bottom: screenHeight * 0.02,
    left: screenWidth * 0.042,
    right: screenWidth * 0.042,
    backgroundColor: 'black',
    padding: screenWidth * 0.05,
    borderRadius: screenWidth * 0.04,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: screenHeight * 0.007 },
    shadowOpacity: 0.35,
    shadowRadius: screenWidth * 0.025,
    elevation: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    // letterSpacing: screenWidth * 0.005,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8EDF2',
  },
  loadingText: {
    marginTop: screenHeight * 0.01,
    fontSize: screenWidth * 0.045,
    color: '#333'
  },
  retryButton: {
    marginTop: screenHeight * 0.02,
    backgroundColor: '#007BFF',
    paddingVertical: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.07,
    borderRadius: screenWidth * 0.025,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: screenWidth * 0.04,
    fontWeight: 'bold',
  }
});

export default ShopsList;