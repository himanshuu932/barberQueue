import React, { useState, useEffect } from "react";
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
} from "react-native";
// Removed useRouter and useLocalSearchParams as navigation is handled by modal state
// import { useRouter, useLocalSearchParams } from "expo-router";
import Icon from "react-native-vector-icons/FontAwesome";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';

// Import the ShopsList component (which will now be used as a modal content)
import ShopsList from "./shops"; // Ensure this path is correct

const { width } = Dimensions.get("window");

// --- Sample Static Data for Shops (Source of truth for THIS component) ---
// This data will be passed down to ShopsList and updated from there.
const initialStaticShopsData = [
  {
    id: 'shop1',
    name: 'The Classic Barber',
    address: '123 Main St, Anytown, USA',
    isOpen: true, // Manual override status
    isManuallyOverridden: false, // New: false means status is time-based by default
    openingTime: '09:00', // HH:MM format
    closingTime: '18:00', // HH:MM format
    carouselImages: [
      'https://picsum.photos/id/10/600/400',
      'https://picsum.photos/id/20/600/400',
      'https://picsum.photos/id/30/600/400',
    ],
    shopRating: { average: 4.5, count: 120 },
    todayStats: { earnings: 1500, customers: 15, popularService: 'Haircut', topEmployee: 'John Doe' },
    barbers: [
      { _id: 'b1', name: 'John Doe', email: 'john@example.com', phone: '111-222-3333', totalCustomersServed: 500, totalStarsEarned: 2200, totalRatings: 500 },
      { _id: 'b2', name: 'Jane Smith', email: 'jane@example.com', phone: '444-555-6666', totalCustomersServed: 450, totalStarsEarned: 1900, totalRatings: 450 },
    ],
  },
  {
    id: 'shop2',
    name: 'Modern Cuts & Styles',
    address: '456 Oak Ave, Othercity, USA',
    isOpen: false, // Manual override status
    isManuallyOverridden: false,
    openingTime: '10:00',
    closingTime: '20:00',
    carouselImages: [
      'https://picsum.photos/id/40/600/400',
      'https://picsum.photos/id/50/600/400',
      'https://picsum.photos/id/60/600/400',
      'https://picsum.photos/id/75/600/400',
      'https://picsum.photos/id/85/600/400',
      'https://picsum.photos/id/95/600/400',
      'https://picsum.photos/id/105/600/400',
    ],
    shopRating: { average: 4.2, count: 80 },
    todayStats: { earnings: 800, customers: 8, popularService: 'Beard Trim', topEmployee: 'Mike Johnson' },
    barbers: [
      { _id: 'b3', name: 'Mike Johnson', email: 'mike@example.com', phone: '777-888-9999', totalCustomersServed: 300, totalStarsEarned: 1200, totalRatings: 300 },
      { _id: 'b4', name: 'Emily White', email: 'emily@example.com', phone: '123-456-7890', totalCustomersServed: 280, totalStarsEarned: 1100, totalRatings: 280 },
    ],
  },
  {
    id: 'shop3',
    name: 'The Barbershop Co.',
    address: '789 Pine Ln, Anyville, USA',
    isOpen: true, // Manual override status
    isManuallyOverridden: false,
    openingTime: '08:30',
    closingTime: '19:30',
    carouselImages: [
      'https://picsum.photos/id/70/600/400',
      'https://picsum.photos/id/80/600/400',
      'https://picsum.photos/id/90/600/400',
      'https://picsum.photos/id/100/600/400',
      'https://picsum.photos/id/110/600/400',
      'https://picsum.photos/id/120/600/400',
      'https://picsum.photos/id/130/600/400',
      'https://picsum.photos/id/140/600/400',
    ],
    shopRating: { average: 4.8, count: 200 },
    todayStats: { earnings: 2000, customers: 20, popularService: 'Shave', topEmployee: 'Chris Green' },
    barbers: [
      { _id: 'b5', name: 'Chris Green', email: 'chris@example.com', phone: '098-765-4321', totalCustomersServed: 700, totalStarsEarned: 3400, totalRatings: 700 },
    ],
  },
];

