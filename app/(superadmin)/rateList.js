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
import { Picker } from '@react-native-picker/picker';

// Use the API_BASE_URL consistent with your backend setup
const API_BASE_URL = 'https://numbr-p7zc.onrender.com/api';

 const RateList = () => {
  const [ownerId, setOwnerId] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [ownerShops, setOwnerShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [rateList, setRateList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingShops, setIsLoadingShops] = useState(true);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [selectedRateItem, setSelectedRateItem] = useState(null); // This is the service item
  const [newServiceData, setNewServiceData] = useState({ name: "", price: "" });
  const [updatedServiceData, setUpdatedServiceData] = useState({ name: "", price: "" });

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const storedOwnerId = await AsyncStorage.getItem("uid"); // Assuming 'uid' stores owner's ID
        const storedToken = await AsyncStorage.getItem("userToken"); // Assuming 'userToken' stores the auth token

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
      //  This endpoint /api/owners/me/shops is assumed.
      //  You might need to adjust it based on your actual owner routes.
      //  Alternatively, if you have a route like /api/shops and can filter by owner on the backend,
      //  or fetch all and filter client-side (not ideal for many shops).
      const response = await fetch(`${API_BASE_URL}/owners/me/shops`, { // Placeholder: Replace with your actual endpoint
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch owner's shops");
      }
      const data = await response.json();
      setOwnerShops(data.data || []); // Assuming shops are in data.data array
      if (data.data && data.data.length > 0) {
        setSelectedShopId(data.data[0]._id); // Select the first shop by default
      } else {
        setRateList([]); // No shops, so no rates to show
      }
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
      const response = await fetch(`${API_BASE_URL}/shops/${shopIdToFetch}/rate-list`, { //
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setRateList(data.data || []); // Assuming services are in data.data
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

  // Fetch rate list when selectedShopId changes
  useEffect(() => {
    if (selectedShopId) {
      fetchRateList(selectedShopId);
    } else {
      setRateList([]); // Clear rate list if no shop is selected
    }
  }, [selectedShopId, fetchRateList]);


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
      const response = await fetch(`${API_BASE_URL}/shops/${selectedShopId}/services`, { //
        method: "POST",
        headers: { "Content-Type": "application/json", 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          name: newServiceData.name, // API expects 'name'
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
      const response = await fetch(`${API_BASE_URL}/shops/${selectedShopId}/services/${selectedRateItem._id}`, { //
        method: "PUT",
        headers: { "Content-Type": "application/json", 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          name: updatedServiceData.name, // API expects 'name'
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
      const response = await fetch(`${API_BASE_URL}/shops/${selectedShopId}/services/${selectedRateItem._id}`, { //
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${authToken}` }
        // No body typically needed for DELETE with URL params
      });
      const data = await response.json(); // Even if no content, response.json() might be attempted.
      if (response.ok) {
        Alert.alert("Success", data.message || "Service deleted successfully!");
        setIsEditModalVisible(false); // Close edit modal if delete was from there
        fetchRateList(selectedShopId);
      } else {
         // Try to parse error message from backend
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
        <Text style={styles.detail}>Price: ${item.price ? item.price.toFixed(2) : 'N/A'}</Text>
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
        <Text style={styles.pageHeading}>Manage Services</Text>

        {ownerShops.length > 0 ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedShopId}
              onValueChange={(itemValue) => setSelectedShopId(itemValue)}
              style={styles.picker}
              dropdownIconColor="#000000"
            >
              {ownerShops.map(shop => (
                <Picker.Item key={shop._id} label={shop.name} value={shop._id} />
              ))}
            </Picker>
          </View>
        ) : (
          <Text style={styles.noShopsText}>You don't have any shops yet. Add a shop to manage services.</Text>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color="#0000ff" style={{marginTop: 20}}/>
        ) : selectedShopId && rateList.length > 0 ? (
          <FlatList
            data={rateList}
            keyExtractor={(item) => item._id.toString()}
            renderItem={({ item }) => <ServiceCard item={item} />}
            style={{marginTop: 10}}
          />
        ) : selectedShopId ? (
            <Text style={styles.noDataText}>No services found for this shop. Add some!</Text>
        ): null}


        {selectedShopId && (
          <TouchableOpacity style={styles.addButton} onPress={() => setIsAddModalVisible(true)}>
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
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
                  onPress={() => setIsConfirmVisible(true)} // Open confirmation
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
                    setIsEditModalVisible(false); // Close edit modal as item is deleted
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
  loadingView: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    marginBottom: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden', // Ensures the border radius is respected by the Picker
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#333', // Text color of picker items
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
    backgroundColor: "rgb(80,80,80)", // Darker gray for cancel
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
    backgroundColor: "#dc3545", // Standard delete red
  },
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
    width: "100%",
    height: "100%",
    // position: "absolute", // Keep for background behavior if needed, or remove if container handles flex
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(237, 236, 236, 0.77)",
  },
  container: {
    flex: 1,
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: Platform.OS === 'android' ? 25 : 40, // Adjust for status bar
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3, // Android shadow
    shadowColor: '#000', // iOS shadow
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
  pageHeading: {
    fontSize: 48, // Slightly reduced for better fit
    fontWeight: "bold",
    textAlign: "center",
    color: "black",
    letterSpacing: 1,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 10, // Add some margin below heading
  },
  editButton: {
    // position: "absolute", // No longer absolute for better flow
    // top: 10,
    // right: 10,
    backgroundColor: "rgba(255, 255, 255, 0.26)", // Can be removed or made more subtle
    padding: 8, // Increased padding
    borderRadius: 20, // Make it circular
    alignItems: "center",
  },
  addButton: {
    position: "absolute",
    bottom: 30,
    right: 15,
    backgroundColor: "rgb(51, 154, 28)",
    width: 60,
    height: 60,
    borderRadius: 30, // Make it circular
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000", // Darker shadow for better visibility
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 5,
    elevation: 6,
    // padding: 4, // Padding is managed by centering content
  },
  buttonText: {
    color: "rgb(255,255,255)",
    fontWeight: "bold",
    fontSize: 30,
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
    backgroundColor: '#f9f9f9', // Light background for input
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
    marginTop: 10, // Add some top margin
  },
  modalButton: {
    backgroundColor: "#007bff", // Primary button color
    paddingVertical: 12,
    paddingHorizontal: 10, // Adjust padding for button width
    borderRadius: 8,
    alignItems: "center",
    // marginVertical: 10, // Handled by container
    // shadowColor: "#000", // Using elevation mostly for Android
    // shadowOpacity: 0.2,
    // shadowOffset: { width: 0, height: 2 },
    // shadowRadius: 3,
    elevation: 3,
    minWidth: "30%", // Ensure buttons have some minimum width
    marginHorizontal: 5, // Space between buttons
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "#dc3545", // Standard delete red
  },
});

export default RateList;