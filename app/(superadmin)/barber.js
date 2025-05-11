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
const Barber = () => {
  const [barbers, setBarbers] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false); // For editing a barber
  const [isAddModalVisible, setIsAddModalVisible] = useState(false); // For adding a new barber
  const [shopId, setShopId] = useState(null);
  
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const [updatedBarber, setUpdatedBarber] = useState({
    name: "",
    email: "",
    phone: "",
    password: ""
  });

  useEffect(() => {
    const fetchData = async () => {
      const uid = await AsyncStorage.getItem("uid");
      setShopId(uid);
      fetchBarbers(uid);
    };
    fetchData();
  }, []);

  const fetchBarbers = async (uid) => {
    try {
      const response = await fetch(`https://servercheckbarber-2u89.onrender.com:5000:5000/barbers?shopId=${uid}`);
      const data = await response.json();
      if (response.ok) {
        setBarbers(data);
      } else {
        Alert.alert("Error", "Failed to fetch barbers");
      }
    } catch (error) {
      console.error("Error fetching barbers:", error);
      Alert.alert("Error", "Could not connect to the server");
    }
  };

  const handleSaveEmployee = async () => {
    if (!shopId) {
      Alert.alert("Error", "Shop ID not found.");
      return;
    }

    if (!newEmployee.name || !newEmployee.email || !newEmployee.password || !newEmployee.phone) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }

    try {
      const response = await fetch("https://servercheckbarber-2u89.onrender.com:5000:5000/barber/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newEmployee, shopId })
      });

      const data = await response.json();
      if (response.ok) {
        setNewEmployee({ name: "", email: "", password: "", phone: "" });
        setIsAddModalVisible(false);
        Alert.alert("Success", "Barber added successfully!");
        fetchBarbers(shopId);
      } else {
        Alert.alert("Error", data.error || "Failed to add barber");
      }
    } catch (error) {
      console.error("Error adding barber:", error);
      Alert.alert("Error", "Could not connect to the server");
    }
  };

  const handleUpdateBarber = async () => {
    if (!shopId) {
      Alert.alert("Error", "Shop ID not found.");
      return;
    }

    if (!updatedBarber.name || !updatedBarber.email || !updatedBarber.phone) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }

    try {
      const response = await fetch("https://servercheckbarber-2u89.onrender.com:5000:5000/barber/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updatedBarber, bid: selectedBarber._id, shopId })
      });

      const data = await response.json();
      if (response.ok) {
        setIsModalVisible(false);
        Alert.alert("Success", "Barber profile updated successfully!");
        fetchBarbers(shopId);
      } else {
        Alert.alert("Error", data.error || "Failed to update barber");
      }
    } catch (error) {
      console.error("Error updating barber:", error);
      Alert.alert("Error", "Could not connect to the server");
    }
  };

  const handleDeleteBarber = async () => {
    if (!shopId) {
      Alert.alert("Error", "Shop ID not found.");
      return;
    }

    try {
      const response = await fetch("https://servercheckbarber-2u89.onrender.com:5000:5000/barber/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bid: selectedBarber._id, shopId })
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", "Barber deleted successfully!");
        setIsModalVisible(false);
        fetchBarbers(shopId);
      } else {
        Alert.alert("Error", data.error || "Failed to delete barber");
      }
    } catch (error) {
      console.error("Error deleting barber:", error);
      Alert.alert("Error", "Could not connect to the server");
    }
  };

  const BarberCard = ({ barber }) => {
    const avgRating =
      barber.totalRatings > 0
        ? (barber.totalStarsEarned / barber.totalRatings).toFixed(1)
        : "0.0";
  
    return (
      <View style={styles.card}>
        <Image source={require("../image/user.png")} style={styles.image} />
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{barber.name}</Text>
          <Text style={styles.detail}>Username: {barber.email}</Text>
          <Text style={styles.detail}>Phone: {barber.phone}</Text>
          <Text style={styles.detail}>Customers Served: {barber.totalCustomersServed}</Text>
          <Text style={styles.rating}>{avgRating} ⭐ </Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            setSelectedBarber(barber);
            setUpdatedBarber({
              name: barber.name,
              email: barber.email,
              phone: barber.phone,
              password: "",
            });
            setIsModalVisible(true);
          }}
        >
          <Image
            source={require("../image/editb.png")}
            style={{ width: 25, height: 25 }}
          />
        </TouchableOpacity>
      </View>
    );
  };
  

  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  return (
    <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.overlay} />
      <View style={styles.container}>
        <Text style={styles.pageHeading}>Barbers</Text>
        <FlatList 
          data={barbers} 
          keyExtractor={(item) => item._id} 
          renderItem={({ item }) => <BarberCard barber={item} />} 
        />

        {/* Plus Button for Adding New Barber */}
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setIsAddModalVisible(true)}
        >
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>

        {/* Modal for Editing Barber */}
        <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Barber</Text>
            {['name', 'email', 'phone', 'password'].map((field) => (
              <TextInput
                key={field}
                style={styles.input}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                secureTextEntry={field === 'password'}
                value={updatedBarber[field]}
                onChangeText={(text) => setUpdatedBarber({ ...updatedBarber, [field]: text })}
              />
            ))}
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleUpdateBarber}>
                <Text style={styles.modalButtonText}>Update</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={() => setIsConfirmVisible(true)}>
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
            <Text style={styles.confirmText}>Are you sure you want to delete this barber?</Text>
            <View style={styles.confirmButtonContainer}>
              <TouchableOpacity style={styles.confirmButton} onPress={() => setIsConfirmVisible(false)}>
                <Text style={styles.confirmButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmDeleteButton]}
                onPress={() => {
                  handleDeleteBarber();
                  setIsConfirmVisible(false);
                  setIsModalVisible(false);
                }}
              >
                <Text style={styles.confirmButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

        {/* Modal for Adding New Barber */}
        <Modal visible={isAddModalVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Barber</Text>
              {['name', 'email', 'phone', 'password'].map((field) => (
                <TextInput
                  key={field}
                  style={styles.input}
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  secureTextEntry={field === 'password'}
                  value={newEmployee[field]}
                  onChangeText={(text) => setNewEmployee({ ...newEmployee, [field]: text })}
                />
              ))}
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={styles.modalButton} onPress={() => setIsAddModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleSaveEmployee}>
                  <Text style={styles.modalButtonText}>Save</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.71)',
  },
  confirmBox: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: 'rgb(0,0,0)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    margin: 5,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  confirmDeleteButton: {
    backgroundColor: 'rgb(0,0,0)',
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
    elevation: 3 
  },
  image: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    marginRight: 15 
  },
  infoContainer: { 
    flex: 1 
  },
  name: { 
    fontSize: 18, 
    fontWeight: "bold", 
    color: "#333" 
  },
  detail: { 
    fontSize: 14, 
    color: "#555", 
    marginVertical: 2 
  },
  rating: { 
    fontSize: 16, 
    fontWeight: "bold", 
    color: "#ff9900", 
    marginTop: 5 
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
    alignItems: "center"
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
    backgroundColor: "rgba(0, 0, 0, 0.5)" 
  },
  modalContent: { 
    width: "85%", 
    backgroundColor: "#fff", 
    padding: 20, 
    borderRadius: 12, 
    alignItems: "center" 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: "bold", 
    marginBottom: 15 
  },
  input: { 
    width: "100%", 
    borderWidth: 1, 
    borderColor: "#ccc", 
    borderRadius: 8, 
    padding: 10, 
    marginBottom: 10 
  },
  modalButtonContainer: { 
    flexDirection: "row", 
    justifyContent: "space-evenly", 
    width: "100%" 
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
    width: "30%"
  },
  modalButtonText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "bold" 
  },
});

export default Barber;