// Helper function to check if a shop is open based on current time
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
  const [shops, setShops] = useState(initialStaticShopsData);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newShopData, setNewShopData] = useState({
    name: '',
    address: '',
    openingTime: '',
    closingTime: '',
    carouselImages: [],
  });

  // State for controlling the ShopsList modal
  const [isShopsListModalVisible, setIsShopsListModalVisible] = useState(false);
  const [selectedShopIdForDetails, setSelectedShopIdForDetails] = useState(null);


  // Effect to periodically update shop status based on time if not manually overridden
  useEffect(() => {
    const updateShopOpenStatus = () => {
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
    };

    // Initial check on mount
    updateShopOpenStatus();

    // Set up interval to check every minute
    const intervalId = setInterval(updateShopOpenStatus, 60 * 1000); // Every minute

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount


  // Function to handle clicking on a shop card to view its details (opens modal)
  const handleShopPress = (shopId) => {
    setSelectedShopIdForDetails(shopId);
    setIsShopsListModalVisible(true);
  };

  // Function to close the ShopsList modal
  const handleCloseShopsListModal = () => {
    setIsShopsListModalVisible(false);
    setSelectedShopIdForDetails(null); // Clear selected shop ID
  };

  // Function to update a shop from ShopsList modal
  const handleUpdateShopFromModal = (updatedShop) => {
    setShops(prevShops =>
      prevShops.map(shop =>
        shop.id === updatedShop.id ? updatedShop : shop
      )
    );
  };

  // Function to delete a shop from ShopsList modal
  const handleDeleteShopFromModal = (deletedShopId) => {
    setShops(prevShops =>
      prevShops.filter(shop => shop.id !== deletedShopId)
    );
    handleCloseShopsListModal(); // Close modal after deletion
  };


  // Function to toggle a shop's manual open/closed status
  const handleToggleShopStatus = (shopId) => {
    setShops((prevShops) =>
      prevShops.map((shop) =>
        shop.id === shopId
          ? { ...shop, isOpen: !shop.isOpen, isManuallyOverridden: true } // Mark as manually overridden
          : shop
      )
    );
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

  // Function to handle adding a new shop
  const handleAddNewShop = () => {
    if (!newShopData.name || !newShopData.address || !newShopData.openingTime || !newShopData.closingTime) {
      Alert.alert("Error", "Please fill in all required fields (Name, Address, Opening/Closing Times).");
      return;
    }
    const newShop = {
      id: `shop${shops.length + 1}`, // Simple ID generation
      isOpen: isShopCurrentlyOpen(newShopData.openingTime, newShopData.closingTime), // Initial status based on time
      isManuallyOverridden: false, // New shops are not manually overridden initially
      ...newShopData,
      shopRating: { average: 0, count: 0 }, // Default rating for new shops
      todayStats: { earnings: 0, customers: 0, popularService: 'N/A', topEmployee: 'N/A' },
      barbers: [], // New shops start with no barbers
    };
    setShops((prevShops) => [...prevShops, newShop]);
    setNewShopData({ name: '', address: '', openingTime: '', closingTime: '', carouselImages: [] }); // Reset form
    setIsAddModalVisible(false);
    Alert.alert("Success", "New shop added successfully!");
  };


  // ShopCard component for rendering individual shop items
  const ShopCard = ({ shop }) => {
    const averageRating = shop.shopRating.average;
    // The display status is directly from shop.isOpen, which is managed by toggle or auto-update
    const displayIsOpen = shop.isOpen;

    return (
      <TouchableOpacity
        style={styles.shopCard}
        onPress={() => handleShopPress(shop.id)}
        activeOpacity={0.7}
      >
        <View style={styles.shopImageContainer}>
          <Image
            source={{ uri: `https://picsum.photos/300/300?random=${shop.id}` }}
            style={styles.shopImage}
          />
          {/* Moved Status Toggle to top right */}
          <Switch
            trackColor={{ false: "#a30000", true: "#006400" }} // Darker Red for off, Darker Green for on
            thumbColor={displayIsOpen ? "#f5dd4b" : "#f4f3f4"} // Yellow for on, grey for off
            ios_backgroundColor="#3e3e3e"
            onValueChange={() => handleToggleShopStatus(shop.id)}
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
        <FlatList
          data={shops}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ShopCard shop={item} />}
          scrollEnabled={false} // Since it's inside a ScrollView, FlatList doesn't need to scroll itself
          contentContainerStyle={styles.shopsList}
          numColumns={2}
          columnWrapperStyle={styles.shopRow}
        />
      </ScrollView>

      {/* Add Shop Button */}
      <TouchableOpacity
        style={styles.addShopFAB}
        onPress={() => setIsAddModalVisible(true)}
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
            <Text style={styles.inputLabel}>Opening Time (HH:MM):</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 09:00"
              value={newShopData.openingTime}
              onChangeText={(text) =>
                setNewShopData({ ...newShopData, openingTime: text })
              }
              keyboardType="numeric" // Use numeric for time input
            />
            <Text style={styles.inputLabel}>Closing Time (HH:MM):</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 18:00"
              value={newShopData.closingTime}
              onChangeText={(text) =>
                setNewShopData({ ...newShopData, closingTime: text })
              }
              keyboardType="numeric" // Use numeric for time input
            />

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
});

export default ShopSelection;