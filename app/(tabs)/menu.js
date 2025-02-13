import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";

export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(null);
  const [names, setNames] = useState([]);
  const [loading, setLoading] = useState(true); // Only used for the initial load

  // Base API URL
  const API_BASE = "https://barber-queue.vercel.app";

  const fetchQueueData = async () => {
    try {
      // Only show the spinner on the initial fetch (when no data is available)
      if (queueLength === null) {
        setLoading(true);
      }
      const response = await fetch(`${API_BASE}/queue`);
      const data = await response.json();
      setQueueLength(data.queueLength);
      setNames(data.names);
    } catch (error) {
      console.error("Error fetching queue data:", error);
    } finally {
      // After the first successful fetch, hide the spinner
      if (queueLength === null) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Fetch immediately on component mount
    fetchQueueData();

    // Set up polling every 5 seconds
    const intervalId = setInterval(() => {
      fetchQueueData();
    }, 2000);

    // Clean up the interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // If there's no data yet, show the spinner
  if (queueLength === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  // Otherwise, always show the current queue data (which updates in the background)
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Current Queue</Text>
      <Text style={styles.queue}>
        👤 {queueLength} {queueLength === 1 ? "Person" : "People"} Waiting
      </Text>
      {names.length > 0 && (
        <View style={styles.namesContainer}>
          <Text style={styles.namesTitle}>Queue List:</Text>
          {names.map((name, index) => (
            <Text key={index} style={styles.name}>
              {name}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 20,
  },
  title: { 
    fontSize: 24, 
    fontWeight: "bold" 
  },
  queue: { 
    fontSize: 20, 
    marginTop: 10 
  },
  namesContainer: {
    marginTop: 20,
    width: "100%",
    paddingHorizontal: 20,
  },
  namesTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  name: {
    fontSize: 16,
    marginVertical: 2,
  },
});
