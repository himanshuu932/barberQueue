import React, { useState, useEffect, useCallback } from "react";
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
  ActionSheetIOS, // For iOS ActionSheet
  ActivityIndicator, // For loading indicator
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import Icon from "react-native-vector-icons/FontAwesome";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker'; 

import ShopsList from "../../components/owner/shops"; 

const { width } = Dimensions.get("window");

// IMPORTANT: Replace with your actual backend API URL
const API_BASE_URL = 'http://10.0.2.2:5000/api'; 


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
      // Standard opening hours (e.g., 09:00 - 18:00)
      return currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes;
    } else {
      // Overnight opening hours (e.g., 22:00 - 06:00)
      return currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes < closeTimeInMinutes;
    }
  } catch (e) {
    console.error("Error parsing time:", e);
    return false; // Default to closed if time parsing fails
  }
};

const ShopSelection = () => {
  const [shops, setShops] = useState([]); // Initialize as empty, will be fetched dynamically
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newShopData, setNewShopData] = useState({
    name: '',
    address: '', // This will be fullDetails
    openingTime: '',
    closingTime: '',
    carouselImages: [],
  });
  const [userToken, setUserToken] = useState(null);
  const [loading, setLoading] = useState(true); // Loading state for fetching shops
  const [error, setError] = useState(null); // Error state for API calls

  // State for controlling the ShopsList modal
  const [isShopsListModalVisible, setIsShopsListModalVisible] = useState(false);
  const [selectedShopIdForDetails, setSelectedShopIdForDetails] = useState(null);

  // State for time pickers
  const [showOpeningTimePicker, setShowOpeningTimePicker] = useState(false);
  const [showClosingTimePicker, setShowClosingTimePicker] = useState(false);
  const [tempOpeningTime, setTempOpeningTime] = useState(new Date()); // Temporary Date object for picker
  const [tempClosingTime, setTempClosingTime] = useState(new Date()); // Temporary Date object for picker


  // Function to format Date object to HH:MM string
  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Handler for opening time picker
  const onOpeningTimeChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempOpeningTime;
    setShowOpeningTimePicker(Platform.OS === 'ios'); // Keep picker open on iOS until done button is pressed
    setTempOpeningTime(currentDate);
    setNewShopData({ ...newShopData, openingTime: formatTime(currentDate) });
  };

  // Handler for closing time picker
  const onClosingTimeChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempClosingTime;
    setShowClosingTimePicker(Platform.OS === 'ios'); // Keep picker open on iOS until done button is pressed
    setTempClosingTime(currentDate);
    setNewShopData({ ...newShopData, closingTime: formatTime(currentDate) });
  };

  // Function to fetch owner's shops from the backend
  const fetchOwnerShops = useCallback(async (token) => {
    if (!token) {
      setError('Authentication token not found. Please log in.');
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
      console.log('Fetched owner shops:', data);
      // Map the fetched data to match the structure expected by ShopCard
      const formattedShops = data.data.map(shop => ({
        _id: shop._id, // Use _id from MongoDB
        name: shop.name,
        address: shop.address.fullDetails, // Use fullDetails for display
        isOpen: shop.isManuallyOverridden ? shop.isOpen : isShopCurrentlyOpen(shop.openingTime, shop.closingTime), // Use isManuallyOverridden if true, else calculate
        isManuallyOverridden: shop.isManuallyOverridden,
        openingTime: shop.openingTime,
        closingTime: shop.closingTime,
        carouselImages: shop.photos || [], // Use 'photos' from schema
        shopRating: shop.rating ? { average: shop.rating, count: 0 } : { average: 0, count: 0 }, // Adjust if backend sends full rating object or count
        todayStats: { earnings: 0, customers: 0, popularService: 'N/A', topEmployee: 'N/A' }, // Placeholder, not from schema
        barbers: shop.barbers || [], // Populate barbers if needed
      }));
      setShops(formattedShops);
    } catch (err) {
      console.error('Error fetching owner shops:', err);
      setError(err.message || 'Failed to fetch shops.');
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array as fetchOwnerShops doesn't depend on any state/props that change during its lifecycle

  // Effect to fetch token and shops on component mount
  useEffect(() => {
    const init = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken'); // Retrieve token
        if (token) {
          setUserToken(token);
          await fetchOwnerShops(token);
        } else {
          console.warn('No user token found. User might not be logged in.');
          // Optionally, navigate to login screen if no token
          setLoading(false);
        }
      } catch (err) {
        console.error('Error initializing data:', err);
        setError('Failed to load initial data.');
        setLoading(false);
      }
    };
    init();

    // Set up interval to periodically update shop status based on time if not manually overridden
    const intervalId = setInterval(() => {
      setShops(prevShops =>
        prevShops.map(shop => {
          if (!shop.isManuallyOverridden) {
            const newIsOpen = isShopCurrentlyOpen(shop.openingTime, shop.closingTime);
            if (newIsOpen !== shop.isOpen) {
              return { ...shop, isOpen: newIsOpen };
            }
          }
          return shop;
        })
      );
    }, 60 * 1000); // Every minute

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchOwnerShops]); // Dependency on fetchOwnerShops to ensure it's the latest version

  // Function to handle clicking on a shop card to view its details (opens modal)
  const handleShopPress = (_id) => { // Use _id here
    console.log('Selected shop ID for details:', _id);
    setSelectedShopIdForDetails(_id);
    setIsShopsListModalVisible(true);
  };

  // Function to close the ShopsList modal
  const handleCloseShopsListModal = () => {
    setIsShopsListModalVisible(false);
    setSelectedShopIdForDetails(null); // Clear selected shop ID
    // Re-fetch shops to ensure latest data after modal actions (update/delete)
    if (userToken) {
      fetchOwnerShops(userToken);
    }
  };

  // Function to update a shop from ShopsList modal (client-side update for immediate feedback)
  const handleUpdateShopFromModal = (updatedShop) => {
    setShops(prevShops =>
      prevShops.map(shop =>
        shop._id === updatedShop._id ? updatedShop : shop // Use _id
      )
    );
  };

  // Function to delete a shop from ShopsList modal (client-side update for immediate feedback)
  const handleDeleteShopFromModal = (deletedShopId) => {
    setShops(prevShops =>
      prevShops.filter(shop => shop._id !== deletedShopId) // Use _id
    );
    handleCloseShopsListModal(); // Close modal after deletion
  };


  // Function to toggle a shop's manual open/closed status (and update backend)
  const handleToggleShopStatus = async (shopId) => {
    if (!userToken) {
      Alert.alert("Error", "Authentication token not found. Please log in again.");
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          isManuallyOverridden: true, // Always set to true when manually toggled
          isOpen: newIsOpenStatus // Send the new desired open status (though backend calculates this from isManuallyOverridden)
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to update shop status.');
      }

      // Update local state immediately for responsiveness
      setShops((prevShops) =>
        prevShops.map((shop) =>
          shop._id === shopId
            ? { ...shop, isOpen: newIsOpenStatus, isManuallyOverridden: true }
            : shop
        )
      );
      Alert.alert("Success", "Shop status updated successfully!");
    } catch (err) {
      console.error('Error toggling shop status:', err);
      Alert.alert("Error", err.message || "Failed to toggle shop status. Please try again.");
    }
  };

  // Function to handle adding a new image to carousel (via ImagePicker) - Only for Add Shop Modal here
  const pickImage = async () => {
    // Request media library permissions
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // Request camera permissions
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();

    if (mediaStatus !== 'granted' || cameraStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable camera and media library permissions in your device settings to add images.'
      );
      return;
    }

    const options = ['Take Photo', 'Choose from Gallery', 'Cancel'];
    const cancelButtonIndex = 2;

    const handleSelection = async (buttonIndex) => {
      let result;
      if (buttonIndex === 0) { // Take Photo
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1,
        });
      } else if (buttonIndex === 1) { // Choose from Gallery
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1,
        });
      }

      if (result && !result.canceled) {
        const newImageUri = result.assets[0].uri;
        setNewShopData((prevData) => ({
          ...prevData,
          carouselImages: [newImageUri, ...prevData.carouselImages],
        }));
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
        },
        handleSelection
      );
    } else {
      Alert.alert(
        'Add Image',
        'Choose an option to add an image:',
        options.map((title, index) => ({
          text: title,
          onPress: () => handleSelection(index),
          style: index === cancelButtonIndex ? 'cancel' : 'default',
        })),
        { cancelable: true }
      );
    }
  };

  // Function to remove a carousel image from the list being edited - Only for Add Shop Modal here
  const handleRemoveCarouselImage = (indexToRemove) => {
    setNewShopData((prevData) => ({
      ...prevData,
      carouselImages: prevData.carouselImages.filter(
        (_, index) => index !== indexToRemove
      ),
    }));
  };

  // Function to handle adding a new shop (API call)
  const handleAddNewShop = async () => {
    if (!newShopData.name || !newShopData.address || !newShopData.openingTime || !newShopData.closingTime) {
      Alert.alert("Error", "Please fill in all required fields (Name, Address, Opening/Closing Times).");
      return;
    }
    if (!userToken) {
      Alert.alert("Error", "Authentication token not found. Please log in again.");
      return;
    }

    try {
      // For a real app, you'd integrate a geo-coding API (e.g., Google Maps Geocoding API)
      // to convert `newShopData.address` string into `coordinates: [longitude, latitude]`.
      // For this example, we'll use dummy coordinates.
      const dummyCoordinates = [-74.0060, 40.7128]; // Example: New York City (longitude, latitude)

      const shopToCreate = {
        name: newShopData.name,
        address: {
          fullDetails: newShopData.address,
          coordinates: {
            type: 'Point',
            coordinates: dummyCoordinates,
          },
        },
        photos: newShopData.carouselImages,
        openingTime: newShopData.openingTime,
        closingTime: newShopData.closingTime,
        // isManuallyOverridden defaults to false on the backend as per schema
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
      setNewShopData({ name: '', address: '', openingTime: '', closingTime: '', carouselImages: [] }); // Reset form
      await fetchOwnerShops(userToken); // Re-fetch shops to update the list
    } catch (err) {
      console.error('Error adding new shop:', err);
      Alert.alert("Error", err.message || "Failed to add new shop. Please try again.");
    }
  };


  // ShopCard component for rendering individual shop items
  const ShopCard = ({ shop }) => {
    const averageRating = shop.shopRating.average;
    // The display status is directly from shop.isOpen, which is managed by toggle or auto-update
    const displayIsOpen = shop.isOpen;

    return (
      <TouchableOpacity
        style={styles.shopCard}
        onPress={() => handleShopPress(shop._id)} // Pass shop._id
        activeOpacity={0.7}
      >
        <View style={styles.shopImageContainer}>
          {/* Use actual shop photos if available, otherwise a placeholder */}
          <Image
            source={{ uri: shop.carouselImages && shop.carouselImages.length > 0 ? shop.carouselImages[0] : `https://placehold.co/300x300/E0E0E0/555555?text=${shop.name.charAt(0)}` }}
            style={styles.shopImage}
          />
          {/* Moved Status Toggle to top right */}
          <Switch
            trackColor={{ false: "#a30000", true: "#006400" }} // Darker Red for off, Darker Green for on
            thumbColor={displayIsOpen ? "#f5dd4b" : "#f4f3f4"} // Yellow for on, grey for off
            ios_backgroundColor="#3e3e3e"
            onValueChange={() => handleToggleShopStatus(shop._id)} // Pass shop._id
            value={displayIsOpen}
            style={styles.statusToggleMoved} // New style for moved toggle
          />
        </View>

        <View style={styles.shopDetails}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>

          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                  key={star}
                  name="star"
                  size={14}
                  color={star <= Math.round(averageRating) ? "#FFD700" : "#E0E0E0"}
                  style={{ marginRight: 2 }}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
          </View>

          <View style={styles.shopMeta}>
            <View style={styles.metaItem}>
              <FontAwesome5 name="clock" size={12} color="#666" />
              <Text style={styles.metaText}>{shop.openingTime} - {shop.closingTime}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
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
    <ImageBackground
      source={require("../image/bglogin.png")} // Make sure this path is correct
      style={styles.backgroundImage}
    >
      <View style={styles.overlay} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.pageTitle}>Your Shops</Text>
        {shops.length === 0 ? (
          <View style={styles.noShopsContainer}>
            <Text style={styles.noShopsText}>No shops found. Add your first shop!</Text>
          </View>
        ) : (
          <FlatList
            data={shops}
            keyExtractor={(item) => item._id} // Use item._id for key
            renderItem={({ item }) => <ShopCard shop={item} />}
            scrollEnabled={false} // Since it's inside a ScrollView, FlatList doesn't need to scroll itself
            contentContainerStyle={styles.shopsList}
            numColumns={2}
            columnWrapperStyle={styles.shopRow}
          />
        )}
      </ScrollView>

      {/* Add Shop Button */}
      <TouchableOpacity
        style={styles.addShopFAB}
        onPress={() => {
          setIsAddModalVisible(true);
          // Initialize temp times to current time when modal opens
          setTempOpeningTime(new Date());
          setTempClosingTime(new Date());
          // Also set the formatted string in newShopData if you want default values
          setNewShopData(prev => ({
            ...prev,
            openingTime: formatTime(new Date()),
            closingTime: formatTime(new Date()),
          }));
        }}
      >
        <Icon name="plus" size={24} color="#fff" />
        <Text style={styles.addShopFABText}>Add Shop</Text>
      </TouchableOpacity>

      {/* Add Shop Modal */}
      <Modal visible={isAddModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Shop</Text>

            <Text style={styles.inputLabel}>Shop Name:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter shop name"
              value={newShopData.name}
              onChangeText={(text) =>
                setNewShopData({ ...newShopData, name: text })
              }
            />
            <Text style={styles.inputLabel}>Shop Address:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter shop address"
              value={newShopData.address}
              onChangeText={(text) =>
                setNewShopData({ ...newShopData, address: text })
              }
            />
            
            {/* Opening Time Input with Time Picker */}
            <Text style={styles.inputLabel}>Opening Time:</Text>
            <TouchableOpacity onPress={() => setShowOpeningTimePicker(true)} style={styles.timeInputTouchable}>
              <TextInput
                style={styles.input}
                placeholder="Select opening time"
                value={newShopData.openingTime}
                editable={false} // Make it read-only
              />
              <Icon name="clock-o" size={20} color="#666" style={styles.timeInputIcon} />
            </TouchableOpacity>
            {showOpeningTimePicker && (
              <DateTimePicker
                testID="openingTimePicker"
                value={tempOpeningTime}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={onOpeningTimeChange}
              />
            )}

            {/* Closing Time Input with Time Picker */}
            <Text style={styles.inputLabel}>Closing Time:</Text>
            <TouchableOpacity onPress={() => setShowClosingTimePicker(true)} style={styles.timeInputTouchable}>
              <TextInput
                style={styles.input}
                placeholder="Select closing time"
                value={newShopData.closingTime}
                editable={false} // Make it read-only
              />
              <Icon name="clock-o" size={20} color="#666" style={styles.timeInputIcon} />
            </TouchableOpacity>
            {showClosingTimePicker && (
              <DateTimePicker
                testID="closingTimePicker"
                value={tempClosingTime}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={onClosingTimeChange}
              />
            )}

            <Text style={styles.carouselImagesTitle}>Carousel Images:</Text>
            <ScrollView style={styles.carouselEditScrollVertical}>
              <View style={styles.carouselImagesGrid}>
                <TouchableOpacity style={styles.addImageButton} onPress={() => pickImage()}>
                  <Icon name="plus" size={30} color="#007bff" />
                  <Text style={styles.addImageButtonText}>Add Image</Text>
                </TouchableOpacity>
                {newShopData.carouselImages.map((imageUri, index) => (
                  <View key={index} style={styles.carouselEditImageContainer}>
                    <Image source={{ uri: imageUri }} style={styles.carouselEditImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveCarouselImage(index)}
                    >
                      <Icon name="times-circle" size={24} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsAddModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddNewShop}
              >
                <Text style={styles.modalButtonText}>Add Shop</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Shop Details Modal (Full Screen) - Now rendering ShopsList as a modal */}
      <Modal
        animationType="slide"
        transparent={false} // Set to false for full-screen modal
        visible={isShopsListModalVisible}
        onRequestClose={handleCloseShopsListModal} // Handles Android back button
      >
        <ShopsList
          shopId={selectedShopIdForDetails}
          onClose={handleCloseShopsListModal} // Pass the onClose function
          shops={shops} // Pass the entire shops array
          setShops={setShops} // Pass the setShops function to allow updates
          onDeleteShop={handleDeleteShopFromModal} // Pass delete handler
          onUpdateShop={handleUpdateShopFromModal} // Pass update handler
          userToken={userToken} // Pass the token
          fetchOwnerShops={fetchOwnerShops} // Pass the fetch function to re-fetch after changes
        />
      </Modal>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(237, 236, 236, 0.77)",
  },
  container: {
    flex: 1,
    padding: 10,
  },
  contentContainer: {
    alignItems: "center",
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  shopsList: {
    width: "100%",
  },
  shopRow: {
    justifyContent: "space-between", // Distribute items evenly
  },
  // --- UPDATED ShopCard Styling ---
  shopCard: {
    backgroundColor: "#fff",
    width: (width - 60) / 2, // (Total width - (2*paddingHorizontal of container) - (margin between cards)) / 2
    marginHorizontal: 10, // Add horizontal margin to each card
    borderRadius: 12,
    overflow: "hidden",
    elevation: 5, // Android shadow
    shadowColor: "#000", // iOS shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "#eee",
    position: 'relative',
    marginBottom: 20, // Add bottom margin for spacing between rows
  },
  selectedShopCard: { // This style might not be used if selection is handled by navigation
    borderColor: "#186ac8",
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
  },
  shopImageContainer: {
    position: "relative",
    width: "100%",
    height: 100,
  },
  shopImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  statusToggleMoved: { // New style for the moved toggle
    position: 'absolute',
    top: 0, // Moved further up
    right: 0, // Moved further right
    zIndex: 1,
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }], // Adjust size if needed
  },
  shopDetails: {
    padding: 12,
  },
  shopName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: "row",
  },
  ratingText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#555",
  },
  shopMeta: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: 'center',
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
  },
  metaText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
  },
  shopActions: { // This style is no longer used for individual cards in ShopSelection
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  shopEditButton: { // This style is no longer used for individual cards in ShopSelection
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: "#007bff",
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  shopEditButtonText: { // This style is no longer used for individual cards in ShopSelection
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },

  // Add Shop Floating Action Button
  addShopFAB: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#007bff',
    borderRadius: 30,
    width: 120,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  addShopFABText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // Modal Styles (Only Add Shop remains here)
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 15,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
    fontWeight: '600',
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  // Styles for the time input and icon
  timeInputTouchable: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  timeInputIcon: {
    position: 'absolute',
    right: 15,
    top: 12, // Adjust to vertically center
  },
  carouselImagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  carouselEditScrollVertical: {
    width: '100%',
    maxHeight: 250, // Show about 2-3 rows (6-9 images) before scrolling
    marginBottom: 20,
  },
  carouselImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around', // Changed to space-around to better distribute items
  },
  carouselEditImageContainer: {
    position: 'relative',
    // Calculate width for 3 items per row with some spacing
    width: (width * 0.9 - 25 * 2 - 20) / 3, // (Modal width - modal padding * 2 - total margin space) / 3
    height: (width * 0.9 - 25 * 2 - 20) / 3, // Keep aspect ratio square
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10, // Space between rows
    marginHorizontal: 5, // Small horizontal margin
  },
  carouselEditImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    padding: 2,
  },
  addImageButton: {
    width: (width * 0.9 - 25 * 2 - 20) / 3, // Match width of image containers
    height: (width * 0.9 - 25 * 2 - 20) / 3,
    backgroundColor: '#e0f7fa',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007bff',
    borderStyle: 'dashed',
    marginBottom: 10,
    marginHorizontal: 5, // Small horizontal margin
  },
  addImageButtonText: {
    fontSize: 12,
    color: '#007bff',
    marginTop: 5,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#28a745",
  },
  deleteButton: { // This style is no longer directly used in ShopSelection
    backgroundColor: "#dc3545",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: '#555',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noShopsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noShopsText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default ShopSelection;
