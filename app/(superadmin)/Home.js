import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { LinearGradient } from "expo-linear-gradient";
import Icon from 'react-native-vector-icons/FontAwesome';


const Home = () => {
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  const employees = [
    {
      name: 'John Doe',
      profilePic: 'https://via.placeholder.com/150',
      customersServed: 12,
      earnings: 600,
      rating: 4.8,
      history: [
        { customerName: 'Alice', services: [{ name: 'Haircut', cost: 50 }, { name: 'Beard Trim', cost: 20 }], rating: 5 },
        { customerName: 'Bob', services: [{ name: 'Shave', cost: 30 }], rating: 4 },
        { customerName: 'Charlie', services: [{ name: 'Haircut', cost: 50 }, { name: 'Hair Color', cost: 80 }], rating: 4.5 },
        { customerName: 'David', services: [{ name: 'Haircut', cost: 50 }], rating: 4.8 },
        { customerName: 'Eve', services: [{ name: 'Hair Color', cost: 80 }, { name: 'Beard Trim', cost: 20 }], rating: 4.7 },
        { customerName: 'Frank', services: [{ name: 'Haircut', cost: 50 }, { name: 'Beard Trim', cost: 20 }], rating: 5 },
        { customerName: 'Grace', services: [{ name: 'Shave', cost: 30 }], rating: 4 },
        { customerName: 'Hank', services: [{ name: 'Haircut', cost: 50 }, { name: 'Hair Color', cost: 80 }], rating: 4.5 },
      ],
    },
    {
      name: 'Jane Smith',
      profilePic: 'https://via.placeholder.com/150',
      customersServed: 10,
      earnings: 500,
      rating: 4.7,
      history: [
        { customerName: 'Ivy', services: [{ name: 'Haircut', cost: 50 }], rating: 4.8 },
        { customerName: 'Jack', services: [{ name: 'Hair Color', cost: 80 }, { name: 'Beard Trim', cost: 20 },{ name: 'Hair Color', cost: 80 }, { name: 'Beard Trim', cost: 20 }], rating: 4.7 },
        { customerName: 'Kara', services: [{ name: 'Haircut', cost: 50 }, { name: 'Beard Trim', cost: 20 }], rating: 5 },
        { customerName: 'Leo', services: [{ name: 'Shave', cost: 30 }], rating: 4 },
        { customerName: 'Mona', services: [{ name: 'Haircut', cost: 50 }, { name: 'Hair Color', cost: 80 }], rating: 4.5 },
        { customerName: 'Nina', services: [{ name: 'Haircut', cost: 50 }, { name: 'Beard Trim', cost: 20 }], rating: 5 },
        { customerName: 'Oscar', services: [{ name: 'Shave', cost: 30 }], rating: 4 },
        { customerName: 'Paul', services: [{ name: 'Haircut', cost: 50 }, { name: 'Hair Color', cost: 80 }], rating: 4.5 },
      ],
    },
  ];

  const toggleExpand = (index) => {
    if (expandedEmployee === index) {
      setExpandedEmployee(null); // Shrink the card
    } else {
      setExpandedEmployee(index); // Expand the card
    }
  };

  const renderHistoryCard = ({ item }) => {
    const totalCost = item.services.reduce((sum, service) => sum + service.cost, 0);
    return (
      <View>
        <Text style={styles.historyCardTitle}>Customer: {item.customerName}</Text>
        {item.services.map((service, serviceIndex) => (
          <Text key={serviceIndex} style={styles.historyCardText}>
            - {service.name}: ${service.cost}
          </Text>
        ))}
        <Text style={styles.historyCardTotal}>Total Cost: ${totalCost}</Text>
        <Text style={styles.historyCardRating}>Rating: {item.rating}</Text>
      </View>
    );
  };
  
  

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false} 
      contentContainerStyle={{ flexGrow: 1 }} 
      nestedScrollEnabled={true}  
      keyboardShouldPersistTaps="handled"
    >
      {/* Small Cards Section */}
      <View style={styles.smallCardsContainer}>
        {[
          { title: "Today's Earnings", value: "$1,200", iconName: "money", colors: ['#6a11cb', '#2575fc'] },
          { title: "Total Today's Customers", value: "24", iconName: "users", colors: ['#ff7e5f', '#feb47b'] },
          { title: "Popular Service", value: "Haircut", iconName: "scissors", colors: ['#4c669f', '#3b5998'] },
          { title: "Top Employee", value: "John Doe", iconName: "star", colors: ['#30cfd0', '#330867'] }
        ].map((item, index) => (
          <LinearGradient key={index} colors={item.colors} style={styles.smallCard}>
            <Icon name={item.iconName} size={24} color="#fff" />
            <Text style={styles.smallCardTitle}>{item.title}</Text>
            <Text style={styles.smallCardValue}>{item.value}</Text>
          </LinearGradient>
        ))}
      </View>
  
      {/* Employee Cards Section */}
      <Text style={styles.employeeHeading}>Employee Performance</Text>
      <View style={styles.employeeCardsContainer}>
        {employees.map((employee, index) => (
          <View key={index}>
            <TouchableOpacity onPress={() => toggleExpand(index)}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.employeeCard}
              >
                <Image source={{ uri: employee.profilePic }} style={styles.employeeImage} />
                <View style={styles.employeeDetails}>
                  <Text style={styles.employeeName}>{employee.name}</Text>
                  <Text style={styles.employeeStat}>Customers Served: {employee.customersServed}</Text>
                  <Text style={styles.employeeStat}>Earnings: ${employee.earnings}</Text>
                  <View style={styles.ratingContainer}>
                    <Icon name="star" size={16} color="#FFD700" />
                    <Text style={styles.employeeRating}>{employee.rating}</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
  
            {/* Expanded Section (Using ScrollView Instead of FlatList) */}
            {expandedEmployee === index && (
              <View style={styles.expandedSection}>
                <Text style={styles.serviceHistoryTitle}>Service History</Text>
                <ScrollView 
                  contentContainerStyle={styles.historyGrid} 
                  nestedScrollEnabled={true} 
                  style={{ maxHeight: 340 }} 
                  showsVerticalScrollIndicator={false}
                >
                  {employee.history.map((item, i) => (
                    <View key={i} style={styles.historyCard}>
                      {renderHistoryCard({ item })}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
  
  
  
  
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 14,
  },
  smallCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  smallCard: {
    width: '48%',
    aspectRatio: 1,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  smallCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  smallCardValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  employeeHeading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  employeeCardsContainer: {
    marginTop: 0,
  },
  employeeCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  employeeImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  employeeDetails: {
    flex: 1,
  },
  employeeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  employeeStat: {
    fontSize: 16,
    color: '#eee',
    marginTop: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  employeeRating: {
    fontSize: 16,
    color: '#FFD700',
    marginLeft: 4,
  },
  expandedSection: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 10,
    marginTop: 10,  // Ensures space between employee card and expanded section
    marginBottom: 20, // Adds spacing to prevent touching next card
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    maxHeight: 400, // Keeps history section within two rows
  },
  
  historyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 5, // Keeps content aligned properly
    gap: 10, // Adds spacing between cards
  },
  
  historyCard: {
    width: '48%', // Ensures two cards per row
    backgroundColor: '#fff', 
    borderRadius: 12,
    padding: 10, // Adjusted padding for better content spacing
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 10, // Ensures spacing between rows
  },
  
  historyCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  
  historyCardText: {
    fontSize: 12,
    color: '#34495e',
    marginBottom: 2,
  },
  
  historyCardTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27ae60',
    marginTop: 6,
  },
  
  historyCardRating: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f39c12',
    marginTop: 4,
  },
  
  
  serviceHistoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgb(255, 255, 255)', // Ensure visibility against dark background
    textAlign: 'center',
    marginBottom: 10,
  },
  

});

export default Home;