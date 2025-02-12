// app/(tabs)/menu.js
import { View, Text, StyleSheet } from "react-native";

export default function MenuScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current Queue</Text>
      <Text style={styles.queue}>👤👤👤 3 People Waiting</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  title: { 
    fontSize: 24, 
    fontWeight: "bold" 
  },
  queue: { 
    fontSize: 20, 
    marginTop: 10 
  },
});
