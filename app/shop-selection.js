import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { ShopList } from '../components/Shop'; // <--- Adjust this path if Shop.js is in a different location relative to app/
import { useLocalSearchParams, router } from 'expo-router'; // <--- Import expo-router's hooks

/**
 * ShopSelectionScreen component for expo-router.
 * This screen displays the ShopList and handles shop selection,
 * then navigates back to the previous screen.
 */
export default function ShopSelectionScreen() {
  // useLocalSearchParams() is expo-router's way to get route params
  const params = useLocalSearchParams();
  const { onShopSelected } = params; // Get the callback function passed from the previous screen

  const handleShopSelect = async (shopId) => {
    try{
      if (!shopId) {
        console.warn("No shop ID provided");
        return;
      }
   // console.log("Selected shop ID1:", shopId); // Log the selected shop ID
    if (onShopSelected) {
      await onShopSelected(shopId);
    }
 //   console.log("moving=================================:"); // Log again after the callback
     router.navigate('./(tabs)/menu');  // Use expo-router's router.back() to go to the previous screen
  }
  catch (error) {
    console.error("Error selecting shop:", error);
  }
  };

  const handleClose = () => {
    router.navigate('./(tabs)/menu'); 
  };

  return (
    <View style={styles.container}>
      
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <ShopList onSelect={handleShopSelect} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa', 
  },
});
