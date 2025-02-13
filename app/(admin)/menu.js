// app/(tabs)/menu.js
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Button, ScrollView } from "react-native";

export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(null);
  const [names, setNames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Use the special IP for Android emulator (or your computer's IP address if testing on a device)
  const API_BASE = "https://barber-queue.vercel.app";

  const fetchQueueData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/queue`);
      const data = await response.json();
      setQueueLength(data.queueLength);
      setNames(data.names);
    } catch (error) {
      console.error("Error fetching queue data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Increment the queue by adding a new person.
  const handleIncrement = async () => {
    try {
      setLoading(true);
      await fetch(`${API_BASE}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Dummy Person" }),
      });
      await fetchQueueData();
    } catch (error) {
      console.error("Error incrementing queue:", error);
    }
  };

  // Decrement the queue by removing a person.
  const handleDecrement = async () => {
    try {
      setLoading(true);
      await fetch(`${API_BASE}/queue`, { method: "DELETE" });
      await fetchQueueData();
    } catch (error) {
      console.error("Error decrementing queue:", error);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Current Queue</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <>
          <Text style={styles.queue}>
            👤 {queueLength} {queueLength === 1 ? "Person" : "People"} Waiting
          </Text>
          {names.length > 0 && (
            <View style={styles.namesContainer}>
              <Text style={styles.namesTitle}>Queue List:</Text>
              {names.map((name, index) => (
                <Text key={index} style={styles.name}>{name}</Text>
              ))}
            </View>
          )}
        </>
      )}
      <View style={styles.buttonsContainer}>
        <View style={styles.buttonWrapper}>
          <Button title="+" onPress={handleIncrement} />
        </View>
        <View style={styles.buttonWrapper}>
          <Button title="–" onPress={handleDecrement} />
        </View>
      </View>
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
  buttonsContainer: {
    flexDirection: "row",
    marginTop: 20,
  },
  buttonWrapper: {
    marginHorizontal: 10,
  },
});
