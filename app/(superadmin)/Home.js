import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";

const Home = () => {
  const [overallRating, setOverallRating] = useState({
    average: 4.7,
    totalRatings: 137056,
    totalReviews: 4966,
    starCounts: {
      5: 96424,
      4: 24082,
      3: 7601,
      2: 3113,
      1: 5836,
    },
  });

  const employees = [
    {
      name: "John Doe",
      profilePic: "https://via.placeholder.com/150",
      rating: 4.8,
      reviews: 120,
    },
    {
      name: "Jane Smith",
      profilePic: "https://via.placeholder.com/150",
      rating: 4.7,
      reviews: 95,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer} // Apply alignItems here
      nestedScrollEnabled={true}
      keyboardShouldPersistTaps="handled"
    >
      {/* Small Cards Section */}
      <View style={styles.smallCardsContainer}>
        {[
          {
            title: "Today's Earnings",
            value: "$1,200",
            iconName: "money",
            colors: ["#6a11cb", "#2575fc"],
          },
          {
            title: "Total Today's Customers",
            value: "24",
            iconName: "users",
            colors: ["#ff7e5f", "#feb47b"],
          },
          {
            title: "Popular Service",
            value: "Haircut",
            iconName: "scissors",
            colors: ["#4c669f", "#3b5998"],
          },
          {
            title: "Top Employee",
            value: "John Doe",
            iconName: "star",
            colors: ["#30cfd0", "#330867"],
          },
        ].map((item, index) => (
          <LinearGradient key={index} colors={item.colors} style={styles.smallCard}>
            <Icon name={item.iconName} size={24} color="#fff" />
            <Text style={styles.smallCardTitle}>{item.title}</Text>
            <Text style={styles.smallCardValue}>{item.value}</Text>
          </LinearGradient>
        ))}
      </View>

      {/* Overall Shop Rating Section */}
      <View style={styles.ratingSection}>
        <Text style={styles.sectionTitle}>Overall Shop Rating</Text>
        <View style={styles.overallRatingContainer}>
          <Text style={styles.averageRating}>{overallRating.average} ★</Text>
          <Text style={styles.totalRatings}>
            {overallRating.totalRatings.toLocaleString()} Ratings &{" "}
            {overallRating.totalReviews.toLocaleString()} Reviews
          </Text>
          <View style={styles.starDistribution}>
            {[5, 4, 3, 2, 1].map((star) => (
              <View key={star} style={styles.starRow}>
                <Text style={styles.starLabel}>{star} ★</Text>
                <View style={styles.starBarContainer}>
                  <View
                    style={[
                      styles.starBar,
                      {
                        width: `${(overallRating.starCounts[star] / overallRating.totalRatings) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.starCount}>
                  {overallRating.starCounts[star].toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Per Employee Ratings Section */}
      <View style={styles.employeeRatingsSection}>
        <Text style={styles.sectionTitle}>Employee Ratings</Text>
        {employees.map((employee, index) => (
          <View key={index} style={styles.employeeRatingCard}>
            <Image
              source={{ uri: employee.profilePic }}
              style={styles.employeeProfilePic}
            />
            <View style={styles.employeeRatingDetails}>
              <Text style={styles.employeeName}>{employee.name}</Text>
              <View style={styles.employeeRatingRow}>
                <Text style={styles.employeeRating}>{employee.rating} ★</Text>
                <Text style={styles.employeeReviews}>
                  ({employee.reviews} Reviews)
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    alignItems: "center", // Moved alignItems here
    padding: 20,
  },
  smallCardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  smallCard: {
    width: "48%",
    aspectRatio: 1,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  smallCardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8,
    textAlign: "center",
  },
  smallCardValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  ratingSection: {
    width: "100%",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  overallRatingContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  averageRating: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
  },
  totalRatings: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  starDistribution: {
    width: "100%",
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  starLabel: {
    fontSize: 14,
    color: "#333",
    width: 40,
  },
  starBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginHorizontal: 8,
  },
  starBar: {
    height: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 4,
  },
  starCount: {
    fontSize: 14,
    color: "#333",
    width: 60,
    textAlign: "right",
  },
  employeeRatingsSection: {
    width: "100%",
    marginBottom: 20,
  },
  employeeRatingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  employeeProfilePic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  employeeRatingDetails: {
    flex: 1,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  employeeRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  employeeRating: {
    fontSize: 16,
    color: "#FFD700",
    marginRight: 8,
  },
  employeeReviews: {
    fontSize: 14,
    color: "#666",
  },
});

export default Home;