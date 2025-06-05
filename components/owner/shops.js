import React, { useState, useEffect, useRef, useCallback } from "react";
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
import * as ImagePicker from 'expo-image-picker';

const { width: screenWidth } = Dimensions.get("window");
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

  const [isEditShopModalVisible, setIsEditShopModalVisible] = useState(false);
  const [editedShopData, setEditedShopData] = useState(null);

  const [isAddBarberModalVisible, setIsAddBarberModalVisible] = useState(false);
  const [newBarberData, setNewBarberData] = useState({ name: '', email: '', phone: '', password: '' });
  const [isEditBarberModalVisible, setIsEditBarberModalVisible] = useState(false);
  const [editingBarber, setEditingBarber] = useState(null); // The barber object being edited
  const [editedBarberData, setEditedBarberData] = useState({ name: '', phone: '', password: '' }); // Form data for editing barber

  const [isDeleteShopConfirmModalVisible, setIsDeleteShopConfirmModalVisible] = useState(false);
  const [isDeleteBarberConfirmModalVisible, setIsDeleteBarberConfirmModalVisible] = useState(false);
  const [barberToDelete, setBarberToDelete] = useState(null);

  // Services State
  const [isAddServiceModalVisible, setIsAddServiceModalVisible] = useState(false);
  const [newServiceData, setNewServiceData] = useState({ name: '', price: '' });
  const [isEditServiceModalVisible, setIsEditServiceModalVisible] = useState(false);
  const [editingService, setEditingService] = useState(null); // The service object being edited
  const [editedServiceData, setEditedServiceData] = useState({ name: '', price: '' }); // Form data for editing service
  const [isDeleteServiceConfirmModalVisible, setIsDeleteServiceConfirmModalVisible] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);


  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselScrollViewRef = useRef(null);

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
      setError('Shop ID or token missing.'); setIsLoading(false); return;
    }
    setIsLoading(true); setError(null);
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
        _id: fetchedShop._id, name: fetchedShop.name, address: fetchedShop.address.fullDetails,
        openingTime: fetchedShop.openingTime, closingTime: fetchedShop.closingTime,
        carouselImages: fetchedShop.photos || [],
        shopRating: fetchedShop.rating ? { average: fetchedShop.rating, count: 0 } : { average: 0, count: 0 },
        isManuallyOverridden: fetchedShop.isManuallyOverridden,
        isOpen: fetchedShop.isManuallyOverridden ? fetchedShop.isOpen : isShopCurrentlyOpen(fetchedShop.openingTime, fetchedShop.closingTime),
        todayStats: { earnings: 0, customers: 0, popularService: 'N/A', topEmployee: 'N/A' },
        services: fetchedShop.services || [], // Services from shop data
      };
      setCurrentShop(formattedShop);
      setEditedShopData({ ...formattedShop, carouselImages: [...formattedShop.carouselImages] });
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

  useEffect(() => { fetchShopDetails(); }, [fetchShopDetails]);

  useEffect(() => {
    let interval;
    const images = isEditShopModalVisible && editedShopData ? editedShopData.carouselImages : currentShop?.carouselImages;
    if (images && images.length > 1) {
      interval = setInterval(() => {
        setCarouselIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % images.length;
          carouselScrollViewRef.current?.scrollTo({ x: nextIndex * (screenWidth - 30), animated: true });
          return nextIndex;
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [currentShop, editedShopData, isEditShopModalVisible, screenWidth]);

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const images = isEditShopModalVisible && editedShopData ? editedShopData.carouselImages : currentShop?.carouselImages;
    if (images && images.length > 0) {
      const newIndex = Math.round(contentOffsetX / (screenWidth - 30));
      setCarouselIndex(newIndex);
    }
  };

  const handleOpenEditShopModal = () => {
    setEditedShopData(currentShop ? { ...currentShop, carouselImages: [...currentShop.carouselImages] } : null);
    setIsEditShopModalVisible(true);
  };

  const handleSaveShopChanges = async () => {
    if (!editedShopData || !userToken) return;
    if (!editedShopData.name || !editedShopData.address || !editedShopData.openingTime || !editedShopData.closingTime) {
      Alert.alert("Validation Error", "All shop fields are required."); return;
    }
    try {
      const shopToUpdate = {
        name: editedShopData.name,
        address: { fullDetails: editedShopData.address, coordinates: editedShopData.coordinates || currentShop?.address?.coordinates || { type: 'Point', coordinates: [-74.0060, 40.7128] } },
        photos: editedShopData.carouselImages, openingTime: editedShopData.openingTime, closingTime: editedShopData.closingTime,
        isManuallyOverridden: editedShopData.isManuallyOverridden, isOpen: editedShopData.isOpen,
      };
      const response = await fetch(`${API_BASE_URL}/shops/${currentShop._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify(shopToUpdate),
      });
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || 'Failed to update shop.'); }
      Alert.alert("Success", "Shop details updated!");
      setIsEditShopModalVisible(false);
      await fetchShopDetails();
      if (fetchOwnerShops) await fetchOwnerShops(userToken);
    } catch (err) { console.error('Error saving shop:', err); Alert.alert("Error", err.message); }
  };

  const pickShopImage = async () => {
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (mediaStatus !== 'granted' || cameraStatus !== 'granted') {
      Alert.alert('Permission Required', 'Please enable camera and media library permissions.'); return;
    }
    const options = ['Take Photo', 'Choose from Gallery', 'Cancel'];
    const handleSelection = async (idx) => {
      let result;
      if (idx === 0) result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 1 });
      else if (idx === 1) result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 1 });
      if (result && !result.canceled && result.assets && result.assets.length > 0) {
        setEditedShopData(prev => ({ ...prev, carouselImages: [result.assets[0].uri, ...(prev.carouselImages || [])] }));
      }
    };
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, handleSelection);
    else Alert.alert('Add Image', 'Choose option:', options.map((title, i) => ({ text: title, onPress: () => handleSelection(i), style: i === 2 ? 'cancel' : 'default' })), { cancelable: true });
  };

  const handleRemoveShopCarouselImage = (idx) => Alert.alert("Confirm Removal", "Remove this image?", [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", onPress: () => setEditedShopData(prev => ({ ...prev, carouselImages: prev.carouselImages.filter((_, i) => i !== idx) })), style: "destructive" }
  ]);

  const handleToggleShopStatusInEditModal = () => setEditedShopData(prev => ({ ...prev, isOpen: !prev.isOpen, isManuallyOverridden: true }));
  const confirmDeleteShop = () => setIsDeleteShopConfirmModalVisible(true);

  const executeDeleteShop = async () => {
    if (!currentShop || !userToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/shops/${currentShop._id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${userToken}` } });
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || 'Failed to delete shop.'); }
      Alert.alert("Success", "Shop deleted!"); setIsDeleteShopConfirmModalVisible(false); onClose();
      if (fetchOwnerShops) await fetchOwnerShops(userToken);
    } catch (err) { console.error('Error deleting shop:', err); Alert.alert("Error", err.message); }
  };

  // Barber Management
  const handleAddBarber = async () => {
    if (!newBarberData.name || !newBarberData.phone || !newBarberData.password) { Alert.alert("Validation Error", "Name, Phone, and Password are required."); return; }
    if (!currentShop || !userToken) { Alert.alert("Error", "Shop or token missing."); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/barbers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ shopId: currentShop._id, name: newBarberData.name, phone: newBarberData.phone, pass: newBarberData.password }),
      });
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || 'Failed to create barber.'); }
      Alert.alert("Success", "Barber added!"); setNewBarberData({ name: '', email: '', phone: '', password: '' }); setIsAddBarberModalVisible(false);
      await fetchBarbersForShop(currentShop._id, userToken);
    } catch (err) { console.error('Error adding barber:', err); Alert.alert("Error", err.message); }
  };

  const handleOpenEditBarberModal = (barber) => {
    setEditingBarber(barber);
    setEditedBarberData({ name: barber.name, phone: barber.phone, password: '' }); // Clear password field for security
    setIsEditBarberModalVisible(true);
  };

  const handleSaveBarberChanges = async () => {
    if (!editingBarber || !userToken) { Alert.alert("Error", "No barber selected or token missing."); return; }
    if (!editedBarberData.name || !editedBarberData.phone) { Alert.alert("Validation Error", "Name and Phone are required."); return; }

    const payload = {
      name: editedBarberData.name,
      phone: editedBarberData.phone,
    };
    if (editedBarberData.password) { // Only include password if user entered a new one
      payload.pass = editedBarberData.password;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/barbers/${editingBarber._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify(payload),
      });
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || 'Failed to update barber.'); }
      Alert.alert("Success", "Barber details updated!");
      setIsEditBarberModalVisible(false); setEditingBarber(null);
      await fetchBarbersForShop(currentShop._id, userToken); // Refresh barber list
    } catch (err) { console.error('Error updating barber:', err); Alert.alert("Error", err.message); }
  };

  const confirmDeleteBarber = (barber) => { setBarberToDelete(barber); setIsDeleteBarberConfirmModalVisible(true); };

  const executeDeleteBarber = async () => {
    if (!barberToDelete || !userToken) { Alert.alert("Error", "Barber or token missing."); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/barbers/${barberToDelete._id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${userToken}` } });
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || 'Failed to delete barber.'); }
      Alert.alert("Success", "Barber removed!"); setIsDeleteBarberConfirmModalVisible(false); setBarberToDelete(null);
      if (currentShop) await fetchBarbersForShop(currentShop._id, userToken);
    } catch (err) { console.error('Error deleting barber:', err); Alert.alert("Error", err.message); }
  };

  // Services Management
  const handleOpenAddServiceModal = () => {
    setNewServiceData({ name: '', price: '' });
    setIsAddServiceModalVisible(true);
  };

  const handleAddService = async () => {
    if (!newServiceData.name || !newServiceData.price) { Alert.alert("Validation Error", "Service name and price are required."); return; }
    const price = parseFloat(newServiceData.price);
    if (isNaN(price) || price < 0) { Alert.alert("Validation Error", "Invalid price."); return; }
    if (!currentShop || !userToken) { Alert.alert("Error", "Shop or token missing."); return; }

    try {
      const response = await fetch(`${API_BASE_URL}/shops/${currentShop._id}/services`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ name: newServiceData.name, price: price }),
      });
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || 'Failed to add service.'); }
      Alert.alert("Success", "Service added!"); setIsAddServiceModalVisible(false);
      await fetchShopDetails(); // Re-fetch shop details to update services list
    } catch (err) { console.error('Error adding service:', err); Alert.alert("Error", err.message); }
  };

  const handleOpenEditServiceModal = (service) => {
    setEditingService(service);
    setEditedServiceData({ name: service.name, price: service.price.toString() });
    setIsEditServiceModalVisible(true);
  };

  const handleUpdateService = async () => {
    if (!editingService || !userToken) { Alert.alert("Error", "No service selected or token missing."); return; }
    if (!editedServiceData.name || !editedServiceData.price) { Alert.alert("Validation Error", "Service name and price are required."); return; }
    const price = parseFloat(editedServiceData.price);
    if (isNaN(price) || price < 0) { Alert.alert("Validation Error", "Invalid price."); return; }

    try {
      const response = await fetch(`${API_BASE_URL}/shops/${currentShop._id}/services/${editingService._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ name: editedServiceData.name, price: price }),
      });
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || 'Failed to update service.'); }
      Alert.alert("Success", "Service updated!"); setIsEditServiceModalVisible(false); setEditingService(null);
      await fetchShopDetails(); // Re-fetch shop details
    } catch (err) { console.error('Error updating service:', err); Alert.alert("Error", err.message); }
  };

  const confirmDeleteService = (service) => { setServiceToDelete(service); setIsDeleteServiceConfirmModalVisible(true); };

  const executeDeleteService = async () => {
    if (!serviceToDelete || !currentShop || !userToken) { Alert.alert("Error", "Service, shop or token missing."); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/shops/${currentShop._id}/services/${serviceToDelete._id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${userToken}` },
      });
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || 'Failed to delete service.'); }
      Alert.alert("Success", "Service removed!"); setIsDeleteServiceConfirmModalVisible(false); setServiceToDelete(null);
      await fetchShopDetails(); // Re-fetch shop details
    } catch (err) { console.error('Error deleting service:', err); Alert.alert("Error", err.message); }
  };


  if (isLoading || !currentShop) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#007bff" /><Text style={styles.loadingText}>Loading...</Text></View>;
  if (error) return <View style={styles.loadingContainer}><Text style={styles.loadingText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={fetchShopDetails}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></View>;

  const displayCarouselImages = isEditShopModalVisible && editedShopData ? editedShopData.carouselImages : currentShop?.carouselImages;

 return (
    <View style={styles.container}>
      {/* Header with Numbr logo */}
      <View style={styles.header}>
        <Text style={styles.title}>Numbr</Text>
      </View>

      {/* Main content scrollable area */}
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {/* Image carousel */}
        <View style={styles.card}>
          {displayCarouselImages && displayCarouselImages.length > 0 ? (
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
                {displayCarouselImages.map((imgUrl, idx) => (
                  <Image
                    key={idx.toString()}
                    source={{ uri: imgUrl }}
                    style={[styles.carouselImage, { width: screenWidth - 40 }]}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              <View style={styles.paginationDotsContainer}>
                {displayCarouselImages.map((_, idx) => (
                  <View
                    key={idx.toString()}
                    style={[
                      styles.paginationDot,
                      carouselIndex === idx && styles.paginationDotActive
                    ]}
                  />
                ))}
              </View>
            </>
          ) : (
            <Image
              source={{ uri: `https://placehold.co/${screenWidth - 40}x200/e1f5fe/0277bd?text=No+Images+Available` }}
              style={[styles.carouselImagePlaceholder, { width: screenWidth - 40 }]}
            />
          )}
        </View>

        {/* Shop information card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{currentShop.name} Information</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleOpenEditShopModal}
            >
              <Icon name="pencil" size={16} color="#007BFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoItem}>
            <Icon name="map-marker" size={18} color="#007BFF" style={styles.infoIcon} />
            <Text style={styles.infoText}>{currentShop.address}</Text>
          </View>

          <View style={styles.infoItem}>
            <Icon name="clock-o" size={18} color="#007BFF" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              {currentShop.openingTime}-{currentShop.closingTime}
              {currentShop.isManuallyOverridden && (
                <Text style={styles.overrideText}> (Override)</Text>
              )}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <FontAwesome5 name="star" size={18} color="#FFC107" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              {currentShop.shopRating?.average?.toFixed(1) ?? '0.0'}
              ({currentShop.shopRating?.count ?? 0} reviews)
            </Text>
          </View>
        </View>

        {/* Today's stats card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Stats</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Icon name="dollar" size={24} color="#28A745" />
              <Text style={styles.statValue}>${currentShop.todayStats.earnings}</Text>
              <Text style={styles.statLabel}>Earnings</Text>
            </View>

            <View style={styles.statItem}>
              <Icon name="users" size={24} color="#007BFF" />
              <Text style={styles.statValue}>{currentShop.todayStats.customers}</Text>
              <Text style={styles.statLabel}>Customers</Text>
            </View>
          </View>
        </View>

        {/* Services card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Services</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleOpenAddServiceModal}
            >
              <Icon name="plus" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {currentShop.services && currentShop.services.length > 0 ? (
            currentShop.services.map(service => (
              <View key={service._id} style={styles.listItem}>
                <View style={styles.listItemInfo}>
                  <Text style={styles.itemName}>{service.name}</Text>
                  <Text style={styles.itemPrice}>${service.price.toFixed(2)}</Text>
                </View>
                <View style={styles.listItemActions}>
                  <TouchableOpacity
                    style={styles.listItemActionButton}
                    onPress={() => handleOpenEditServiceModal(service)}
                  >
                    <Icon name="pencil" size={16} color="#007BFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.listItemActionButton}
                    onPress={() => confirmDeleteService(service)}
                  >
                    <Icon name="trash" size={16} color="#DC3545" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No services listed yet</Text>
          )}
        </View>

        {/* Barbers card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Barbers</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setIsAddBarberModalVisible(true)}
            >
              <Icon name="plus" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {barbersList && barbersList.length > 0 ? (
            barbersList.map(barber => (
              <View key={barber._id} style={styles.listItem}>
                <View style={styles.barberAvatar}>
                  <Icon name="user-circle" size={36} color="#6C757D" />
                </View>
                <View style={styles.listItemInfo}>
                  <Text style={styles.itemName}>{barber.name}</Text>
                  <Text style={styles.itemSubText}>{barber.phone}</Text>
                  <Text style={styles.itemSubText}>Served: {barber.customersServed || 0}</Text>
                </View>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenEditBarberModal(barber)}
                >
                  <Icon name="pencil" size={16} color="#007BFF" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No barbers listed yet</Text>
          )}
        </View>

        {/* Danger zone card */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.cardTitle, { color: '#DC3545' }]}>Permanent Deletion</Text>
          <Text style={styles.dangerNoteText}>
            Warning: Clicking the button below will permanently delete this shop and all associated data. This action cannot be undone.
          </Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={confirmDeleteShop}
          >
            <Icon name="trash" size={16} color="#fff" />
            <Text style={styles.deleteButtonText}>Delete Shop</Text>
          </TouchableOpacity>
        </View>

        {/* All modals remain the same as in your original code, but with updated styles */}
        {/* Shop Edit Modal */}
        <Modal visible={isEditShopModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditShopModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Shop</Text>
              <Text style={styles.inputLabel}>Name:</Text>
              <TextInput style={styles.input} value={editedShopData?.name} onChangeText={txt => setEditedShopData({ ...editedShopData, name: txt })} />
              <Text style={styles.inputLabel}>Address:</Text>
              <TextInput style={styles.input} value={editedShopData?.address} onChangeText={txt => setEditedShopData({ ...editedShopData, address: txt })} />
              <Text style={styles.inputLabel}>Opening (HH:MM):</Text>
              <TextInput style={styles.input} value={editedShopData?.openingTime} onChangeText={txt => setEditedShopData({ ...editedShopData, openingTime: txt })} />
              <Text style={styles.inputLabel}>Closing (HH:MM):</Text>
              <TextInput style={styles.input} value={editedShopData?.closingTime} onChangeText={txt => setEditedShopData({ ...editedShopData, closingTime: txt })} />
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Status:</Text>
                <Switch value={editedShopData?.isOpen} onValueChange={handleToggleShopStatusInEditModal} />
                <Text style={styles.toggleStatusText}>{editedShopData?.isOpen ? 'Open' : 'Closed'}</Text>
              </View>
              <Text style={styles.carouselImagesTitle}>Images:</Text>
              <ScrollView style={styles.carouselEditScrollVertical}>
                <View style={styles.carouselImagesGrid}>
                  <TouchableOpacity style={styles.addImageButton} onPress={pickShopImage}>
                    <Icon name="plus" size={30} color="#007BFF" />
                    <Text>Add</Text>
                  </TouchableOpacity>
                  {editedShopData?.carouselImages.map((img, idx) => (
                    <View key={idx.toString()} style={styles.carouselEditImageContainer}>
                      <Image source={{ uri: img }} style={styles.carouselEditImage} />
                      <TouchableOpacity style={styles.removeImageButton} onPress={() => handleRemoveShopCarouselImage(idx)}>
                        <Icon name="times-circle" size={24} color="#DC3545" />
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
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Barber Modal */}
        <Modal visible={isAddBarberModalVisible} transparent animationType="slide" onRequestClose={() => setIsAddBarberModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Barber</Text>
              <Text style={styles.inputLabel}>Name:</Text>
              <TextInput style={styles.input} value={newBarberData.name} onChangeText={txt => setNewBarberData({ ...newBarberData, name: txt })} />
              <Text style={styles.inputLabel}>Phone:</Text>
              <TextInput style={styles.input} value={newBarberData.phone} onChangeText={txt => setNewBarberData({ ...newBarberData, phone: txt })} keyboardType="phone-pad" />
              <Text style={styles.inputLabel}>Password:</Text>
              <TextInput style={styles.input} value={newBarberData.password} onChangeText={txt => setNewBarberData({ ...newBarberData, password: txt })} secureTextEntry />
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAddBarber}>
                  <Text style={styles.modalButtonText}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddBarberModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Barber Modal */}
        <Modal visible={isEditBarberModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditBarberModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Barber</Text>
              {editingBarber && (
                <>
                  <Text style={styles.inputLabel}>Name:</Text>
                  <TextInput style={styles.input} value={editedBarberData.name} onChangeText={txt => setEditedBarberData({ ...editedBarberData, name: txt })} />
                  <Text style={styles.inputLabel}>Phone:</Text>
                  <TextInput style={styles.input} value={editedBarberData.phone} onChangeText={txt => setEditedBarberData({ ...editedBarberData, phone: txt })} keyboardType="phone-pad" />
                  <Text style={styles.inputLabel}>New Password (optional):</Text>
                  <TextInput style={styles.input} placeholder="Leave blank to keep current" value={editedBarberData.password} onChangeText={txt => setEditedBarberData({ ...editedBarberData, password: txt })} secureTextEntry />
                  <View style={styles.modalButtonContainer}>
                    <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveBarberChanges}>
                      <Text style={styles.modalButtonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => { setIsEditBarberModalVisible(false); /*setEditingBarber(null);*/ }}>
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, styles.modalDeleteButton]} onPress={() => { setIsEditBarberModalVisible(false); confirmDeleteBarber(editingBarber); }}>
                      <Text style={styles.modalButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Add Service Modal */}
        <Modal visible={isAddServiceModalVisible} transparent animationType="slide" onRequestClose={() => setIsAddServiceModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Service</Text>
              <Text style={styles.inputLabel}>Service Name:</Text>
              <TextInput style={styles.input} value={newServiceData.name} onChangeText={txt => setNewServiceData({ ...newServiceData, name: txt })} />
              <Text style={styles.inputLabel}>Price:</Text>
              <TextInput style={styles.input} value={newServiceData.price} onChangeText={txt => setNewServiceData({ ...newServiceData, price: txt })} keyboardType="numeric" />
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAddService}>
                  <Text style={styles.modalButtonText}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddServiceModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Service Modal */}
        <Modal visible={isEditServiceModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditServiceModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Service</Text>
              {editingService && (
                <>
                  <Text style={styles.inputLabel}>Service Name:</Text>
                  <TextInput style={styles.input} value={editedServiceData.name} onChangeText={txt => setEditedServiceData({ ...editedServiceData, name: txt })} />
                  <Text style={styles.inputLabel}>Price:</Text>
                  <TextInput style={styles.input} value={editedServiceData.price} onChangeText={txt => setEditedServiceData({ ...editedServiceData, price: txt })} keyboardType="numeric" />
                  <View style={styles.modalButtonContainer}>
                    <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleUpdateService}>
                      <Text style={styles.modalButtonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => { setIsEditServiceModalVisible(false); /*setEditingService(null);*/ }}>
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modals (Shop, Barber, Service) */}
        {[
          { visible: isDeleteShopConfirmModalVisible, close: () => setIsDeleteShopConfirmModalVisible(false), title: "Delete Shop", text: `Delete "${currentShop?.name}"?`, action: executeDeleteShop },
          { visible: isDeleteBarberConfirmModalVisible, close: () => setIsDeleteBarberConfirmModalVisible(false), title: "Delete Barber", text: `Remove "${barberToDelete?.name}"?`, action: executeDeleteBarber },
          { visible: isDeleteServiceConfirmModalVisible, close: () => setIsDeleteServiceConfirmModalVisible(false), title: "Delete Service", text: `Remove "${serviceToDelete?.name}"?`, action: executeDeleteService }
        ].map(m => m.visible && (
          <Modal key={m.title} visible={m.visible} transparent animationType="fade" onRequestClose={m.close}>
            <View style={styles.confirmModalContainer}>
              <View style={styles.confirmModalContent}>
                <Text style={styles.confirmModalTitle}>{m.title}</Text>
                <Text style={styles.confirmModalText}>{m.text}</Text>
                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity style={[styles.modalButton, styles.modalDeleteButton]} onPress={m.action}>
                    <Text style={styles.modalButtonText}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={m.close}>
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        ))}

      </ScrollView>

      {/* Sticky back to home button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={onClose}
      >
        <Text style={styles.backButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8EDF2', // A very light, subtle blue-grey background
  },
  header: {
    height: 70,
    backgroundColor: "black", // A more vibrant blue
    flexDirection: "row",
    alignItems: "left",
    justifyContent: 'left',
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
    fontWeight: '800', // Bolder font weight
    letterSpacing: 1.2,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 15, // Slightly reduced padding
  },
  scrollContentContainer: {
    paddingBottom: 100, // Space for the sticky button
    paddingTop: 15, // Add some space at the top of the scrollable content
  },
  card: {
    backgroundColor: '#FFFFFF', // Cards remain white for contrast against the subtle background
    borderRadius: 15, // Consistent rounded corners
    padding: 10,
    marginBottom: 15, // Spacing between cards
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, // More pronounced shadow for depth
    shadowOpacity: 0.08, // Softer shadow
    shadowRadius: 8,
    elevation: 5,
  },
  shopNameText: {
    fontSize: 32, // Larger font for shop name
    fontWeight: '900', // Even bolder font weight
    color: '#2C3E50', // Darker, more professional text color
    textAlign: 'center', // Center align shop name
    marginBottom: 10,
  },
  carouselContainer: {
    width: '100%',
    height: 200, // Slightly adjusted height
    borderRadius: 15, // Match card border radius
    overflow: 'hidden',
    backgroundColor: '#F8F9FA', // Light background for carousel area
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    borderRadius: 15, // Apply border radius to images as well
  },
  carouselImagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 15,
    backgroundColor: '#E0F7FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 5,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B0BEC5',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#007BFF', // Match header color
    width: 10, // Slightly larger when active
    height: 10,
    borderRadius: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF', // Lighter separator
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700', // Bolder title
    color: '#333',
  },
  actionButton: {
    padding: 10,
    borderRadius: 25, // More rounded buttons
    backgroundColor: '#E3F2FD', // Light blue background
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#28A745', // Green for add button
    padding: 10,
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#28A745',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8, // Reduced vertical margin
    paddingVertical: 5, // Add padding for better touch targets and visual spacing
  },
  infoIcon: {
    marginRight: 15,
    width: 24,
    textAlign: 'center', // Center icon for better alignment
  },
  infoText: {
    fontSize: 16,
    color: '#4A4A4A', // Darker text for better contrast
    flex: 1,
    lineHeight: 24,
  },
  overrideText: {
    fontStyle: 'italic',
    color: '#DC3545', // Red for override
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  statItem: {
    alignItems: 'center',
    padding: 20, // Increased padding
    backgroundColor: '#F7F7F7', // Very light background
    borderRadius: 15, // More rounded stats items
    width: '48%', // Slightly larger width
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, // Softer shadow
    shadowRadius: 5,
    elevation: 3,
  },
  statValue: {
    fontSize: 28, // Larger stat value
    fontWeight: 'bold',
    color: '#1A2A3A', // Darker text
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 16, // Larger label
    color: '#666',
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FDFDFD', // Very light background for list items
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 10, // Space between list items
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 17,
    fontWeight: '700', // Bolder item name
    color: '#333',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 17,
    color: '#28A745', // Green for price
    fontWeight: 'bold',
  },
  itemSubText: {
    fontSize: 14,
    color: '#777',
    marginTop: 2,
  },
  listItemActions: {
    flexDirection: 'row',
  },
  listItemActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F0F8FF', // Light background for action buttons
    borderRadius: 15,
    marginLeft: 8, // Space between action buttons
  },
  barberAvatar: {
    marginRight: 15,
    borderRadius: 20, // Make avatar more rounded
    backgroundColor: '#E8EAF6', // Light purple background
    padding: 5,
  },
  noDataText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 25,
    fontStyle: 'italic',
  },
  dangerCard: {
    borderLeftWidth: 6, // Thicker left border for danger
    borderLeftColor: '#E74C3C', // Red for danger
  },
  dangerNoteText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  deleteButton: {
    flexDirection: 'row',
    backgroundColor: '#E74C3C', // Red button
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 10,
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

  // Modal styles (updated for consistency)
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)", // Darker overlay
  },
  modalContent: {
    width: "90%",
    maxHeight: '90%',
    backgroundColor: "#FFFFFF", // White background
    padding: 20, // Increased padding
    borderRadius: 25, // More rounded modals
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, // Softer shadow
    shadowRadius: 25,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 24, // Larger title
    fontWeight: "bold",
    marginBottom: 20,
    color: "#007BFF",
    textAlign: 'center',
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: 16,
    color: '#444',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#E0E0E0", // Lighter border
    borderRadius: 10,
    padding: 15, // Increased padding
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: "#F9F9F9", // Light input background
    color: '#333',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#444',
    fontWeight: '600',
    marginRight: 15,
  },
  toggleStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  carouselImagesTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 15,
    alignSelf: 'flex-start',
  },
  carouselEditScrollVertical: {
    width: '100%',
    maxHeight: 250,
    marginBottom: 20,
  },
  carouselImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  carouselEditImageContainer: {
    position: 'relative',
    width: (screenWidth * 0.9 - 60 - 20) / 3, // Adjusted width for 3 columns with padding
    height: (screenWidth * 0.9 - 60 - 20) / 3,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CCC',
    marginBottom: 10,
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
    padding: 5,
  },
  addImageButton: {
    width: (screenWidth * 0.9 - 60 - 20) / 3,
    height: (screenWidth * 0.9 - 60 - 20) / 3,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007BFF',
    borderStyle: 'dashed',
    marginBottom: 10,
    marginRight: 10,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 25,
  },
  modalButton: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: "center",
    flex: 1, // Crucial for equal width
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: "#28A745", // Green save button
  },
  cancelButton: {
    backgroundColor: "#6C757D", // Grey cancel button
  },
  modalDeleteButton: {
    backgroundColor: '#E74C3C',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  confirmModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  confirmModalContent: {
    backgroundColor: '#FFFFFF', // White background
    padding: 20,
    borderRadius: 20,
    width: '85%',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 15,
  },
  confirmModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 18,
    color: '#333',
  },
  confirmModalText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
});



export default ShopsList;