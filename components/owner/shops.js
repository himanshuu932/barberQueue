import React, { useState, useEffect, useRef } from "react";
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
  Dimensions,
  Platform,
  ActionSheetIOS,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker'; // For picking images for carousel
import { v4 as uuidv4 } from 'uuid'; // To generate unique IDs for barbers and carousel images

const { width: screenWidth } = Dimensions.get("window");

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
    const closeTimeInMinutes = closeHours * 60 + closeMinutes; // Fixed: This was a typo, should be closeTimeInMinutes

    if (openTimeInMinutes <= closeTimeInMinutes) {
      // Standard opening hours (e.g., 09:00-18:00)
      return currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes;
    } else {
      // Overnight opening hours (e.g., 22:00-06:00)
      return currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes < closeTimeInMinutes;
    }
  } catch (e) {
    console.error("Error parsing time:", e);
    return false; // Default to closed if time parsing fails
  }
};

const ShopsList = ({ shopId, onClose, shops, setShops, onDeleteShop, onUpdateShop }) => {
  const [currentShop, setCurrentShop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ShopEditModal States
  const [isEditShopModalVisible, setIsEditShopModalVisible] = useState(false);
  const [editedShopData, setEditedShopData] = useState(null); // Data for the shop being edited

  // Barber Modals States
  const [isAddBarberModalVisible, setIsAddBarberModalVisible] = useState(false);
  const [newBarberData, setNewBarberData] = useState({ name: '', email: '', phone: '', password: '', averageRating: 0, totalRatings: 0 });
  const [isEditBarberModalVisible, setIsEditBarberModalVisible] = useState(false);
  const [editingBarber, setEditingBarber] = useState(null); // The barber being edited

  // Confirmation Modals
  const [isDeleteShopConfirmModalVisible, setIsDeleteShopConfirmModalVisible] = useState(false);
  const [isDeleteBarberConfirmModalVisible, setIsDeleteBarberConfirmModalVisible] = useState(false);
  const [barberToDelete, setBarberToDelete] = useState(null);

  // Carousel States
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselScrollViewRef = useRef(null);

  //---Shop Details and Initial Loading---
  useEffect(() => {
    setIsLoading(true);
    if (shopId && shops) {
      const foundShop = shops.find(s => s.id === shopId);
      if (foundShop) {
        setCurrentShop(foundShop);
        // Initialize editedShopData for the shop edit modal, ensuring carouselImages is a copy
        setEditedShopData({ ...foundShop, carouselImages: [...foundShop.carouselImages] });
      } else {
        Alert.alert("Error", "Shop not found.");
        onClose(); // Close the modal if shop not found
      }
    } else {
      Alert.alert("Error", "No shop ID provided.");
      onClose(); // Close the modal if no shopId
    }
    setIsLoading(false);
  }, [shopId, shops]); // Re-run if shopId or the main 'shops' array changes

  //---Carousel Logic (Auto-scrolling)---
  useEffect(() => {
    let interval;
    if (currentShop && currentShop.carouselImages.length > 1) {
      interval = setInterval(() => {
        setCarouselIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % currentShop.carouselImages.length;
          carouselScrollViewRef.current?.scrollTo({
            x: nextIndex * (screenWidth - 30), // Scroll to the next image
            animated: true,
          });
          return nextIndex;
        });
      }, 3000); // Change image every 3 seconds
    }
    return () => clearInterval(interval); // Clean up the interval on component unmount
  }, [currentShop, screenWidth]); // Re-run effect if currentShop or screenWidth changes

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / (screenWidth - 30)); // Assuming carousel image width is screenWidth-30
    setCarouselIndex(newIndex);
  };

  //---Shop Edit Modal Logic---
  const handleOpenEditShopModal = () => {
    // Ensure editedShopData is up-to-date with currentShop before opening
    setEditedShopData({ ...currentShop, carouselImages: [...currentShop.carouselImages] });
    setIsEditShopModalVisible(true);
  };

  const handleSaveShopChanges = () => {
    if (!editedShopData.name || !editedShopData.address || !editedShopData.openingTime || !editedShopData.closingTime) {
      Alert.alert("Validation Error", "Shop Name, Address, Opening Time, and Closing Time are required.");
      return;
    }

    // Update the isOpen status based on edited times if not manually overridden
    const updatedIsOpenStatus = editedShopData.isManuallyOverridden
      ? editedShopData.isOpen // Use manual override status if set
      : isShopCurrentlyOpen(editedShopData.openingTime, editedShopData.closingTime);

    const finalEditedShopData = {
      ...editedShopData,
      isOpen: updatedIsOpenStatus,
    };

    // Call the parent's update function
    onUpdateShop(finalEditedShopData);
    setCurrentShop(finalEditedShopData); // Update local state for immediate display
    setIsEditShopModalVisible(false); // Close the modal
    Alert.alert("Success", "Shop details updated successfully!");
  };

  const pickShopImage = async () => {
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();

    if (mediaStatus !== 'granted' || cameraStatus !== 'granted') {
      Alert.alert('Permission Required', 'Please enable camera and media library permissions in your device settings to add images.');
      return;
    }

    const options = ['TakePhoto', 'Choose from Gallery', 'Cancel'];
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
        setEditedShopData(prevData => ({
          ...prevData,
          carouselImages: [result.assets[0].uri, ...prevData.carouselImages],
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

  const handleRemoveShopCarouselImage = (indexToRemove) => {
    Alert.alert(
      "Confirm Removal",
      "Are you sure you want to remove this image?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          onPress: () => {
            setEditedShopData(prevData => ({
              ...prevData,
              carouselImages: prevData.carouselImages.filter((_, index) => index !== indexToRemove)
            }));
          },
          style: "destructive",
        },
      ]
    );
  };

  const handleToggleShopStatus = () => {
    setEditedShopData(prevData => ({
      ...prevData,
      isOpen: !prevData.isOpen,
      isManuallyOverridden: true, // Mark as manually overridden
    }));
  };

  const confirmDeleteShop = () => {
    setIsDeleteShopConfirmModalVisible(true);
  };

  const executeDeleteShop = () => {
    onDeleteShop(currentShop.id); // Call the parent's delete function
    setIsDeleteShopConfirmModalVisible(false);
    // onClose() will be called by ShopSelection.js after deletion
  };

  //---Barber Management Logic---
  const handleAddBarber = () => {
    if (!newBarberData.name || !newBarberData.email || !newBarberData.phone) {
      Alert.alert("Validation Error", "Please fill in all barber details.");
      return;
    }
    const newBarber = {
      _id: uuidv4(), // Generate a unique ID for the new barber
      ...newBarberData,
      totalCustomersServed: 0,
      totalStarsEarned: 0,
      totalRatings: 0,
      averageRating: 0, // Default for new barber
    };
    const updatedShop = {
      ...currentShop,
      barbers: [...currentShop.barbers, newBarber],
    };
    onUpdateShop(updatedShop); // Update parent state
    setCurrentShop(updatedShop); // Update local state
    setNewBarberData({ name: '', email: '', phone: '', password: '', averageRating: 0, totalRatings: 0 }); // Reset form
    setIsAddBarberModalVisible(false);
    Alert.alert("Success", "Barber added successfully!");
  };

  const handleEditBarber = (barber) => {
    setEditingBarber(barber);
    setIsEditBarberModalVisible(true);
  };

  const handleUpdateBarber = () => {
    if (!editingBarber.name || !editingBarber.email || !editingBarber.phone) {
      Alert.alert("Validation Error", "Please fill in all barber details.");
      return;
    }
    const updatedBarbers = currentShop.barbers.map(b =>
      b._id === editingBarber._id ? editingBarber : b
    );
    const updatedShop = {
      ...currentShop,
      barbers: updatedBarbers
    };
    onUpdateShop(updatedShop); // Update parent state
    setCurrentShop(updatedShop); // Update local state
    setIsEditBarberModalVisible(false);
    setEditingBarber(null);
    Alert.alert("Success", "Barber updated successfully!");
  };

  const confirmDeleteBarber = (barber) => {
    setBarberToDelete(barber);
    setIsDeleteBarberConfirmModalVisible(true);
  };

  const executeDeleteBarber = () => {
    const updatedBarbers = currentShop.barbers.filter(b => b._id !== barberToDelete._id);
    const updatedShop = {
      ...currentShop,
      barbers: updatedBarbers
    };
    onUpdateShop(updatedShop); // Update parent state
    setCurrentShop(updatedShop); // Update local state
    setIsDeleteBarberConfirmModalVisible(false);
    setBarberToDelete(null);
    Alert.alert("Success", `${barberToDelete.name} has been removed.`);
  };

  //---Render Logic---
  if (isLoading || !currentShop) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading shop details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* CustomHeader */}
      <View style={styles.customHeader}>
        {/* First Row: Numbrand Logo */}
        <View style={styles.headerRow}>
          <Text style={styles.numbrLogo}>Numbr</Text>
          <View style={styles.headerButtons}>
            {/* Edit button is moved to Shop Information */}
          </View>
        </View>
        {/* Second Row: Store Name and Close Button */}
        <View style={styles.shopNameRow}>
          <Text style={styles.shopNameInHeader}>{currentShop.name}</Text>
          <TouchableOpacity style={styles.headerCloseButtonNew} onPress={onClose}>
            <Icon name="times" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Shop Image Carousel */}
      <View style={styles.carouselWrapper}>
        {currentShop.carouselImages && currentShop.carouselImages.length > 0 ? (
          <>
            <ScrollView
              ref={carouselScrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.carouselContainer}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {currentShop.carouselImages.map((imageUrl, index) => (
                <Image
                  key={index}
                  source={{ uri: imageUrl }}
                  style={[styles.carouselImage, { width: screenWidth - 30 }]} // Adjust width for padding/margin
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {/* Carousel Pagination Dots */}
            <View style={styles.paginationDotsContainer}>
              {currentShop.carouselImages.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    carouselIndex === index && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          </>
        ) : (
          <Image
            source={{ uri: `https://placehold.co/${screenWidth - 30}x200/cccccc/555555?text=No+Images` }} // Placeholder with dynamic width
            style={[styles.carouselImagePlaceholder, { width: screenWidth - 30 }]}
          />
        )}
      </View>

      {/* Shop Details */}
      <View style={styles.detailsCard}>
        <View style={styles.detailTitleContainer}>
          <Text style={styles.detailTitle}>Shop Information</Text>
          <TouchableOpacity style={styles.headerEditButton} onPress={handleOpenEditShopModal}>
            <Icon name="pencil" size={20} color="#fff" />
            <Text style={styles.headerButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailRow}>
          <Icon name="map-marker" size={18} color="#555" style={styles.detailIcon} />
          <Text style={styles.detailText}>{currentShop.address}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="clock-o" size={18} color="#555" style={styles.detailIcon} />
          <Text style={styles.detailText}>
            <Text>{currentShop.openingTime}-{currentShop.closingTime}</Text>
            {currentShop.isManuallyOverridden && <Text style={styles.overrideText}>(Manual Override)</Text>}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <FontAwesome5 name="star" size={18} color="#FFD700" style={styles.detailIcon} />
          <Text style={styles.detailText}>
            <Text>{currentShop.shopRating?.average?.toFixed(1) ?? '0.0'} Average Rating</Text>{/* Safeguard .average */}
            <Text>({currentShop.shopRating?.count ?? 0} reviews)</Text>{/* Safeguard .count */}
          </Text>
        </View>

        <View style={styles.separator} />

        <Text style={styles.detailTitle}>Today's Stats</Text>
        <View style={styles.detailRow}>
          <Icon name="dollar" size={18} color="#28a745" style={styles.detailIcon} />
          <Text style={styles.detailText}>
            <Text>Earnings: </Text>
            <Text>${currentShop.todayStats.earnings}</Text>
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="users" size={18} color="#007bff" style={styles.detailIcon} />
          <Text style={styles.detailText}>
            <Text>Customers: </Text>
            <Text>{currentShop.todayStats.customers}</Text>
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="cut" size={18} color="#6f42c1" style={styles.detailIcon} />
          <Text style={styles.detailText}>
            <Text>Popular Service: </Text>
            <Text>{currentShop.todayStats.popularService}</Text>
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="user-tie" size={18} color="#fd7e14" style={styles.detailIcon} />
          <Text style={styles.detailText}>
            <Text>Top Employee: </Text>
            <Text>{currentShop.todayStats.topEmployee}</Text>
          </Text>
        </View>

        <View style={styles.separator} />

        <Text style={styles.detailTitle}>Barbers</Text>
        {currentShop.barbers && currentShop.barbers.length > 0 ? (
          currentShop.barbers.map(barber => (
            <View key={barber._id} style={styles.barberItem}>
              <View style={styles.barberIconContainer}>
                <Icon name="user-circle" size={30} color="#333" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.barberName}>{barber.name}</Text>
                <Text style={styles.barberContact}>{barber.email}</Text>
                <Text style={styles.barberContact}>{barber.phone}</Text>
                <Text style={styles.barberStats}>
                  <Text>Served: </Text>
                  <Text>{barber.totalCustomersServed} customers</Text>
                  <Text> | Rating: </Text>
                  <Text>{barber.averageRating?.toFixed(1) ?? '0.0'} ({barber.totalRatings ?? 0})</Text>{/* Safeguard .averageRating and .totalRatings */}
                </Text>
              </View>
              <TouchableOpacity style={styles.barberEditButton} onPress={() => handleEditBarber(barber)}>
                <Icon name="pencil" size={18} color="#007bff" />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No barbers listed for this shop yet.</Text>
        )}

        {/* Add Barber and Delete Shop buttons in the same row */}
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity style={styles.addBarberButton} onPress={() => setIsAddBarberModalVisible(true)}>
            <Icon name="plus" size={18} color="#fff" />
            <Text style={styles.addBarberButtonText}>Add Barber</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteShopButton} onPress={confirmDeleteShop}>
            <Icon name="trash" size={18} color="#fff" />
            <Text style={styles.deleteShopButtonText}>Delete Shop</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/*---Shop Edit Modal---*/}
      <Modal
        visible={isEditShopModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditShopModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Shop Details</Text>
            <Text style={styles.inputLabel}>Shop Name:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter shop name"
              value={editedShopData?.name}
              onChangeText={(text) => setEditedShopData({ ...editedShopData, name: text })}
            />
            <Text style={styles.inputLabel}>Shop Address:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter shop address"
              value={editedShopData?.address}
              onChangeText={(text) => setEditedShopData({ ...editedShopData, address: text })}
            />
            <Text style={styles.inputLabel}>Opening Time (HH:MM):</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 09:00"
              value={editedShopData?.openingTime}
              onChangeText={(text) => setEditedShopData({ ...editedShopData, openingTime: text })}
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Closing Time (HH:MM):</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 18:00"
              value={editedShopData?.closingTime}
              onChangeText={(text) => setEditedShopData({ ...editedShopData, closingTime: text })}
              keyboardType="numeric"
            />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Shop Status:</Text>
              <Switch
                trackColor={{ false: "#a30000", true: "#006400" }}
                thumbColor={editedShopData?.isOpen ? "#f5dd4b" : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
                onValueChange={handleToggleShopStatus}
                value={editedShopData?.isOpen}
              />
              <Text style={styles.toggleStatusText}>{editedShopData?.isOpen ? 'Open' : 'Closed'}</Text>
            </View>

            <Text style={styles.carouselImagesTitle}>Carousel Images:</Text>
            <ScrollView style={styles.carouselEditScrollVertical}>
              <View style={styles.carouselImagesGrid}>
                <TouchableOpacity style={styles.addImageButton} onPress={pickShopImage}>
                  <Icon name="plus" size={30} color="#007bff" />
                  <Text style={styles.addImageButtonText}>Add Image</Text>
                </TouchableOpacity>
                {editedShopData?.carouselImages.map((imageUri, index) => (
                  <View key={index} style={styles.carouselEditImageContainer}>
                    <Image source={{ uri: imageUri }} style={styles.carouselEditImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveShopCarouselImage(index)}
                    >
                      <Icon name="times-circle" size={24} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveShopChanges}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsEditShopModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              {/* Delete Shop button in Edit Shop Modal */}
              <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={confirmDeleteShop}>
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/*---Add Barber Modal---*/}
      <Modal
        visible={isAddBarberModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddBarberModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Barber</Text>
            <Text style={styles.inputLabel}>Barber Name:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter barber name"
              value={newBarberData.name}
              onChangeText={(text) => setNewBarberData({ ...newBarberData, name: text })}
            />
            <Text style={styles.inputLabel}>Email:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter barber email"
              value={newBarberData.email}
              onChangeText={(text) => setNewBarberData({ ...newBarberData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.inputLabel}>Phone:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter barber phone"
              value={newBarberData.phone}
              onChangeText={(text) => setNewBarberData({ ...newBarberData, phone: text })}
              keyboardType="phone-pad"
            />
            <Text style={styles.inputLabel}>New Password (Optional):</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password (optional)"
              value={newBarberData.password}
              onChangeText={(text) => setNewBarberData({ ...newBarberData, password: text })}
              secureTextEntry // Hide password input
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAddBarber}>
                <Text style={styles.modalButtonText}>Add Barber</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddBarberModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/*---Edit Barber Modal---*/}
      <Modal
        visible={isEditBarberModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditBarberModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Barber</Text>
            {editingBarber && (
              <>
                <Text style={styles.inputLabel}>Barber Name:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter barber name"
                  value={editingBarber.name}
                  onChangeText={(text) => setEditingBarber({ ...editingBarber, name: text })}
                />
                <Text style={styles.inputLabel}>Email:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter barber email"
                  value={editingBarber.email}
                  onChangeText={(text) => setEditingBarber({ ...editingBarber, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.inputLabel}>Phone:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter barber phone"
                  value={editingBarber.phone}
                  onChangeText={(text) => setEditingBarber({ ...editingBarber, phone: text })}
                  keyboardType="phone-pad"
                />
                <Text style={styles.inputLabel}>New Password (Optional):</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password (optional)"
                  value={editingBarber.password}
                  onChangeText={(text) => setEditingBarber({ ...editingBarber, password: text })}
                  secureTextEntry // Hide password input
                />
                <View style={styles.modalButtonContainer}>
                  {/* Button line up: Save, Cancel, Delete */}
                  <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleUpdateBarber}>
                    <Text style={styles.modalButtonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => { setIsEditBarberModalVisible(false); setEditingBarber(null); }}>
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={() => { setIsEditBarberModalVisible(false); confirmDeleteBarber(editingBarber); }}>
                    <Text style={styles.modalButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/*---Delete Shop Confirmation Modal---*/}
      <Modal
        visible={isDeleteShopConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteShopConfirmModalVisible(false)}
      >
        <View style={styles.confirmModalContainer}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Confirm Delete Shop</Text>
            <Text style={styles.confirmModalText}>
              <Text>Are you sure you want to delete "</Text>
              <Text style={{ fontWeight: 'bold' }}>{currentShop?.name}</Text>
              <Text>"? This action cannot be undone.</Text>
            </Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={executeDeleteShop}>
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsDeleteShopConfirmModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/*---Delete Barber Confirmation Modal---*/}
      <Modal
        visible={isDeleteBarberConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteBarberConfirmModalVisible(false)}
      >
        <View style={styles.confirmModalContainer}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Confirm Delete Barber</Text>
            <Text style={styles.confirmModalText}>
              <Text>Are you sure you want to remove "</Text>
              <Text style={{ fontWeight: 'bold' }}>{barberToDelete?.name}</Text>
              <Text>" from this shop? This action cannot be undone.</Text>
            </Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsDeleteBarberConfirmModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={executeDeleteBarber}>
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  // CustomHeader Styles
  customHeader: {
    backgroundColor: '#000', // Black header
    paddingTop: Platform.OS === 'android' ? 10 : 15, // Adjust for status bar on Android/iOS
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff', // White background
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  numbrLogo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontStyle: 'italic',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Moved to detailsCard for "Shop Information"
  // headerEditButton: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   paddingVertical: 2,
  //   paddingHorizontal: 12,
  //   borderRadius: 20,
  //   marginRight: 0,
  // },
  headerCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerCloseButtonNew: {
    padding: 8,
    borderRadius: 20,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  shopNameInHeader: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#000', // Black text for shop name
    flex: 1, // Allows it to take available space
  },
  // End CustomHeader Styles

  // Carousel Styles
  carouselWrapper: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center', // Center the carousel
  },
  carouselContainer: {
    width: screenWidth - 30, // Adjust width for horizontal padding/margin
    height: 200, // Fixed height for carousel
    borderRadius: 15,
    overflow: 'hidden', // Ensure images are clipped to border radius
  },
  carouselImage: {
    width: screenWidth - 30, // Each image takes full width of the carousel container
    height: '100%',
    resizeMode: 'cover',
  },
  carouselImagePlaceholder: {
    width: screenWidth - 30,
    height: 200,
    resizeMode: 'contain',
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    tintColor: '#cccccc',
  },
  paginationDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#007bff',
  },
  // End Carousel Styles

  detailsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  detailTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  // New style for the moved edit button in the details card
  headerEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: '#007bff', // Example background color
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailIcon: {
    marginRight: 10,
    width: 25, // Fixed width for alignment
    textAlign: 'center',
  },
  detailText: {
    fontSize: 16,
    color: '#555',
    flex: 1, // Allows text to wrap
  },
  overrideText: {
    fontStyle: 'italic',
    color: '#dc3545',
    marginLeft: 5,
    fontSize: 14,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 15,
  },
  barberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  barberIconContainer: {
    width: '20%', // Approx 20% width for the logo
    alignItems: 'center',
    justifyContent: 'center',
  },
  barberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  barberContact: {
    fontSize: 14,
    color: '#666',
    marginBottom: 1,
  },
  barberStats: {
    fontSize: 13,
    color: '#888',
    marginTop: 3,
  },
  barberEditButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e0f7fa',
    marginLeft: 10,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  noDataText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    marginTop: 10,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  addBarberButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1, // Take equal space
    marginRight: 10, // Space between buttons
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  addBarberButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  deleteShopButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1, // Take equal space
    marginLeft: 10, // Space between buttons
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  deleteShopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  // Modal Styles (for ShopEdit, AddBarber, EditBarber)
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    width: "90%",
    maxHeight: '90%', // Limit height for scrolling content
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // Align to start
    width: '100%',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#555',
    fontWeight: '600',
    marginRight: 10,
  },
  toggleStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
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
    justifyContent: 'flex-start', // Align items to start
    width: '100%', // Ensure it takes full width to calculate item width correctly
  },
  carouselEditImageContainer: {
    position: 'relative',
    // Calculate width for 3 items per row with some spacing
    // (modalContent width - (modal padding * 2) - (total margin space between images)) / 3
    width: (screenWidth * 0.9 - 25 * 2 - 20) / 3, // 0.9 for modalContent width, 25*2 for modal padding, 20 for total horizontal margins (5*4)
    height: (screenWidth * 0.9 - 25 * 2 - 20) / 3, // Keep aspect ratio square
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10, // Space between rows
    marginHorizontal: 0, // Small horizontal margin
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
    width: (screenWidth * 0.9 - 25 * 2 - 20) / 3, // Match width of image containers
    height: (screenWidth * 0.9 - 25 * 2 - 20) / 3,
    backgroundColor: '#e0f7fa',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007bff',
    borderStyle: 'dashed',
    marginBottom: 10,
    marginHorizontal: 0, // Small horizontal margin
  },
  addImageButtonText: {
    fontSize: 12,
    color: '#007bff',
    marginTop: 5,
    textAlign: 'center',
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
  deleteButton: {
    backgroundColor: "#dc3545",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
  },
  // Confirmation Modal Styles
  confirmModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  confirmModalContent: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 15,
    width: '80%',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  confirmModalText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 25,
  },
});

export default ShopsList;