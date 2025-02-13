import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Button, 
  ScrollView, 
  Alert 
} from "react-native";

export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(null);
  const [names, setNames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Base API URL
  const API_BASE = "https://barber-queue.vercel.app";

  // Function to fetch the current queue data
  const fetchQueueData = async () => {
    try {
      // Optionally set loading only for the first load; after that, queueLength is not null.
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
      // Only update loading state if this is the initial load.
      if (queueLength === null) {
        setLoading(false);
      }
    }
  };

  // Poll the API every 2 seconds
  useEffect(() => {
    fetchQueueData();
    const intervalId = setInterval(() => {
      fetchQueueData();
    }, 2000);
    return () => clearInterval(intervalId);
  }, []);

  // Handler to remove a specific person (tick button)
  const removePerson = async (personName) => {
    try {
      const response = await fetch(
        `${API_BASE}/queue?name=${encodeURIComponent(personName)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        Alert.alert("Error", "Failed to remove the person.");
      }
      await fetchQueueData();
    } catch (error) {
      console.error("Error removing person:", error);
      Alert.alert("Error", "An error occurred while removing the person.");
    }
  };

  // Handler to move a person one position down (down arrow button)
  const moveDownPerson = async (personName) => {
    try {
      const response = await fetch(`${API_BASE}/queue/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: personName }),
      });
      if (!response.ok) {
        Alert.alert("Error", "Failed to move the person down.");
      }
      await fetchQueueData();
    } catch (error) {
      console.error("Error moving person down:", error);
      Alert.alert("Error", "An error occurred while moving the person down.");
    }
  };

  // Increment the queue by adding a new dummy person.
  // The dummy person's name is appended with a number based on the count of previously added dummy persons.
  const handleIncrement = async () => {
    try {
      const dummyCount = names.filter((name) =>
        name.startsWith("Dummy Person")
      ).length;
      const newName = `Dummy Person ${dummyCount + 1}`;
      await fetch(`${API_BASE}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      await fetchQueueData();
    } catch (error) {
      console.error("Error incrementing queue:", error);
    }
  };

  // Decrement the queue by removing the person at the front.
  const handleDecrement = async () => {
    try {
      await fetch(`${API_BASE}/queue`, { method: "DELETE" });
      await fetchQueueData();
    } catch (error) {
      console.error("Error decrementing queue:", error);
    }
  };

  // Show spinner only if initial data hasn't been loaded.
  if (queueLength === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

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
            <View key={index} style={styles.personRow}>
              <Text style={styles.name}>
                {index + 1}. {name}
              </Text>
              <View style={styles.buttonGroup}>
                <View style={styles.buttonWrapper}>
                  <Button title="✓" onPress={() => removePerson(name)} />
                </View>
                {/* Show the down arrow button only for the top 3 people */}
                {index < 3 && (
                  <View style={styles.buttonWrapper}>
                    <Button title="↓" onPress={() => moveDownPerson(name)} />
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
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
    fontWeight: "bold",
  },
  queue: { 
    fontSize: 20,
    marginTop: 10,
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
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 5,
  },
  name: {
    fontSize: 16,
  },
  buttonGroup: {
    flexDirection: "row",
  },
  buttonWrapper: {
    marginHorizontal: 5,
  },
  buttonsContainer: {
    flexDirection: "row",
    marginTop: 20,
  },
});
