import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ShopList } from '../../components/Shop'; // Assuming ShopList is in components/Shop.js
import { useNavigation, useRoute } from '@react-navigation/native';

/**
 * ShopSelectionScreen component.
 * This component acts as a wrapper for the ShopList, allowing it to be displayed as a full screen
 * within the navigation stack instead of a modal.
 */
export default function ShopSelectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  // Extract the onShopSelected callback from route params
  const { onShopSelected } = route.params || {};

  /**
   * Handles the selection of a shop from the ShopList.
   * Calls the onShopSelected callback passed from the previous screen (MenuScreen)
   * and then navigates back.
   * @param {string} shopId The ID of the selected shop.
   */
  const handleShopSelect = async (shopId) => {
    if (onShopSelected) {
      await onShopSelected(shopId);
    }
    navigation.goBack(); // Go back to the previous screen (MenuScreen)
  };

  /**
   * Handles closing the shop selection screen without making a selection.
   * Navigates back to the previous screen.
   */
  const handleClose = () => {
    navigation.goBack(); // Go back without selecting a shop
  };

  return (
    <View style={styles.container}>
      {/* Render the ShopList component, passing the new handlers */}
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
