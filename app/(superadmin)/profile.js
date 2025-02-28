import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { MaterialIcons, FontAwesome } from "@expo/vector-icons";

export default function TabProfileScreen({ navigation }) {
  const router = useRouter();
  const shineAnimation = useRef(new Animated.Value(0)).current;
  const [employees, setEmployees] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    password: "",
    mobile: "",
    profilePic: null,
  });

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shineAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shineAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Load employees from AsyncStorage
    loadEmployees();
  }, [shineAnimation]);

  const shineTranslateX = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 900],
  });

  const shineTranslateY = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 250],
  });

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("userToken");
      await AsyncStorage.removeItem("userType");
      router.replace("../login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const loadEmployees = async () => {
    try {
      const storedEmployees = await AsyncStorage.getItem("employees");
      if (storedEmployees) {
        setEmployees(JSON.parse(storedEmployees));
      }
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const saveEmployees = async (updatedEmployees) => {
    try {
      await AsyncStorage.setItem("employees", JSON.stringify(updatedEmployees));
    } catch (error) {
      console.error("Error saving employees:", error);
    }
  };

  const handleAddEmployee = () => {
    setIsModalVisible(true);
  };

  const handleSaveEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.password || !newEmployee.mobile) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }

    const updatedEmployees = [...employees, newEmployee];
    setEmployees(updatedEmployees);
    await saveEmployees(updatedEmployees);

    setIsModalVisible(false);
    setNewEmployee({ name: "", email: "", password: "", mobile: "", profilePic: null });
  };

  const handleRemoveEmployee = async (index) => {
    const updatedEmployees = employees.filter((_, i) => i !== index);
    setEmployees(updatedEmployees);
    await saveEmployees(updatedEmployees);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Sorry, we need camera roll permissions to upload images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setNewEmployee({ ...newEmployee, profilePic: result.assets[0].uri });
    }
  };

  return (
    <View style={styles.container}>
      {/* Profile Section */}
      <View style={styles.profileBox}>
        <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
          <Animated.View
            style={[
              styles.shine,
              {
                transform: [
                  { translateX: shineTranslateX },
                  { translateY: shineTranslateY },
                  { rotate: "45deg" },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={["transparent", "rgba(255, 255, 255, 0.3)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shineGradient}
            />
          </Animated.View>

          <View style={styles.profileContent}>
            <Image source={{ uri: "https://via.placeholder.com/80" }} style={styles.profileImage} />
            <View>
              <Text style={styles.username}>John Doe</Text>
              <Text style={styles.userInfo}>+1 234 567 8900</Text>
              <Text style={styles.userInfo}>user@example.com</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Add Employee Button */}
      <TouchableOpacity style={styles.buttonContainer} onPress={handleAddEmployee}>
        <LinearGradient colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} style={styles.button}>
          <Text style={styles.buttonText}>Add Employee</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Employee List */}
      <ScrollView style={styles.employeeList}>
        {employees.map((employee, index) => (
          <View key={index} style={styles.employeeCard}>
            <View style={styles.employeeCardHeader}>
              <TouchableOpacity onPress={() => pickImage()}>
                <View style={styles.profilePicContainer}>
                  <Image
                    source={{ uri: employee.profilePic || "https://via.placeholder.com/80" }}
                    style={styles.employeeProfilePic}
                  />
                  <View style={styles.cameraIconContainer}>
                    {employee.profilePic ? (
                      <FontAwesome name="edit" size={16} color="#fff" />
                    ) : (
                      <MaterialIcons name="camera-alt" size={20} color="#fff" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
              <View style={styles.employeeDetails}>
                <Text style={styles.employeeName}>{employee.name}</Text>
                <Text style={styles.employeeEmail}>{employee.email}</Text>
                <Text style={styles.employeeMobile}>{employee.mobile}</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveEmployee(index)}>
                <MaterialIcons name="delete" size={24} color="red" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Logout Button */}
      <TouchableOpacity style={styles.buttonContainer} onPress={handleLogout}>
        <LinearGradient colors={["#3a3a3a", "#1a1a1a", "#0d0d0d"]} style={styles.button}>
          <Text style={styles.buttonText}>Logout</Text>
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
              placeholder="Mobile Number"
              value={newEmployee.mobile}
              onChangeText={(text) => setNewEmployee({ ...newEmployee, mobile: text })}
            />
            <TouchableOpacity style={styles.modalButton} onPress={handleSaveEmployee}>
              <Text style={styles.modalButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButton} onPress={() => setIsModalVisible(false)}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", padding: 20, backgroundColor: "#fff" },
  profileBox: { width: "100%", height: 150, borderRadius: 10, overflow: "hidden", marginBottom: 20 },
  profileBackground: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  shine: { position: "absolute", top: 0, left: 0, width: 300, height: "300%" },
  shineGradient: { width: "100%", height: "100%" },
  profileContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  profileImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: "#fff", marginRight: 15 },
  username: { fontSize: 22, fontWeight: "900", color: "#fff" },
  userInfo: { fontSize: 16, fontWeight: "bold", color: "#fff", marginTop: 2 },
  buttonContainer: { width: "90%", marginBottom: 10 },
  button: { padding: 12, alignItems: "center", borderRadius: 8 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  employeeList: { width: "100%", marginBottom: 10 },
  employeeCard: {
    padding: 15,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  employeeCardHeader: { flexDirection: "row", alignItems: "center" },
  profilePicContainer: { position: "relative" },
  employeeProfilePic: { width: 60, height: 60, borderRadius: 30, marginRight: 15 },
  cameraIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 10,
    backgroundColor: "#3a3a3a",
    borderRadius: 15,
    padding: 5,
  },
  employeeDetails: { flex: 1 },
  employeeName: { fontSize: 18, fontWeight: "bold", color: "#333" },
  employeeEmail: { fontSize: 14, color: "#666", marginTop: 5 },
  employeeMobile: { fontSize: 14, color: "#666", marginTop: 5 },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  modalContent: { width: "80%", backgroundColor: "#fff", padding: 20, borderRadius: 10 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 5, padding: 10, marginBottom: 15 },
  modalButton: { backgroundColor: "#3a3a3a", padding: 10, borderRadius: 5, alignItems: "center", marginBottom: 10 },
  modalButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});