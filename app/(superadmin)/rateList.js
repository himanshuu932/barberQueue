import React, { useState, useEffect } from "react";
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
  ImageBackground
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RateList = () => {
  const [shopId, setShopId] = useState(null);
  const [rateList, setRateList] = useState([]);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [selectedRateItem, setSelectedRateItem] = useState(null);
  const [newRateItem, setNewRateItem] = useState({ service: "", price: "" });
  const [updatedRateItem, setUpdatedRateItem] = useState({ service: "", price: "" });

  useEffect(() => {
    const fetchShopIdAndRates = async () => {
      const uid = await AsyncStorage.getItem("uid");
      setShopId(uid);
      fetchRateList(uid);
    };
    fetchShopIdAndRates();
  }, []);

  const fetchRateList = async (uid) => {
    try {
      // GET endpoint with shop id as query parameter
      const response = await fetch(`https://barberqueue-24143206157.us-central1.run.app/shop/rateList?id=${uid}`);
      const data = await response.json();
      if (response.ok) {
        setRateList(data);
      } else {
        Alert.alert("Error", "Failed to fetch rate list");
      }
    } catch (error) {
      console.error("Error fetching rate list:", error);
      Alert.alert("Error", "Could not connect to the server");
    }
  };

  const handleAddRateItem = async () => {
    if (!shopId) {
      Alert.alert("Error", "Shop ID not found.");
      return;
    }
    if (!newRateItem.service || newRateItem.price === "") {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }
    try {
      const response = await fetch("https://barberqueue-24143206157.us-central1.run.app/shop/rateList/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          service: newRateItem.service,
          price: newRateItem.price
        })
      });
      const data = await response.json();
      if (response.ok) {
        setNewRateItem({ service: "", price: "" });
        setIsAddModalVisible(false);
        Alert.alert("Success", "Rate list item added successfully!");
        fetchRateList(shopId);
      } else {
        Alert.alert("Error", data.message || "Failed to add rate list item");
      }
    } catch (error) {
      console.error("Error adding rate list item:", error);
      Alert.alert("Error", "Could not connect to the server");
    }
  };

  const handleUpdateRateItem = async () => {
    if (!shopId) {
      Alert.alert("Error", "Shop ID not found.");
      return;
    }
    if (!updatedRateItem.service || updatedRateItem.price === "") {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }
    try {
      const response = await fetch("https://barberqueue-24143206157.us-central1.run.app/shop/rateList/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          rateItemId: selectedRateItem._id,
          service: updatedRateItem.service,
          price: updatedRateItem.price
        })
      });
      const data = await response.json();
      if (response.ok) {
        setIsEditModalVisible(false);
        Alert.alert("Success", "Rate list item updated successfully!");
        fetchRateList(shopId);
      } else {
        Alert.alert("Error", data.message || "Failed to update rate list item");
      }
    } catch (error) {
      console.error("Error updating rate list item:", error);
      Alert.alert("Error", "Could not connect to the server");
    }
  };

  const handleDeleteRateItem = async () => {
    if (!shopId) {
      Alert.alert("Error", "Shop ID not found.");
      return;
    }
    try {
      const response = await fetch("https://barberqueue-24143206157.us-central1.run.app/shop/rateList/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          rateItemId: selectedRateItem._id
        })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", "Rate list item deleted successfully!");
        setIsEditModalVisible(false);
        fetchRateList(shopId);
      } else {
        Alert.alert("Error", data.message || "Failed to delete rate list item");
      }
    } catch (error) {
      console.error("Error deleting rate list item:", error);
      Alert.alert("Error", "Could not connect to the server");
    }
  };

  const RateListCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.service}</Text>
        <Text style={styles.detail}>Price: {item.price}</Text>
      </View>
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => {
          setSelectedRateItem(item);
          setUpdatedRateItem({ service: item.service, price: item.price.toString() });
          setIsEditModalVisible(true);
        }}
      >
        <Image source={require("../image/editb.png")} style={{ width: 25, height: 25 }} />
      </TouchableOpacity>
    </View>
  );

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
      <View style={styles.container}>
        <Text style={styles.pageHeading}>Rate List</Text>
        <FlatList
          data={rateList}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <RateListCard item={item} />}
        />

        {/* Button to open Add Modal */}
        <TouchableOpacity style={styles.addButton} onPress={() => setIsAddModalVisible(true)}>
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>

        {/* Add Rate List Item Modal */}
        <Modal visible={isAddModalVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Rate List Item</Text>
              <TextInput
                style={styles.input}
                placeholder="Service"
                value={newRateItem.service}
                onChangeText={(text) => setNewRateItem({ ...newRateItem, service: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Price"
                keyboardType="numeric"
                value={newRateItem.price}
                onChangeText={(text) => setNewRateItem({ ...newRateItem, price: text })}
              />
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={styles.modalButton} onPress={() => setIsAddModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleAddRateItem}>
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Rate List Item Modal */}
        <Modal visible={isEditModalVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Rate List Item</Text>
              <TextInput
                style={styles.input}
                placeholder="Service"
                value={updatedRateItem.service}
                onChangeText={(text) => setUpdatedRateItem({ ...updatedRateItem, service: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Price"
                keyboardType="numeric"
                value={updatedRateItem.price}
                onChangeText={(text) => setUpdatedRateItem({ ...updatedRateItem, price: text })}
              />
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={styles.modalButton} onPress={() => setIsEditModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleUpdateRateItem}>
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
                Are you sure you want to delete this rate item?
              </Text>
              <View style={styles.confirmButtonContainer}>
                <TouchableOpacity style={styles.confirmButton} onPress={() => setIsConfirmVisible(false)}>
                  <Text style={styles.confirmButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmDeleteButton]}
                  onPress={() => {
                    handleDeleteRateItem();
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
  },
  confirmButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "rgb(0,0,0)",
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
    backgroundColor: "rgb(0,0,0)",
  },
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
    paddingLeft: 15,
    paddingRight: 15,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
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
    fontSize: 65,
    fontWeight: "bold",
    textAlign: "center",
    color: "black",
    letterSpacing: 1,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  editButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255, 255, 255, 0.26)",
    padding: 3,
    borderRadius: 6,
    alignItems: "center",
  },
  addButton: {
    position: "absolute",
    bottom: 30,
    right: 15,
    backgroundColor: "rgb(51, 154, 28)",
    width: 60,
    height: 60,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#fff",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 5,
    elevation: 6,
    padding: 4,
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
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
  },
  modalButton: {
    backgroundColor: "#000",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 10,
    shadowColor: "#fff",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 5,
    elevation: 6,
    width: "30%",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "red",
  },
});

export default RateList;
