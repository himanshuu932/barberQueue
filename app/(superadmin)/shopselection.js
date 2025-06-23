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
  ActionSheetIOS,
  ActivityIndicator,
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
  const [shops, setShops] = useState([]);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newShopData, setNewShopData] = useState({
    name: '',
    address: '',
    openingTime: '',
    closingTime: '',
    carouselImages: [],
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
          console.warn('No user token found. User might not be logged in.');
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
    }, 60 * 1000); // Every minute

    return () => clearInterval(intervalId);
  }, [fetchOwnerShops]);

  const handleShopPress = (_id) => {
    console.log('Selected shop ID for details:', _id);
    setSelectedShopIdForDetails(_id);
    setIsShopsListModalVisible(true);
  };

  const handleCloseShopsListModal = () => {
    setIsShopsListModalVisible(false);
    setSelectedShopIdForDetails(null);
    if (userToken) {
      fetchOwnerShops(userToken);
    }
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          isManuallyOverridden: true,
          isOpen: newIsOpenStatus
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to update shop status.');
      }
      setShops((prevShops) => prevShops.map((shop) =>
        shop._id === shopId
          ? { ...shop, isOpen: newIsOpenStatus, isManuallyOverridden: true }
          : shop
      ));
      Alert.alert("Success", "Shop status updated successfully!");
    } catch (err) {
      console.error('Error toggling shop status:', err);
      Alert.alert("Error", err.message || "Failed to toggle shop status. Please try again.");
    }
  };

  const pickImage = async () => {
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();

    if (mediaStatus !== 'granted' || cameraStatus !== 'granted') {
      Alert.alert('Permission Required', 'Please enable camera and media library permissions in your device settings to add images.');
      return;
    }

    const options = ['Take Photo', 'Choose from Gallery', 'Cancel'];
    const cancelButtonIndex = 2;

    const handleSelection = async (buttonIndex) => {
      let result;
      if (buttonIndex === 0) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1,
        });
      } else if (buttonIndex === 1) {
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
const handleRemoveCarouselImage = (photo, index) => {
  Alert.alert(
    "Confirm Removal",
    "Are you sure you want to remove this image?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        onPress: async () => {
          try {
            setLoading(true);
            // For newly added images (not yet uploaded)
            if (typeof photo === 'string') {
              setNewShopData(prev => ({
                ...prev,
                carouselImages: prev.carouselImages.filter((_, i) => i !== index),
              }));
              return;
            }
            
            // For uploaded images
            if (!selectedShopIdForDetails) {
              throw new Error('Shop ID not found');
            }
            
            const response = await fetch(
              `${API_BASE_URL}/shops/${selectedShopIdForDetails}/photos/${photo.public_id}`,
              {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${userToken}` },
              }
            );
            
            if (!response.ok) throw new Error('Failed to delete image');
            
            // Update UI state
            setNewShopData(prev => ({
              ...prev,
              carouselImages: prev.carouselImages.filter(img => 
                typeof img === 'object' ? img.public_id !== photo.public_id : true
              ),
            }));
            
            Alert.alert('Success', 'Image removed successfully');
          } catch (error) {
            console.error('Error deleting image:', error);
            Alert.alert('Error', error.message);
          } finally {
            setLoading(false);
          }
        },
      }
    ]
  );
};

  const handleAddNewShop = async () => {
    if (!newShopData.name || !newShopData.address || !newShopData.openingTime || !newShopData.closingTime) {
      Alert.alert("Error", "Please fill in all required fields (Name, Address, Opening/Closing Times).");
      return;
    }
    if (!userToken) {
      Alert.alert("Error", "Authentication token not found. Please login again.");
      return;
    }
    try {
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
      setNewShopData({ name: '', address: '', openingTime: '', closingTime: '', carouselImages: [] });
      await fetchOwnerShops(userToken);
    } catch (err) {
      console.error('Error adding new shop:', err);
      Alert.alert("Error", err.message || "Failed to add new shop. Please try again.");
    }
  };

  const ShopCard = ({ shop }) => {
    const averageRating = shop.shopRating.average;
    const displayIsOpen = shop.isOpen;

    return (
      <TouchableOpacity
        style={styles.shopCard}
        onPress={() => handleShopPress(shop._id)}
        activeOpacity={0.8}
      >
        <View style={styles.shopImageContainer}>
          <Image
            source={{
              uri:
               shop.photos && shop.photos.length > 0 
      ? (typeof shop.photos[0] === 'string' ? shop.photos[0] : shop.photos[0].url)
                  : `https://placehold.co/300x200/F5F5F5/888888?text=${shop.name.charAt(0)}`,
            }}
            style={styles.shopImage}
          />
          <View style={[styles.statusBadge, displayIsOpen ? styles.statusOpenBackground : styles.statusClosedBackground]}>
            <Text style={styles.statusText}>
              {displayIsOpen ? "Open" : "Closed"}
            </Text>
          </View>
          <Switch
            trackColor={{ false: "#a30000", true: "#006400" }}
            thumbColor={displayIsOpen ? "#f5dd4b" : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
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
                  <Icon
                    key={star}
                    name="star"
                    size={16}
                    color={star <= Math.round(averageRating) ? "#FFD700" : "#E0E0E0"}
                    style={{ marginRight: 2 }}
                  />
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
      source={require("../image/bglogin.png")}
      style={styles.backgroundImage}
    >
      <View style={styles.overlay} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.pageTitle}>Your Shops</Text>
          <TouchableOpacity
            style={styles.addShopButtonHeader}
            onPress={() => {
              setIsAddModalVisible(true);
              setTempOpeningTime(new Date());
              setTempClosingTime(new Date());
              setNewShopData(prev => ({
                ...prev,
                openingTime: formatTime(new Date()),
                closingTime: formatTime(new Date()),
              }));
            }}
          >
            <Icon name="plus" size={18} color="#fff" />
            <Text style={styles.addShopButtonHeaderText}>Add Shop</Text>
          </TouchableOpacity>
        </View>

        {shops.length === 0 ? (
          <View style={styles.noShopsContainer}>
            <Text style={styles.noShopsText}>No shops found. Add your first shop!</Text>
          </View>
        ) : (
          <FlatList
            data={shops}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <ShopCard shop={item} />}
            scrollEnabled={false}
            contentContainerStyle={styles.shopsList}
          />
        )}
      </ScrollView>

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
              onChangeText={(text) => setNewShopData({ ...newShopData, name: text })}
            />

            <Text style={styles.inputLabel}>Shop Address:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter shop address"
              value={newShopData.address}
              onChangeText={(text) => setNewShopData({ ...newShopData, address: text })}
            />

            <Text style={styles.inputLabel}>Opening Time:</Text>
            <TouchableOpacity onPress={() => setShowOpeningTimePicker(true)} style={styles.timeInputTouchable}>
              <TextInput
                style={styles.input}
                placeholder="Select opening time"
                value={newShopData.openingTime}
                editable={false}
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

            <Text style={styles.inputLabel}>Closing Time:</Text>
            <TouchableOpacity onPress={() => setShowClosingTimePicker(true)} style={styles.timeInputTouchable}>
              <TextInput
                style={styles.input}
                placeholder="Select closing time"
                value={newShopData.closingTime}
                editable={false}
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
            <ScrollView horizontal style={styles.carouselEditScrollHorizontal} contentContainerStyle={styles.carouselImagesGrid}>
              <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                <Icon name="plus" size={30} color="#007bff" />
                <Text style={styles.addImageButtonText}>Add Image</Text>
              </TouchableOpacity>
{newShopData.carouselImages.map((image, index) => (
  <View key={index} style={styles.carouselEditImageContainer}>
    <Image 
      source={{ uri: typeof image === 'string' ? image : image.url }} 
      style={styles.carouselEditImage} 
    />
    <TouchableOpacity 
      style={styles.removeImageButton} 
      onPress={() => handleRemoveCarouselImage(image, index)}
    >
      <Icon name="times-circle" size={24} color="#dc3545" />
    </TouchableOpacity>
  </View>
))}
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

      {/* Shop Details Modal (FullScreen) - Now rendering ShopsList as a modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isShopsListModalVisible}
        onRequestClose={handleCloseShopsListModal}
      >
        <ShopsList
          shopId={selectedShopIdForDetails}
          onClose={handleCloseShopsListModal}
          shops={shops}
          setShops={setShops}
          onDeleteShop={handleDeleteShopFromModal}
          onUpdateShop={handleUpdateShopFromModal}
          userToken={userToken}
          fetchOwnerShops={fetchOwnerShops}
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
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(237,236,236,0.77)",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#2c3e50",
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  addShopButtonHeader: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  addShopButtonHeaderText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 7,
  },

  // --- Shop Card Styling (One per row, visually appealing) ---
  shopsList: {
    width: "100%",
  },
  shopCard: {
    backgroundColor: "#fff",
    width: '100%',
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  shopImageContainer: {
    position: "relative",
    width: "100%",
    height: 180,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  shopImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  // Fix for 'Open' tag background not occupying full area
  statusBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    minWidth: 70, // Ensure minimum width for consistent look
    alignItems: 'center', // Center text within the badge
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusOpenBackground: {
    backgroundColor: '#28a745', // Green for open
  },
  statusClosedBackground: {
    backgroundColor: '#dc3545', // Red for closed
  },
  statusToggle: {
    position: 'absolute',
    top: 10,
    right: 10,
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
  shopDetails: {
    padding: 15,
  },
  shopName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 8,
  },
  shopAddress: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
  },
  ratingTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  starsContainer: {
    flexDirection: "row",
  },
  ratingText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#555",
    marginLeft: 5,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 5,
  },

  // --- Modal Styles (Add Shop Modal) ---
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 25,
    color: "#333",
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: 15,
    color: '#555',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    fontSize: 16,
    backgroundColor: "#fefefe",
  },
  timeInputTouchable: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  timeInputIcon: {
    position: 'absolute',
    right: 15,
    top: 14,
  },
  carouselImagesTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  carouselEditScrollHorizontal: {
    width: '100%',
    height: 120,
    marginBottom: 20,
  },
  carouselImagesGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5, // Add a bit of horizontal padding for scroll view content
  },
  carouselEditImageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    marginRight: 10,
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 15,
    padding: 3,
  },
  addImageButton: {
    width: 100,
    height: 100,
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#64b5f6',
    borderStyle: 'dashed',
    marginRight: 10,
  },
  addImageButtonText: {
    fontSize: 12,
    color: '#007bff',
    marginTop: 5,
    fontWeight: '600',
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 25,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 7,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#28a745",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
  },

  // --- Loading/Error/No Shops Styles ---
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 19,
    color: '#555',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 25,
  },
  errorText: {
    fontSize: 19,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  noShopsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
    padding: 25,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginHorizontal: 10,
  },
  noShopsText: {
    fontSize: 19,
    color: '#777',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '500',
  },
});

export default ShopSelection;