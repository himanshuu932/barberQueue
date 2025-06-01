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
    <ScrollView style={styles.container}>
      <View style={styles.customHeader}>
        <View style={styles.headerRow}><Text style={styles.numbrLogo}>Numbr</Text></View>
        <View style={styles.shopNameRow}>
          <Text style={styles.shopNameInHeader}>{currentShop.name}</Text>
          <TouchableOpacity style={styles.headerCloseButtonNew} onPress={onClose}><Icon name="times" size={24} color="#000" /></TouchableOpacity>
        </View>
      </View>

      <View style={styles.carouselWrapper}>
        {displayCarouselImages && displayCarouselImages.length > 0 ? (
          <>
            <ScrollView ref={carouselScrollViewRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.carouselContainer} onScroll={handleScroll} scrollEventThrottle={16}>
              {displayCarouselImages.map((imgUrl, idx) => <Image key={idx.toString()} source={{ uri: imgUrl }} style={[styles.carouselImage, { width: screenWidth - 30 }]} resizeMode="cover" />)}
            </ScrollView>
            <View style={styles.paginationDotsContainer}>
              {displayCarouselImages.map((_, idx) => <View key={idx.toString()} style={[styles.paginationDot, carouselIndex === idx && styles.paginationDotActive]} />)}
            </View>
          </>
        ) : <Image source={{ uri: `https://placehold.co/${screenWidth - 30}x200/ccc/555?text=No+Images` }} style={[styles.carouselImagePlaceholder, { width: screenWidth - 30 }]} />}
      </View>

      <View style={styles.detailsCard}>
        <View style={styles.detailTitleContainer}>
          <Text style={styles.detailTitle}>Shop Information</Text>
          <TouchableOpacity style={styles.headerEditButton} onPress={handleOpenEditShopModal}><Icon name="pencil" size={20} color="#fff" /><Text style={styles.headerButtonText}>Edit</Text></TouchableOpacity>
        </View>
        <View style={styles.detailRow}><Icon name="map-marker" size={18} color="#555" style={styles.detailIcon} /><Text style={styles.detailText}>{currentShop.address}</Text></View>
        <View style={styles.detailRow}><Icon name="clock-o" size={18} color="#555" style={styles.detailIcon} /><Text style={styles.detailText}>{currentShop.openingTime}-{currentShop.closingTime}{currentShop.isManuallyOverridden && <Text style={styles.overrideText}>(Override)</Text>}</Text></View>
        <View style={styles.detailRow}><FontAwesome5 name="star" size={18} color="#FFD700" style={styles.detailIcon} /><Text style={styles.detailText}>{currentShop.shopRating?.average?.toFixed(1) ?? '0.0'} ({currentShop.shopRating?.count ?? 0} reviews)</Text></View>
        <View style={styles.separator} />
        <Text style={styles.detailTitle}>Today's Stats</Text>
        <View style={styles.detailRow}><Icon name="dollar" size={18} color="#28a745" style={styles.detailIcon} /><Text style={styles.detailText}>Earnings: ${currentShop.todayStats.earnings}</Text></View>
        <View style={styles.detailRow}><Icon name="users" size={18} color="#007bff" style={styles.detailIcon} /><Text style={styles.detailText}>Customers: {currentShop.todayStats.customers}</Text></View>
        
        <View style={styles.separator} />
        {/* Services Section */}
        <View style={styles.detailTitleContainer}>
            <Text style={styles.detailTitle}>Services</Text>
            <TouchableOpacity style={styles.addCircleButton} onPress={handleOpenAddServiceModal}>
                <Icon name="plus-circle" size={24} color="#007bff" />
            </TouchableOpacity>
        </View>
        {currentShop.services && currentShop.services.length > 0 ? (
            currentShop.services.map(service => (
                <View key={service._id} style={styles.serviceItem}>
                    <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        <Text style={styles.servicePrice}>${service.price.toFixed(2)}</Text>
                    </View>
                    <View style={styles.serviceActions}>
                        <TouchableOpacity style={styles.serviceActionButton} onPress={() => handleOpenEditServiceModal(service)}>
                            <Icon name="pencil" size={18} color="#007bff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.serviceActionButton} onPress={() => confirmDeleteService(service)}>
                            <Icon name="trash" size={18} color="#dc3545" />
                        </TouchableOpacity>
                    </View>
                </View>
            ))
        ) : <Text style={styles.noDataText}>No services listed yet.</Text>}


        <View style={styles.separator} />
        <Text style={styles.detailTitle}>Barbers</Text>
        {barbersList && barbersList.length > 0 ? (
          barbersList.map(barber => (
            <View key={barber._id} style={styles.barberItem}>
              <View style={styles.barberIconContainer}><Icon name="user-circle" size={30} color="#333" /></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.barberName}>{barber.name}</Text>
                <Text style={styles.barberContact}>{barber.phone}</Text>
                <Text style={styles.barberStats}>Served: {barber.customersServed || 0}</Text>
              </View>
              <TouchableOpacity style={styles.barberEditButton} onPress={() => handleOpenEditBarberModal(barber)}><Icon name="pencil" size={18} color="#007bff" /></TouchableOpacity>
            </View>
          ))
        ) : <Text style={styles.noDataText}>No barbers listed yet.</Text>}
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity style={styles.addBarberButton} onPress={() => setIsAddBarberModalVisible(true)}><Icon name="plus" size={18} color="#fff" /><Text style={styles.addBarberButtonText}>Add Barber</Text></TouchableOpacity>
          <TouchableOpacity style={styles.deleteShopButton} onPress={confirmDeleteShop}><Icon name="trash" size={18} color="#fff" /><Text style={styles.deleteShopButtonText}>Delete Shop</Text></TouchableOpacity>
        </View>
      </View>

      {/* Shop Edit Modal */}
      <Modal visible={isEditShopModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditShopModalVisible(false)}>
        <View style={styles.modalContainer}><View style={styles.modalContent}><Text style={styles.modalTitle}>Edit Shop</Text>
          <Text style={styles.inputLabel}>Name:</Text><TextInput style={styles.input} value={editedShopData?.name} onChangeText={txt => setEditedShopData({...editedShopData, name: txt})} />
          <Text style={styles.inputLabel}>Address:</Text><TextInput style={styles.input} value={editedShopData?.address} onChangeText={txt => setEditedShopData({...editedShopData, address: txt})} />
          <Text style={styles.inputLabel}>Opening (HH:MM):</Text><TextInput style={styles.input} value={editedShopData?.openingTime} onChangeText={txt => setEditedShopData({...editedShopData, openingTime: txt})} />
          <Text style={styles.inputLabel}>Closing (HH:MM):</Text><TextInput style={styles.input} value={editedShopData?.closingTime} onChangeText={txt => setEditedShopData({...editedShopData, closingTime: txt})} />
          <View style={styles.toggleRow}><Text style={styles.toggleLabel}>Status:</Text><Switch value={editedShopData?.isOpen} onValueChange={handleToggleShopStatusInEditModal} /><Text>{editedShopData?.isOpen ? 'Open' : 'Closed'}</Text></View>
          <Text style={styles.carouselImagesTitle}>Images:</Text>
          <ScrollView style={styles.carouselEditScrollVertical}><View style={styles.carouselImagesGrid}>
            <TouchableOpacity style={styles.addImageButton} onPress={pickShopImage}><Icon name="plus" size={30} color="#007bff" /><Text>Add</Text></TouchableOpacity>
            {editedShopData?.carouselImages.map((img, idx) => <View key={idx.toString()} style={styles.carouselEditImageContainer}><Image source={{uri: img}} style={styles.carouselEditImage} /><TouchableOpacity style={styles.removeImageButton} onPress={() => handleRemoveShopCarouselImage(idx)}><Icon name="times-circle" size={24} color="#dc3545" /></TouchableOpacity></View>)}
          </View></ScrollView>
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveShopChanges}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsEditShopModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* Add Barber Modal */}
      <Modal visible={isAddBarberModalVisible} transparent animationType="slide" onRequestClose={() => setIsAddBarberModalVisible(false)}>
        <View style={styles.modalContainer}><View style={styles.modalContent}><Text style={styles.modalTitle}>Add Barber</Text>
          <Text style={styles.inputLabel}>Name:</Text><TextInput style={styles.input} value={newBarberData.name} onChangeText={txt => setNewBarberData({...newBarberData, name: txt})} />
          <Text style={styles.inputLabel}>Phone:</Text><TextInput style={styles.input} value={newBarberData.phone} onChangeText={txt => setNewBarberData({...newBarberData, phone: txt})} keyboardType="phone-pad"/>
          <Text style={styles.inputLabel}>Password:</Text><TextInput style={styles.input} value={newBarberData.password} onChangeText={txt => setNewBarberData({...newBarberData, password: txt})} secureTextEntry/>
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAddBarber}><Text style={styles.modalButtonText}>Add</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddBarberModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* Edit Barber Modal */}
      <Modal visible={isEditBarberModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditBarberModalVisible(false)}>
        <View style={styles.modalContainer}><View style={styles.modalContent}><Text style={styles.modalTitle}>Edit Barber</Text>
          {editingBarber && <>
            <Text style={styles.inputLabel}>Name:</Text><TextInput style={styles.input} value={editedBarberData.name} onChangeText={txt => setEditedBarberData({...editedBarberData, name: txt})} />
            <Text style={styles.inputLabel}>Phone:</Text><TextInput style={styles.input} value={editedBarberData.phone} onChangeText={txt => setEditedBarberData({...editedBarberData, phone: txt})} keyboardType="phone-pad"/>
            <Text style={styles.inputLabel}>New Password (optional):</Text><TextInput style={styles.input} placeholder="Leave blank to keep current" value={editedBarberData.password} onChangeText={txt => setEditedBarberData({...editedBarberData, password: txt})} secureTextEntry/>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveBarberChanges}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => {setIsEditBarberModalVisible(false); setEditingBarber(null);}}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={() => {setIsEditBarberModalVisible(false); confirmDeleteBarber(editingBarber);}}><Text style={styles.modalButtonText}>Delete</Text></TouchableOpacity>
            </View>
          </>}
        </View></View>
      </Modal>

      {/* Add Service Modal */}
      <Modal visible={isAddServiceModalVisible} transparent animationType="slide" onRequestClose={() => setIsAddServiceModalVisible(false)}>
          <View style={styles.modalContainer}><View style={styles.modalContent}><Text style={styles.modalTitle}>Add Service</Text>
              <Text style={styles.inputLabel}>Service Name:</Text><TextInput style={styles.input} value={newServiceData.name} onChangeText={txt => setNewServiceData({...newServiceData, name: txt})} />
              <Text style={styles.inputLabel}>Price:</Text><TextInput style={styles.input} value={newServiceData.price} onChangeText={txt => setNewServiceData({...newServiceData, price: txt})} keyboardType="numeric"/>
              <View style={styles.modalButtonContainer}>
                  <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAddService}><Text style={styles.modalButtonText}>Add</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddServiceModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
              </View>
          </View></View>
      </Modal>

      {/* Edit Service Modal */}
      <Modal visible={isEditServiceModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditServiceModalVisible(false)}>
          <View style={styles.modalContainer}><View style={styles.modalContent}><Text style={styles.modalTitle}>Edit Service</Text>
              {editingService && <>
                  <Text style={styles.inputLabel}>Service Name:</Text><TextInput style={styles.input} value={editedServiceData.name} onChangeText={txt => setEditedServiceData({...editedServiceData, name: txt})} />
                  <Text style={styles.inputLabel}>Price:</Text><TextInput style={styles.input} value={editedServiceData.price} onChangeText={txt => setEditedServiceData({...editedServiceData, price: txt})} keyboardType="numeric"/>
                  <View style={styles.modalButtonContainer}>
                      <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleUpdateService}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => {setIsEditServiceModalVisible(false); setEditingService(null);}}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
                  </View>
              </>}
          </View></View>
      </Modal>

      {/* Delete Confirmation Modals (Shop, Barber, Service) */}
      {[
        {visible: isDeleteShopConfirmModalVisible, close: () => setIsDeleteShopConfirmModalVisible(false), title: "Delete Shop", text: `Delete "${currentShop?.name}"?`, action: executeDeleteShop},
        {visible: isDeleteBarberConfirmModalVisible, close: () => setIsDeleteBarberConfirmModalVisible(false), title: "Delete Barber", text: `Remove "${barberToDelete?.name}"?`, action: executeDeleteBarber},
        {visible: isDeleteServiceConfirmModalVisible, close: () => setIsDeleteServiceConfirmModalVisible(false), title: "Delete Service", text: `Remove "${serviceToDelete?.name}"?`, action: executeDeleteService}
      ].map(m => m.visible && (
        <Modal key={m.title} visible={m.visible} transparent animationType="fade" onRequestClose={m.close}>
          <View style={styles.confirmModalContainer}><View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>{m.title}</Text><Text style={styles.confirmModalText}>{m.text}</Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={m.action}><Text style={styles.modalButtonText}>Delete</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={m.close}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
            </View>
          </View></View>
        </Modal>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
  retryButton: { backgroundColor: '#007bff', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 20 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  customHeader: { backgroundColor: '#000', paddingTop: Platform.OS === 'android' ? 10 : 15, paddingHorizontal: 15, paddingBottom: 15 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  shopNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 15 },
  numbrLogo: { fontSize: 20, fontWeight: 'bold', color: '#fff', fontStyle: 'italic' },
  headerCloseButtonNew: { padding: 8, borderRadius: 20 },
  headerButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 5 },
  shopNameInHeader: { fontSize: 26, fontWeight: 'bold', color: '#000', flex: 1 },
  carouselWrapper: { marginTop: 20, marginBottom: 20, alignItems: 'center' },
  carouselContainer: { width: screenWidth - 30, height: 200, borderRadius: 15, overflow: 'hidden' },
  carouselImage: { width: screenWidth - 30, height: '100%', resizeMode: 'cover' },
  carouselImagePlaceholder: { width: screenWidth - 30, height: 200, resizeMode: 'contain', backgroundColor: '#f0f0f0', borderRadius: 15, justifyContent: 'center', alignItems: 'center', tintColor: '#ccc' },
  paginationDotsContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  paginationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ccc', marginHorizontal: 4 },
  paginationDotActive: { backgroundColor: '#007bff' },
  detailsCard: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 20, padding: 20, borderRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  detailTitleContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  detailTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  headerEditButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#007bff' },
  addCircleButton: { padding: 5 }, // For add service button
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  detailIcon: { marginRight: 10, width: 25, textAlign: 'center' },
  detailText: { fontSize: 16, color: '#555', flex: 1 },
  overrideText: { fontStyle: 'italic', color: '#dc3545', marginLeft: 5, fontSize: 14 },
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
  serviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 16, fontWeight: '500', color: '#333' },
  servicePrice: { fontSize: 15, color: '#28a745' },
  serviceActions: { flexDirection: 'row' },
  serviceActionButton: { paddingHorizontal: 10, paddingVertical: 5 },
  barberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, marginBottom: 10, backgroundColor: '#f9f9f9', borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  barberIconContainer: { alignItems: 'center', justifyContent: 'center', paddingRight: 10 },
  barberName: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 2 },
  barberContact: { fontSize: 14, color: '#666', marginBottom: 1 },
  barberStats: { fontSize: 13, color: '#888', marginTop: 3 },
  barberEditButton: { padding: 8, borderRadius: 8, backgroundColor: '#e0f7fa', marginLeft: 10, shadowColor: '#007bff', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  noDataText: { fontSize: 16, color: '#777', textAlign: 'center', marginTop: 10, marginBottom:10 },
  bottomButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  addBarberButton: { backgroundColor: '#007bff', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 1, marginRight: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 6 },
  addBarberButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  deleteShopButton: { backgroundColor: '#dc3545', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 1, marginLeft: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 6 },
  deleteShopButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  modalContent: { width: "90%", maxHeight: '90%', backgroundColor: "#fff", padding: 25, borderRadius: 20, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 15 },
  modalTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 20, color: "#333" },
  inputLabel: { alignSelf: 'flex-start', fontSize: 14, color: '#555', marginBottom: 5, fontWeight: '600' },
  input: { width: "100%", borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginBottom: 15, fontSize: 16, backgroundColor: "#f9f9f9" },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', width: '100%', marginBottom: 15, paddingHorizontal: 5 },
  toggleLabel: { fontSize: 16, color: '#555', fontWeight: '600', marginRight: 10 },
  toggleStatusText: { fontSize: 16, fontWeight: 'bold', marginLeft: 10, color: '#333' },
  carouselImagesTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 10, alignSelf: 'flex-start' },
  carouselEditScrollVertical: { width: '100%', maxHeight: 250, marginBottom: 20 },
  carouselImagesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  carouselEditImageContainer: { position: 'relative', width: (screenWidth * 0.9 - 50 - 20) / 3, height: (screenWidth * 0.9 - 50 - 20) / 3, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#eee', marginBottom: 10, marginRight: 10 },
  carouselEditImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageButton: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12, padding: 2 },
  addImageButton: { width: (screenWidth * 0.9 - 50 - 20) / 3, height: (screenWidth * 0.9 - 50 - 20) / 3, backgroundColor: '#e0f7fa', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#007bff', borderStyle: 'dashed', marginBottom: 10, marginRight: 10 },
  addImageButtonText: { fontSize: 12, color: '#007bff', marginTop: 5, textAlign: 'center' },
  modalButtonContainer: { flexDirection: "row", justifyContent: "space-around", width: "100%", marginTop: 20 },
  modalButton: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", flex: 1, marginHorizontal: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  modalButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold", textAlign: 'center' },
  saveButton: { backgroundColor: "#28a745" },
  deleteButton: { backgroundColor: "#dc3545" },
  cancelButton: { backgroundColor: "#6c757d" },
  confirmModalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  confirmModalContent: { backgroundColor: '#fff', padding: 25, borderRadius: 15, width: '80%', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  confirmModalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  confirmModalText: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  infoText: { fontSize: 14, color: '#007bff', textAlign: 'center', marginBottom: 15, paddingHorizontal: 10, fontStyle: 'italic' },
});

export default ShopsList;