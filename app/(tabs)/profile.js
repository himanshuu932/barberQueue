// app/(tabs)/profile.js
import { View, Text, StyleSheet } from "react-native";

export default function TabProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>
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
});
