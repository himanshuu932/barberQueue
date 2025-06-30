import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
  ImageBackground,
  FlatList,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from "react-native-vector-icons/FontAwesome";
import { FontAwesome5 } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

import ShopsList from "../../components/owner/shops";

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

const ImageCarousel = ({ photos }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);

  useEffect(() => {
    let interval = setInterval(() => {
      if (photos.length > 0) {
        setActiveIndex((prevIndex) => {
          const newIndex = (prevIndex + 1) % photos.length;
          flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
          return newIndex;
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [photos]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (!photos || photos.length === 0) {
    return (
      <View style={styles.carouselPlaceholder}>
        <Text style={styles.carouselPlaceholderText}>No Images Available</Text>
      </View>
    );
  }

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        ref={flatListRef}
        data={photos}
        renderItem={({ item }) => (
          <Image
            source={{ uri: typeof item === 'string' ? item : item.url }}
            style={styles.carouselImage}
          />
        )}
        keyExtractor={(item, index) => (typeof item === 'string' ? item : item.public_id || index.toString())}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
      <View style={styles.pagination}>
        {photos.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === activeIndex ? styles.paginationDotActive : {},
            ]}
          />
        ))}
      </View>
    </View>
  );
};


const ShopSelection = () => {
  const [shops, setShops] = useState([]);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newShopData, setNewShopData] = useState({
    name: '',
    address: '',
    openingTime: '',
    closingTime: '',
    coordinates: null,
  });
  const [userToken, setUserToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isShopsListModalVisible, setIsShopsListModalVisible] = useState(false);
  const [selectedShopIdForDetails, setSelectedShopIdForDetails] = useState(null);

  const [showOpeningTimePicker, setShowOpeningTimePicker] = useState(false);
  const [showClosingTimePicker, setShowClosingTimePicker] = useState(false);
  const [tempOpeningTime, setTempOpeningTime] = useState(new Date());
  const [tempClosingTime, setTempClosingTime] = useState(new Date());

  // --- NEW STATE: For controlling the map modal and the location picked on it ---
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [mapRegion, setMapRegion] = useState({
    latitude: 20.5937, // Default to center of India
    longitude: 78.9629,
    latitudeDelta: 20,
    longitudeDelta: 20,
  });

  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const onOpeningTimeChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempOpeningTime;
    setShowOpeningTimePicker(Platform.OS === 'ios');
    setTempOpeningTime(currentDate);
    setNewShopData({ ...newShopData, openingTime: formatTime(currentDate) });
  };

  const onClosingTimeChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempClosingTime;
    setShowClosingTimePicker(Platform.OS === 'ios');
    setTempClosingTime(currentDate);
    setNewShopData({ ...newShopData, closingTime: formatTime(currentDate) });
  };

  const handleSetCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Permission to access location was denied.');
      return;
    }

    try {
        setLoading(true);
        let location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        const newCoords = { latitude, longitude };
        
        let addressResponse = await Location.reverseGeocodeAsync(newCoords);
        let formattedAddress = '';
        if (addressResponse && addressResponse.length > 0) {
            const { name, street, city, postalCode, country } = addressResponse[0];
            formattedAddress = [name, street, city, postalCode, country].filter(Boolean).join(', ');
        }
        
        setNewShopData(prev => ({ ...prev, address: formattedAddress, coordinates: newCoords }));
        setMapRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
        setLoading(false);
        Alert.alert("Location Set", "Your current location has been set.");

    } catch (e) {
        setLoading(false);
        Alert.alert("Error", "Could not fetch your current location.");
        console.error("Error fetching location:", e);
    }
  };
  
  // --- NEW: Function to handle opening the map modal ---
  const handleChooseOnMap = () => {
    // If coordinates already exist, use them for the marker. Otherwise, null.
    setSelectedLocation(newShopData.coordinates); 
    setIsMapModalVisible(true);
  };

  // --- NEW: Function to confirm location from map modal ---
  const handleConfirmLocation = async () => {
      if (selectedLocation) {
          setNewShopData({ ...newShopData, coordinates: selectedLocation });

          // Optional: Auto-fill address from confirmed location
          try {
            let addressResponse = await Location.reverseGeocodeAsync(selectedLocation);
            if (addressResponse && addressResponse.length > 0) {
                const { name, street, city, postalCode, country } = addressResponse[0];
                const formattedAddress = [name, street, city, postalCode, country].filter(Boolean).join(', ');
                setNewShopData(prev => ({ ...prev, address: formattedAddress, coordinates: selectedLocation }));
            }
          } catch (e) {
            console.error("Reverse geocoding failed:", e);
          }
      }
      setIsMapModalVisible(false);
      setSelectedLocation(null); // Reset for next time
  };

  const fetchOwnerShops = useCallback(async (token) => {
    if (!token) {
      setError('Authentication token not found. Please login.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/owners/me/shops`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch shops.');
      }
      const data = await response.json();

      const formattedShops = data.data.map(shop => ({
        _id: shop._id,
        name: shop.name,
        address: shop.address.fullDetails,
        isOpen: shop.isManuallyOverridden ? shop.isOpen : isShopCurrentlyOpen(shop.openingTime, shop.closingTime),
        isManuallyOverridden: shop.isManuallyOverridden,
        openingTime: shop.openingTime,
        closingTime: shop.closingTime,
        photos: shop.photos || [],
        shopRating: shop.rating ? { average: shop.rating, count: 0 } : { average: 0, count: 0 },
        todayStats: { earnings: 0, customers: 0, popularService: 'N/A', topEmployee: 'N/A' },
        barbers: shop.barbers || [],
      }));
      setShops(formattedShops);
    } catch (err) {
      console.error('Error fetching owner shops:', err);
      setError(err.message || 'Failed to fetch shops.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          setUserToken(token);
          await fetchOwnerShops(token);
        } else {
          console.warn('No user token found.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error initializing data:', err);
        setError('Failed to load initial data.');
        setLoading(false);
      }
    };
    init();

    const intervalId = setInterval(() => {
      setShops(prevShops => prevShops.map(shop => {
        if (!shop.isManuallyOverridden) {
          const newIsOpen = isShopCurrentlyOpen(shop.openingTime, shop.closingTime);
          if (newIsOpen !== shop.isOpen) {
            return { ...shop, isOpen: newIsOpen };
          }
        }
        return shop;
      }));
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [fetchOwnerShops]);


  const handleAddNewShop = async () => {
    if (!newShopData.name || !newShopData.address || !newShopData.openingTime || !newShopData.closingTime || !newShopData.coordinates) {
      Alert.alert("Error", "Please fill in all fields and set a location.");
      return;
    }
    if (!userToken) {
      Alert.alert("Error", "Authentication token not found. Please login again.");
      return;
    }
    try {
      const shopToCreate = {
        name: newShopData.name,
        address: {
          fullDetails: newShopData.address,
          coordinates: {
            type: 'Point',
            coordinates: [newShopData.coordinates.longitude, newShopData.coordinates.latitude],
          },
        },
        openingTime: newShopData.openingTime,
        closingTime: newShopData.closingTime,
      };

      const response = await fetch(`${API_BASE_URL}/shops`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify(shopToCreate),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to add new shop.');
      }
      const data = await response.json();
      Alert.alert("Success", data.message || "New shop added successfully!");
      setIsAddModalVisible(false);
      setNewShopData({ name: '', address: '', openingTime: '', closingTime: '', coordinates: null });
      await fetchOwnerShops(userToken);
    } catch (err) {
      console.error('Error adding new shop:', err);
      Alert.alert("Error", err.message || "Failed to add new shop. Please try again.");
    }
  };

  // Unchanged handlers
    const handleShopPress = (_id) => {
    setSelectedShopIdForDetails(_id);
    setIsShopsListModalVisible(true);
  };

  const handleCloseShopsListModal = () => {
    setIsShopsListModalVisible(false);
    setSelectedShopIdForDetails(null);
    if (userToken) { fetchOwnerShops(userToken); }
  };

  const handleUpdateShopFromModal = (updatedShop) => {
    setShops(prevShops => prevShops.map(shop => shop._id === updatedShop._id ? updatedShop : shop));
  };

  const handleDeleteShopFromModal = (deletedShopId) => {
    setShops(prevShops => prevShops.filter(shop => shop._id !== deletedShopId));
    handleCloseShopsListModal();
  };

  const handleToggleShopStatus = async (shopId) => {
    if (!userToken) {
      Alert.alert("Error", "Authentication token not found. Please login again.");
      return;
    }
    const shopToUpdate = shops.find(s => s._id === shopId);
    if (!shopToUpdate) {
      Alert.alert("Error", "Shop not found.");
      return;
    }
    const newIsOpenStatus = !shopToUpdate.isOpen;
    try {
      const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ isManuallyOverridden: true, isOpen: newIsOpenStatus }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to update shop status.');
      }
      setShops((prevShops) => prevShops.map((shop) =>
        shop._id === shopId ? { ...shop, isOpen: newIsOpenStatus, isManuallyOverridden: true } : shop
      ));
      Alert.alert("Success", "Shop status updated successfully!");
    } catch (err) {
      console.error('Error toggling shop status:', err);
      Alert.alert("Error", err.message || "Failed to toggle shop status.");
    }
  };
    //... (end of unchanged handlers)

  const ShopCard = ({ shop }) => {
    const averageRating = shop.shopRating.average;
    const displayIsOpen = shop.isOpen;

    return (
      <TouchableOpacity style={styles.shopCard} onPress={() => handleShopPress(shop._id)} activeOpacity={0.8}>
        <View style={styles.shopImageContainer}>
          <ImageCarousel photos={shop.photos} />
          <View style={[styles.statusBadge, displayIsOpen ? styles.statusOpenBackground : styles.statusClosedBackground]}>
            <Text style={styles.statusText}>{displayIsOpen ? "Open" : "Closed"}</Text>
          </View>
          <Switch
            trackColor={{ false: "#a30000", true: "#006400" }}
            thumbColor={displayIsOpen ? "#f5dd4b" : "#f4f3f4"}
            onValueChange={() => handleToggleShopStatus(shop._id)}
            value={displayIsOpen}
            style={styles.statusToggle}
          />
        </View>
        <View style={styles.shopDetails}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
          <Text style={styles.shopAddress} numberOfLines={1}>{shop.address}</Text>
          <View style={styles.ratingTimeContainer}>
            <View style={styles.ratingContainer}>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Icon key={star} name="star" size={16} color={star <= Math.round(averageRating) ? "#FFD700" : "#E0E0E0"}/>
                ))}
              </View>
              <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
            </View>
            <View style={styles.timeContainer}>
              <FontAwesome5 name="clock" size={14} color="#666" />
              <Text style={styles.timeText}>{shop.openingTime} - {shop.closingTime}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && shops.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading shops...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchOwnerShops(userToken)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.pageTitle}>Your Shops</Text>
          <TouchableOpacity style={styles.addShopButtonHeader} onPress={() => {
              setIsAddModalVisible(true);
              setTempOpeningTime(new Date());
              setTempClosingTime(new Date());
              setNewShopData(prev => ({ ...prev, openingTime: formatTime(new Date()), closingTime: formatTime(new Date()), }));
            }}>
            <Icon name="plus" size={18} color="#fff" />
            <Text style={styles.addShopButtonHeaderText}>Add Shop</Text>
          </TouchableOpacity>
        </View>

        {shops.length === 0 ? (
          <View style={styles.noShopsContainer}><Text style={styles.noShopsText}>No shops found. Add your first shop!</Text></View>
        ) : (
          <FlatList data={shops} keyExtractor={(item) => item._id} renderItem={({ item }) => <ShopCard shop={item} />} scrollEnabled={false} />
        )}
      </ScrollView>

      {/* --- MODIFIED: "Add Shop Modal" - Map is removed from here --- */}
      <Modal visible={isAddModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Shop</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Shop Name:</Text>
              <TextInput style={styles.input} placeholder="Enter shop name" value={newShopData.name} onChangeText={(text) => setNewShopData({ ...newShopData, name: text })} />
              <Text style={styles.inputLabel}>Shop Address:</Text>
              <TextInput style={styles.input} placeholder="Enter shop address" value={newShopData.address} onChangeText={(text) => setNewShopData({ ...newShopData, address: text })} />
              <Text style={styles.inputLabel}>Location:</Text>
              <TextInput style={styles.input} placeholder="Not set" editable={false} value={ newShopData.coordinates ? `${newShopData.coordinates.latitude.toFixed(4)}, ${newShopData.coordinates.longitude.toFixed(4)}` : '' } />
              
              {/* --- NEW: Location selection buttons --- */}
              <View style={styles.locationButtonsContainer}>
                <TouchableOpacity style={styles.locationButton} onPress={handleSetCurrentLocation}>
                  <FontAwesome5 name="location-arrow" size={16} color="#fff" />
                  <Text style={styles.locationButtonText}>Use My Current Location</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.locationButton, styles.mapButton]} onPress={handleChooseOnMap}>
                  <Icon name="map-marker" size={16} color="#fff" />
                  <Text style={styles.locationButtonText}>Choose on Map</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Opening Time:</Text>
              <TouchableOpacity onPress={() => setShowOpeningTimePicker(true)} style={styles.timeInputTouchable}>
                <TextInput style={styles.input} placeholder="Select opening time" value={newShopData.openingTime} editable={false} />
                <Icon name="clock-o" size={20} color="#666" style={styles.timeInputIcon} />
              </TouchableOpacity>
              {showOpeningTimePicker && (<DateTimePicker value={tempOpeningTime} mode="time" is24Hour={true} display="default" onChange={onOpeningTimeChange} />)}

              <Text style={styles.inputLabel}>Closing Time:</Text>
              <TouchableOpacity onPress={() => setShowClosingTimePicker(true)} style={styles.timeInputTouchable}>
                <TextInput style={styles.input} placeholder="Select closing time" value={newShopData.closingTime} editable={false} />
                <Icon name="clock-o" size={20} color="#666" style={styles.timeInputIcon} />
              </TouchableOpacity>
              {showClosingTimePicker && (<DateTimePicker value={tempClosingTime} mode="time" is24Hour={true} display="default" onChange={onClosingTimeChange}/>)}
            </ScrollView>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAddNewShop}><Text style={styles.modalButtonText}>Add Shop</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- NEW: Map Selection Modal --- */}
      <Modal visible={isMapModalVisible} transparent animationType="slide">
          <View style={styles.mapModalContainer}>
              <MapView style={styles.map} region={mapRegion} onRegionChangeComplete={setMapRegion} onPress={(e) => setSelectedLocation(e.nativeEvent.coordinate)}>
                  {selectedLocation && <Marker coordinate={selectedLocation} title="Selected Location" pinColor="blue" />}
              </MapView>
              <View style={styles.mapModalHeader}>
                  <Text style={styles.mapModalTitle}>Select Shop Location</Text>
                  <Text style={styles.mapModalSubtitle}>Tap on the map to place a pin</Text>
              </View>
              <View style={styles.mapModalFooter}>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsMapModalVisible(false)}>
                      <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleConfirmLocation} disabled={!selectedLocation}>
                      <Text style={styles.modalButtonText}>Confirm Location</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      <Modal animationType="slide" transparent={false} visible={isShopsListModalVisible} onRequestClose={handleCloseShopsListModal}>
        <ShopsList shopId={selectedShopIdForDetails} onClose={handleCloseShopsListModal} shops={shops} setShops={setShops} onDeleteShop={handleDeleteShopFromModal} onUpdateShop={handleUpdateShopFromModal} userToken={userToken} fetchOwnerShops={fetchOwnerShops} />
      </Modal>
    </ImageBackground>
  );
};

