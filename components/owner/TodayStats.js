import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const TodayStats = ({ stats }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Today's Stats</Text>
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Icon name="rupee" size={screenWidth * 0.06} color="#28A745" />
          <Text style={styles.statValue}>₹{stats.earnings}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="users" size={screenWidth * 0.06} color="#007BFF" />
          <Text style={styles.statValue}>{stats.customers}</Text>
          <Text style={styles.statLabel}>Customers</Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Icon name="star" size={screenWidth * 0.06} color="#FFC107" />
          <Text style={styles.statValue}>{stats.popularService}</Text>
          <Text style={styles.statLabel}>Popular Service</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="user" size={screenWidth * 0.06} color="#17A2B8" />
          <Text style={styles.statValue}>{stats.topEmployee}</Text>
          <Text style={styles.statLabel}>Top Employee</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: screenWidth * 0.04,
    padding: screenWidth * 0.03,
    marginBottom: screenHeight * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: screenHeight * 0.004 },
    shadowOpacity: 0.08,
    shadowRadius: screenWidth * 0.02,
    elevation: 5,
  },
  cardTitle: {
    fontSize: screenWidth * 0.055,
    fontWeight: '700',
    color: '#333',
    paddingLeft: screenWidth * 0.03,
    paddingTop: screenHeight * 0.01,
    marginBottom: screenHeight * 0.01,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: screenHeight * 0.02,
  },
  statItem: {
    alignItems: 'center',
    padding: screenWidth * 0.05,
    backgroundColor: '#F7F7F7',
    borderRadius: screenWidth * 0.04,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: screenHeight * 0.002 },
    shadowOpacity: 0.05,
    shadowRadius: screenWidth * 0.01,
    elevation: 3,
  },
  statValue: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#1A2A3A',
    marginVertical: screenHeight * 0.01,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: screenWidth * 0.04,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default TodayStats;