import React from "react";
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons"; // Importing the icon

const barbers = [
  {
    id: "1",
    name: "John Doe",
    experience: "10 Years",
    specialization: "Fade & Beard Styling",
    rating: "4.8",
    image: "https://via.placeholder.com/100",
  },
  {
    id: "2",
    name: "Mike Smith",
    experience: "8 Years",
    specialization: "Classic Cuts & Trims",
    rating: "4.6",
    image: "https://via.placeholder.com/100",
  },
  {
    id: "3",
    name: "Sarah Johnson",
    experience: "12 Years",
    specialization: "Modern Hairstyles & Beard Trimming",
    rating: "4.9",
    image: "https://via.placeholder.com/100",
  },
];

const BarberCard = ({ barber }) => (
  <View style={styles.card}>
    <Image source={{ uri: barber.image }} style={styles.image} />
    <View style={styles.infoContainer}>
      <Text style={styles.name}>{barber.name}</Text>
      <Text style={styles.detail}>Experience: {barber.experience}</Text>
      <Text style={styles.detail}>Specialization: {barber.specialization}</Text>
      <Text style={styles.rating}>⭐ {barber.rating}</Text>
    </View>
  </View>
);

const barber = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Meet Our Barbers</Text>
      <FlatList
        data={barbers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BarberCard barber={item} />}
      />

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => alert("Add new barber!")}>
        <Icon name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
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
  // FAB Styling
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#007bff",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5, // Shadow effect for Android
    shadowColor: "#000", // Shadow effect for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default barber;
