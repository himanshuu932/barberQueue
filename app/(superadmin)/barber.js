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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const Barber = () => {
  // State for barbers list
  const [barbers, setBarbers] = useState([]);

  // State for Add Employee Modal and new employee details
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    profilePic: null,
  });

  // Fetch barbers from the backend
  useEffect(() => {
    const fetchBarbers = async () => {
      try {
        const response = await fetch("https://barber-24143206157.asia-south2.run.app/barbers");
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
    fetchBarbers();
  }, []);

  // Handle opening the Add Employee modal
  const handleAddEmployee = () => {
    setIsModalVisible(true);
  };

  // Handle saving a new barber
  const handleSaveEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.password || !newEmployee.phone) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }

    try {
      const response = await fetch("https://barber-24143206157.asia-south2.run.app/barber/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newEmployee.name,
          email: newEmployee.email,
          phone: newEmployee.phone,
          password: newEmployee.password,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setNewEmployee({ name: "", email: "", password: "", phone: "", profilePic: null });
        setIsModalVisible(false);
        Alert.alert("Success", "Employee added successfully!");
        // Refresh the barbers list
        const updatedResponse = await fetch("https://barber-24143206157.asia-south2.run.app/barbers");
        const updatedData = await updatedResponse.json();
        if (updatedResponse.ok) {
          setBarbers(updatedData);
        }
      } else {
        Alert.alert("Error", data.error || "Failed to add employee");
      }
    } catch (error) {
      console.error("Error adding employee:", error);
      Alert.alert("Error", "Could not connect to the server");
    }
  };

  // Barber Card Component
  const BarberCard = ({ barber }) => {
    const avgRating = barber.totalRatings > 0
      ? (barber.totalStarsEarned / barber.totalRatings).toFixed(1)
      : "0.0";

    return (
      <View style={styles.card}>
        <Image source={{ uri: barber.profilePic || "https://via.placeholder.com/100" }} style={styles.image} />
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{barber.name}</Text>
          <Text style={styles.detail}>Email: {barber.email}</Text>
          <Text style={styles.detail}>Phone: {barber.phone}</Text>
          <Text style={styles.detail}>Customers Served: {barber.totalCustomersServed}</Text>
          <Text style={styles.rating}>⭐ {avgRating}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Meet Our Barbers</Text>
      <FlatList
        data={barbers}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <BarberCard barber={item} />}
      />

      {/* Add Employee Button */}
      <TouchableOpacity style={styles.buttonContainer} onPress={handleAddEmployee}>
        <LinearGradient colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} style={styles.button}>
          <Text style={styles.buttonText}>Add Employee</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Employee Modal */}
      <Modal visible={isModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Employee</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={newEmployee.name}
              onChangeText={(text) => setNewEmployee({ ...newEmployee, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={newEmployee.email}
              onChangeText={(text) => setNewEmployee({ ...newEmployee, email: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={newEmployee.password}
              onChangeText={(text) => setNewEmployee({ ...newEmployee, password: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={newEmployee.phone}
              onChangeText={(text) => setNewEmployee({ ...newEmployee, phone: text })}
            />
            <TouchableOpacity style={styles.modalButton} onPress={handleSaveEmployee}>
              <Text style={styles.modalButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  // Barber List Styles
  container: {
    flex: 1,
    backgroundColor: "#f4f4f4",
    padding: 10,
  },
  heading: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 10,
    color: "#333",
  },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    marginVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 50,
    marginRight: 15,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
  },
  detail: {
    fontSize: 14,
    color: "#555",
    marginTop: 3,
  },
  rating: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 5,
    color: "#ff9900",
  },

  // Add Employee Button Styles
  buttonContainer: {
    width: "90%",
    marginBottom: 10,
    alignSelf: "center",
  },
  button: {
    padding: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  modalButton: {
    backgroundColor: "#3a3a3a",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 10,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default Barber;