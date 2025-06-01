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
    if (onShopSelected) {
      // Execute the callback passed from MenuScreen
      // This will update the pinnedShop in MenuScreen's state and AsyncStorage
      await onShopSelected(shopId);
    }
    router.back(); // Use expo-router's router.back() to go to the previous screen
  };

  const handleClose = () => {
    router.back(); // Go back without selecting a shop
  };

  return (
    <View style={styles.container}>
      {/* Optional: Adjust StatusBar for a full-screen appearance */}
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <ShopList onSelect={handleShopSelect} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa', // Match the background of ShopList for a seamless transition
  },
});