// --- STYLES (Added/Modified styles are at the bottom) ---
const styles = StyleSheet.create({
    // ... (all previous styles remain the same)
    backgroundImage: { flex: 1, resizeMode: "cover", width: "100%", height: "100%", },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(237,236,236,0.77)", },
    container: { flex: 1, paddingHorizontal: screenWidth * 0.05, paddingTop: screenHeight * 0.02, },
    contentContainer: { paddingBottom: screenHeight * 0.04, },
    headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: screenHeight * 0.03, },
    pageTitle: { fontSize: screenWidth * 0.08, fontWeight: "800", color: "#333", },
    addShopButtonHeader: { backgroundColor: '#3498db', flexDirection: 'row', alignItems: 'center', paddingVertical: screenHeight * 0.01, paddingHorizontal: screenWidth * 0.04, borderRadius: screenWidth * 0.06, elevation: 6, },
    addShopButtonHeaderText: { color: '#fff', fontSize: screenWidth * 0.04, fontWeight: '600', marginLeft: screenWidth * 0.015, },
    shopCard: { backgroundColor: "#fff", borderRadius: screenWidth * 0.04, overflow: "hidden", marginBottom: screenHeight * 0.025, elevation: 8, borderWidth: 1, borderColor: "#e0e0e0", },
    shopImageContainer: { position: "relative", width: "100%", height: screenHeight * 0.25, },
    statusBadge: { position: 'absolute', top: screenHeight * 0.02, left: screenWidth * 0.04, borderRadius: screenWidth * 0.02, paddingVertical: screenHeight * 0.005, paddingHorizontal: screenWidth * 0.03, zIndex: 1, },
    statusText: { fontSize: screenWidth * 0.035, fontWeight: 'bold', color: '#fff', },
    statusOpenBackground: { backgroundColor: '#28a745', },
    statusClosedBackground: { backgroundColor: '#dc3545', },
    statusToggle: { position: 'absolute', top: screenHeight * 0.015, right: screenWidth * 0.03, zIndex: 1, },
    shopDetails: { padding: screenWidth * 0.04, },
    shopName: { fontSize: screenWidth * 0.05, fontWeight: "700", color: "#2c3e50", marginBottom: screenHeight * 0.01, },
    shopAddress: { fontSize: screenWidth * 0.035, color: "#666", marginBottom: screenHeight * 0.01 },
    ratingTimeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: screenHeight * 0.01, paddingTop: screenHeight * 0.01, borderTopWidth: 1, borderTopColor: '#f5f5f5', },
    ratingContainer: { flexDirection: "row", alignItems: "center", },
    starsContainer: { flexDirection: "row", },
    ratingText: { fontSize: screenWidth * 0.04, fontWeight: "700", color: "#555", marginLeft: screenWidth * 0.01, },
    timeContainer: { flexDirection: "row", alignItems: "center", },
    timeText: { fontSize: screenWidth * 0.035, color: "#666", marginLeft: screenWidth * 0.01,width: screenWidth * 0.24 },
    modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", },
    modalContent: { width: "90%", maxHeight: '90%', backgroundColor: "#FFFFFF", padding: screenWidth * 0.05, borderRadius: screenWidth * 0.07, elevation: 20, },
    modalTitle: { fontSize: screenWidth * 0.068, fontWeight: "bold", marginBottom: 20, color: "#333", textAlign: 'center', },
    inputLabel: { alignSelf: 'flex-start', fontSize: screenWidth * 0.04, color: '#555', marginBottom: screenHeight * 0.01, fontWeight: '600', },
    input: { width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: screenWidth * 0.03, padding: screenHeight * 0.015, marginBottom: screenHeight * 0.02, fontSize: screenWidth * 0.04, backgroundColor: "#fefefe", },
    timeInputTouchable: { width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: screenHeight * 0.02, },
    timeInputIcon: { position: 'absolute', right: screenWidth * 0.04, top: screenHeight * 0.015, },
    modalButtonContainer: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: screenHeight * 0.02, },
    modalButton: { paddingVertical: screenHeight * 0.015, paddingHorizontal: screenWidth * 0.05, borderRadius: screenWidth * 0.02, alignItems: "center", flex: 1, marginHorizontal: screenWidth * 0.02, elevation: 7, },
    modalButtonText: { color: "#fff", fontSize: screenWidth * 0.04, fontWeight: "bold", },
    saveButton: { backgroundColor: "#28a745", },
    cancelButton: { backgroundColor: "#6c757d", },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', },
    loadingText: { marginTop: screenHeight * 0.02, fontSize: screenWidth * 0.045, color: '#555', },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: screenWidth * 0.06, },
    errorText: { fontSize: screenWidth * 0.045, color: '#dc3545', textAlign: 'center', marginBottom: screenHeight * 0.025, },
    retryButton: { backgroundColor: '#007bff', paddingVertical: screenHeight * 0.015, paddingHorizontal: screenWidth * 0.06, borderRadius: screenWidth * 0.02, },
    retryButtonText: { color: '#fff', fontSize: screenWidth * 0.04, fontWeight: 'bold', },
    noShopsContainer: { justifyContent: 'center', alignItems: 'center', marginTop: screenHeight * 0.07, padding: screenWidth * 0.06, backgroundColor: '#ffffff', borderRadius: screenWidth * 0.04, elevation: 5, },
    noShopsText: { fontSize: screenWidth * 0.045, color: '#777', textAlign: 'center', },
    carouselContainer: { width: "100%", height: screenHeight * 0.25, position: 'relative', },
    carouselImage: { width: screenWidth * 0.9, height: "100%", resizeMode: "cover", },
    carouselPlaceholder: { width: "100%", height: "100%", backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', },
    carouselPlaceholderText: { color: '#888', fontSize: screenWidth * 0.04, },
    pagination: { position: 'absolute', bottom: screenHeight * 0.01, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', },
    paginationDot: { width: screenWidth * 0.02, height: screenWidth * 0.02, borderRadius: screenWidth * 0.01, backgroundColor: 'rgba(255,255,255,0.6)', marginHorizontal: screenWidth * 0.01, },
    paginationDotActive: { backgroundColor: '#007bff', },

    // --- NEW / MODIFIED STYLES ---
    locationButtonsContainer: {
      flexDirection: 'column',
      marginBottom: screenHeight * 0.02,
    },
    locationButton: {
      flexDirection: 'row',
      backgroundColor: '#007bff',
      paddingVertical: screenHeight * 0.015,
      borderRadius: screenWidth * 0.03,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      marginBottom: screenHeight * 0.015, // Space between buttons
    },
    locationButtonText: {
        color: '#fff',
        fontSize: screenWidth * 0.04,
        fontWeight: 'bold',
        marginLeft: screenWidth * 0.03,
    },
    mapButton: {
      backgroundColor: '#5bc0de', // A different color for distinction
    },
    mapModalContainer: {
      flex: 1,
      backgroundColor: '#000'
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    mapModalHeader: {
        position: 'absolute',
        top: 40,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    mapModalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    mapModalSubtitle: {
        color: '#eee',
        fontSize: 14,
        marginTop: 5,
    },
    mapModalFooter: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
});

export default ShopSelection;