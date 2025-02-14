import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  TouchableOpacity,
  Animated
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";

export default function MenuScreen() {
  const [queueLength, setQueueLength] = useState(null);
  const [names, setNames] = useState([]);
  const API_BASE = "https://barber-queue.vercel.app";
  const shineAnimation = useRef(new Animated.Value(0)).current;

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
  }, [shineAnimation]);

  const shineTranslateX = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 900],
  });

  const shineTranslateY = shineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 250],
  });

  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${API_BASE}/queue`);
      const data = await response.json();
      setQueueLength(data.queueLength);
      setNames(data.names);
    } catch (error) {
      console.error("Error fetching queue data:", error);
    }
  };

  useEffect(() => {
    fetchQueueData();
    const intervalId = setInterval(fetchQueueData, 2000);
    return () => clearInterval(intervalId);
  }, []);

  const removePerson = async (name) => {
    await fetch(`${API_BASE}/queue?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    fetchQueueData();
  };

  const moveDownPerson = async (name) => {
    await fetch(`${API_BASE}/queue/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    fetchQueueData();
  };

  const handleIncrement = async () => {
    const newName = `Dummy Person ${names.length + 1}`;
    await fetch(`${API_BASE}/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    fetchQueueData();
  };

  const handleDecrement = async () => {
    await fetch(`${API_BASE}/queue`, { method: "DELETE" });
    fetchQueueData();
  };

  if (queueLength === null) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>  
      <View style={styles.queueBox}>
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
          <View style={styles.queueContent}>
            <Text style={styles.title}>Current Queue</Text>
            <Text style={styles.queueText}>👤 {queueLength} {queueLength === 1 ? "Person" : "People"} Waiting</Text>
          </View>
        </LinearGradient>
      </View>
      
      <Text style={styles.listTitle}>Queue List</Text>
      {/* Only the List Scrolls */}
        <ScrollView style={styles.listScroll} nestedScrollEnabled={true} 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 10 }}>
          {names.map((name, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.name}>{index + 1}. {name}</Text>
              <View style={styles.iconGroup}>
                {index < 3 ? (
                  <TouchableOpacity onPress={() => removePerson(name)}>
                    <Icon name="check-circle" size={24} color="green" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => removePerson(name)}>
                    <Icon name="delete" size={24} color="red" />
                  </TouchableOpacity>
                )}
                {index < 3 && (
                  <TouchableOpacity onPress={() => moveDownPerson(name)}>
                    <Icon name="arrow-downward" size={24} color="blue" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
  
      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.fab} onPress={handleIncrement}>
          <Icon name="add" size={30} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: "center", padding: 20 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  queueBox: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
  },
  
  listScroll: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    padding: 10,
    maxHeight: "72%",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },  // Prevents outer scroll
  },
  
  
  profileBackground: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 300,
    height: "300%",
  },
  shineGradient: {
    width: "100%",
    height: "100%",
  },
  queueContent: {
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  queueText: { fontSize: 18, marginTop: 5, color: "#fff" },
  listBox: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  listTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderRadius: 8,
    marginVertical: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  name: { fontSize: 16 },
  iconGroup: { flexDirection: "row", gap: 10 },
  buttonsContainer: {
    position: "absolute",
    bottom: "10%", // Adjust as needed
    right: 25,  // Adjust as needed
    flexDirection: "row",
    gap: 10, 
  },
  fab: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 50,
    marginHorizontal: 10,
    elevation: 3,
  },
});