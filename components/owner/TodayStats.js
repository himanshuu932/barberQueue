// FileName: TodayStats.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const TodayStats = ({ stats }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Today's Stats</Text>
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Icon name="dollar" size={24} color="#28A745" />
          <Text style={styles.statValue}>${stats.earnings}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="users" size={24} color="#007BFF" />
          <Text style={styles.statValue}>{stats.customers}</Text>
          <Text style={styles.statLabel}>Customers</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    paddingLeft: 10,
    paddingTop: 5,
    marginBottom: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  statItem: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F7F7F7',
    borderRadius: 15,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A2A3A',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});

export default TodayStats;