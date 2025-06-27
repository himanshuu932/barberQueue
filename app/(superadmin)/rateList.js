import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ImageBackground,
  ActivityIndicator,
  Platform 
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from 'react-native-vector-icons/MaterialIcons';

const API_BASE_URL = 'https://numbr-exq6.onrender.com/api';

const RateList = () => {
  const [ownerId, setOwnerId] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [ownerShops, setOwnerShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [selectedShopName, setSelectedShopName] = useState("");
  const [rateList, setRateList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingShops, setIsLoadingShops] = useState(true);
  const [showShopPicker, setShowShopPicker] = useState(false);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [selectedRateItem, setSelectedRateItem] = useState(null);
  const [newServiceData, setNewServiceData] = useState({ name: "", price: "" });
  const [updatedServiceData, setUpdatedServiceData] = useState({ name: "", price: "" });

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const storedOwnerId = await AsyncStorage.getItem("uid");
        const storedToken = await AsyncStorage.getItem("userToken");

        if (storedOwnerId && storedToken) {
          setOwnerId(storedOwnerId);
          setAuthToken(storedToken);
          fetchOwnerShops(storedToken);
        } else {
          Alert.alert("Authentication Error", "User ID or Token not found. Please log in again.");
          setIsLoadingShops(false);
        }
      } catch (e) {
        console.error("Failed to load auth data from storage", e);
        Alert.alert("Storage Error", "Failed to load authentication data.");
        setIsLoadingShops(false);
      }
    };
    loadInitialData();
  }, []);

  const fetchOwnerShops = useCallback(async (token) => {
    setIsLoadingShops(true);
    try {
      const response = await fetch(`${API_BASE_URL}/owners/me/shops`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch owner's shops");
      }
      const data = await response.json();
      setOwnerShops(data.data || []);
      // Removed the automatic selection of first shop
    } catch (error) {
      console.error("Error fetching owner's shops:", error);
      Alert.alert("Error", error.message || "Could not fetch your shops.");
      setOwnerShops([]);
      setRateList([]);
    } finally {
      setIsLoadingShops(false);
    }
  }, []);

  const fetchRateList = useCallback(async (shopIdToFetch) => {
    if (!shopIdToFetch || !authToken) {
      setRateList([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/shops/${shopIdToFetch}/rate-list`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setRateList(data.data || []);
      } else {
        Alert.alert("Error", data.message || "Failed to fetch rate list for the selected shop.");
        setRateList([]);
      }
    } catch (error) {
      console.error("Error fetching rate list:", error);
      Alert.alert("Error", "Could not connect to the server to fetch rate list.");
      setRateList([]);
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (selectedShopId) {
      fetchRateList(selectedShopId);
    } else {
      setRateList([]);
    }
  }, [selectedShopId, fetchRateList]);

  const handleShopSelect = (shopId, shopName) => {
    setSelectedShopId(shopId);
    setSelectedShopName(shopName);
    setShowShopPicker(false);
  };

  const handleAddServiceItem = async () => {
    if (!selectedShopId || !authToken) {
      Alert.alert("Error", "No shop selected or user not authenticated.");
      return;
    }
    if (!newServiceData.name || newServiceData.price === "") {
      Alert.alert("Error", "Please fill all fields: Service Name and Price.");
      return;
    }
    const price = parseFloat(newServiceData.price);
    if (isNaN(price) || price < 0) {
      Alert.alert("Validation Error", "Please enter a valid non-negative price.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/shops/${selectedShopId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          name: newServiceData.name,
          price: price
        })
      });
      const data = await response.json();
      if (response.ok) {
        setNewServiceData({ name: "", price: "" });
        setIsAddModalVisible(false);
        Alert.alert("Success", "Service added successfully!");
        fetchRateList(selectedShopId);
      } else {
        Alert.alert("Error", data.message || "Failed to add service.");
      }
    } catch (error) {
      console.error("Error adding service:", error);
      Alert.alert("Error", "Could not connect to the server to add service.");
    }
  };

  const handleUpdateServiceItem = async () => {
    if (!selectedShopId || !selectedRateItem || !authToken) {
      Alert.alert("Error", "No shop/service selected or user not authenticated.");
      return;
    }
    if (!updatedServiceData.name || updatedServiceData.price === "") {
      Alert.alert("Error", "Please fill all fields: Service Name and Price.");
      return;
    }
    const price = parseFloat(updatedServiceData.price);
    if (isNaN(price) || price < 0) {
      Alert.alert("Validation Error", "Please enter a valid non-negative price.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/shops/${selectedShopId}/services/${selectedRateItem._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          name: updatedServiceData.name,
          price: price
        })
      });
      const data = await response.json();
      if (response.ok) {
        setIsEditModalVisible(false);
        Alert.alert("Success", "Service updated successfully!");
        fetchRateList(selectedShopId);
      } else {
        Alert.alert("Error", data.message || "Failed to update service.");
      }
    } catch (error) {
      console.error("Error updating service:", error);
      Alert.alert("Error", "Could not connect to the server to update service.");
    }
  };

  const handleDeleteServiceItem = async () => {
    if (!selectedShopId || !selectedRateItem || !authToken) {
      Alert.alert("Error", "No shop/service selected or user not authenticated.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/shops/${selectedShopId}/services/${selectedRateItem._id}`, {
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", data.message || "Service deleted successfully!");
        setIsEditModalVisible(false);
        fetchRateList(selectedShopId);
      } else {
        Alert.alert("Error", data.message || "Failed to delete service.");
      }
    } catch (error) {
      console.error("Error deleting service:", error);
      Alert.alert("Error", "Could not connect to the server to delete service.");
    }
  };

  const ServiceCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.detail}>Price: ₹{item.price ? item.price.toFixed(2) : 'N/A'}</Text>
      </View>
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => {
          setSelectedRateItem(item);
          setUpdatedServiceData({ name: item.name, price: item.price ? item.price.toString() : "" });
          setIsEditModalVisible(true);
        }}
      >
        <Image source={require("../image/editb.png")} style={{ width: 25, height: 25 }} />
      </TouchableOpacity>
    </View>
  );

  if (isLoadingShops) {
    return (
      <View style={[styles.container, styles.loadingView]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading your shops...</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.shopSelectButton}
            onPress={() => setShowShopPicker(true)}
          >
            <Icon name="store" size={30} color="#000" />
          </TouchableOpacity>
          
          <Text style={styles.shopName} numberOfLines={1} ellipsizeMode="tail">
            {selectedShopName || "Select a Shop"}
          </Text>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setIsAddModalVisible(true)}
            disabled={!selectedShopId}
          >
            <Icon name="add" size={30} color="#fff" />
          </TouchableOpacity>
        </View>

        {showShopPicker && (
          <Modal visible={showShopPicker} transparent animationType="fade">
            <View style={styles.pickerModalContainer}>
              <View style={styles.pickerModalContent}>
                <Text style={styles.pickerTitle}>Select Shop</Text>
                {ownerShops.length > 0 ? (
                  <FlatList
                    data={ownerShops}
                    keyExtractor={(item) => item._id.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.shopItem}
                        onPress={() => handleShopSelect(item._id, item.name)}
                      >
                        <Text style={styles.shopItemText}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                ) : (
                  <Text style={styles.noShopsText}>You don't have any shops yet.</Text>
                )}
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowShopPicker(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {!selectedShopId ? (
          <View style={styles.selectShopMessageContainer}>
            <Text style={styles.selectShopMessage}>
              Please select a shop to view its services
            </Text>
          </View>
        ) : isLoading ? (
          <ActivityIndicator size="large" color="#0000ff" style={{marginTop: 20}}/>
        ) : rateList.length > 0 ? (
          <FlatList
            data={rateList}
            keyExtractor={(item) => item._id.toString()}
            renderItem={({ item }) => <ServiceCard item={item} />}
            style={{marginTop: 10}}
          />
        ) : (
          <Text style={styles.noDataText}>No services found for this shop. Add some!</Text>
        )}

        {/* Add Service Modal */}
        <Modal visible={isAddModalVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add New Service</Text>
              <TextInput
                style={styles.input}
                placeholder="Service Name"
                value={newServiceData.name}
                onChangeText={(text) => setNewServiceData({ ...newServiceData, name: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Price"
                keyboardType="numeric"
                value={newServiceData.price}
                onChangeText={(text) => setNewServiceData({ ...newServiceData, price: text })}
              />
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={styles.modalButton} onPress={() => setIsAddModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleAddServiceItem}>
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Service Modal */}
        <Modal visible={isEditModalVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Service</Text>
              <TextInput
                style={styles.input}
                placeholder="Service Name"
                value={updatedServiceData.name}
                onChangeText={(text) => setUpdatedServiceData({ ...updatedServiceData, name: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Price"
                keyboardType="numeric"
                value={updatedServiceData.price}
                onChangeText={(text) => setUpdatedServiceData({ ...updatedServiceData, price: text })}
              />
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={styles.modalButton} onPress={() => setIsEditModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleUpdateServiceItem}>
                  <Text style={styles.modalButtonText}>Update</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.deleteButton]}
                  onPress={() => setIsConfirmVisible(true)}
                >
                  <Text style={styles.modalButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal visible={isConfirmVisible} transparent animationType="fade">
          <View style={styles.confirmContainer}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>
                Are you sure you want to delete this service?
              </Text>
              <View style={styles.confirmButtonContainer}>
                <TouchableOpacity style={styles.confirmButton} onPress={() => setIsConfirmVisible(false)}>
                  <Text style={styles.confirmButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmDeleteButton]}
                  onPress={() => {
                    handleDeleteServiceItem();
                    setIsConfirmVisible(false);
                    setIsEditModalVisible(false);
                  }}
                >
                  <Text style={styles.confirmButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({

  selectShopMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectShopMessage: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  loadingView: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noShopsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#555',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#555',
    marginTop: 20,
  },
  confirmContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.71)",
  },
  confirmBox: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: '#333',
  },
  confirmButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "rgb(80,80,80)",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    margin: 5,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  confirmDeleteButton: {
    backgroundColor: "#dc3545",
  },
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(237, 236, 236, 0.77)",
  },
  container: {
    flex: 1,
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: Platform.OS === 'android' ? 25 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  shopSelectButton: {
    padding: 5, 
    backgroundColor: 'rgba(0,0,200,0.7)', 
    borderRadius: "20%", 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  shopName: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  addButton: {
    backgroundColor: "rgb(51, 154, 28)",
    borderRadius: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  pickerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerModalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  shopItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  shopItemText: {
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 15,
    padding: 10,
    backgroundColor: 'rgb(0, 0, 0)',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: 'rgb(255, 255, 255)',
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  detail: {
    fontSize: 14,
    color: "#555",
    marginVertical: 2,
  },
  editButton: {
    padding: 8,
    borderRadius: 20,
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: '#333',
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
    marginTop: 10,
  },
  modalButton: {
    backgroundColor: "#007bff",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    elevation: 3,
    minWidth: "30%",
    marginHorizontal: 5,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "#dc3545",
  },
});

export default RateList;