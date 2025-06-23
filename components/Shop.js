import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Image,
  Dimensions,
  StatusBar,
  PixelRatio,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Import useSafeAreaInsets

// Get screen dimensions for responsive styling, consistent with menu.js
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const fontScale = PixelRatio.getFontScale();

// Helper function for responsive font sizes
const getResponsiveFontSize = (size) => size / fontScale;

// Base API URL
const API_BASE = "http://10.0.2.2:5000/api";

// Define a consistent color palette with reverted colors for specific elements
const colors = {
  primary: '#3182ce', // Original primary blue
  secondary: '#63b3ed', // Original secondary blue
  background: '#f5f7fa', // Light grey background
  cardBackground: '#ffffff', // White for cards
  headerBackground: '#000000', // Reverted to black for header
  textDark: '#2d3748', // Dark text for main content
  textMedium: '#4a5568', // Medium grey text
  textLight: '#a0aec0', // Light grey text for placeholders/hints
  textSecondary: '#718096', // Muted text for meta info
  border: '#e2e8f0', // Light grey for borders
  shadow: 'rgba(0, 0, 0, 0.08)', // Soft shadow
  starActive: '#FFD700', // Gold for active stars
  starInactive: '#cbd5e0', // Light grey for inactive stars
  error: '#e53e3e', // Red for errors
  white: '#ffffff',
  red: '#dc3545', // Reverted to original red for closed strip
  lightGrey: '#f0f0f0', // Reverted to original light grey for closed card background
  bottomButton: '#000000', // Reverted to black for bottom button
};

export const ShopList = ({ onSelect, onClose }) => {
  const insets = useSafeAreaInsets(); // Get safe area insets

  const [shopRatings, setShopRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [queueCounts, setQueueCounts] = useState({}); // { [shopId]: count }
  const [sortCriteria, setSortCriteria] = useState([]);
  const [showSortOptions, setShowSortOptions] = useState(false);

  // Memoized fetchShops to prevent unnecessary re-creations
  const fetchShops = useCallback(async () => {
    setLoading(true);
    setError(""); // Clear previous errors
    try {
      const shopRes = await fetch(`${API_BASE}/shops`);
      const shopsData = await shopRes.json();

      let shops = [];
      if (shopsData && typeof shopsData === "object" && Array.isArray(shopsData.data)) {
        shops = shopsData.data;
      } else {
        console.warn("API response 'data' property is missing or not an array:", shopsData);
      }

      // Simulate distance for each shop (as there's no actual distance calculation)
      const shopsWithExtraData = shops.map((shop) => ({
        ...shop,
        distance: parseFloat((Math.random() * 10 + 0.5).toFixed(1)), // Simulate distance in km
      }));

      setShopRatings(shopsWithExtraData);
    } catch (err) {
      console.error("Error fetching shops:", err);
      setError(err.message || "Error loading shops");
      setShopRatings([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array means this function is created once

  // Memoized fetchQueueCounts for efficiency
  const fetchQueueCounts = useCallback(async (shops) => {
    const counts = {};
    await Promise.all(
      shops.map(async (shop) => {
        try {
          const res = await fetch(`${API_BASE}/queue/shop/${shop._id}`);
          const json = await res.json();
          counts[shop._id] = json.count || 0;
        } catch (err) {
          console.error(`Error fetching queue for shop ${shop._id}:`, err);
          counts[shop._id] = 0; // Default to 0 on error
        }
      })
    );
    setQueueCounts(counts);
  }, []); // Empty dependency array means this function is created once

  useEffect(() => {
    fetchShops();
    loadCurrentShop();
  }, [fetchShops]); // Dependency on fetchShops

  useEffect(() => {
    if (shopRatings.length > 0) {
      fetchQueueCounts(shopRatings);
    }
  }, [shopRatings, fetchQueueCounts]); // Dependencies on shopRatings and fetchQueueCounts

  // Loads the currently pinned shop from AsyncStorage
  const loadCurrentShop = async () => {
    try {
      const currentShopId = await AsyncStorage.getItem("pinnedShop");
      if (currentShopId) {
        setSelectedShopId(currentShopId);
      }
    } catch (err) {
      console.error("Error loading current shop:", err);
    }
  };

  // Handles selecting a shop and saving it to AsyncStorage
  const handleSelectShop = async (shopId, isOpen) => {
    if (!isOpen) {
      return; // Prevent selecting if the shop is closed
    }
    setSelectedShopId(shopId);
    console.log("Selected shop ID:", shopId);
    await AsyncStorage.setItem("pinnedShop", shopId);
    onSelect?.(shopId); // Pass the selected shop ID to the onSelect callback
  };

  // Generates a summary of active filters and sort criteria
  const getActiveFilterSummary = () => {
    const filters = [];
    if (searchQuery) {
      filters.push(`"${searchQuery}"`);
    }

    const sortSummaries = sortCriteria.map((c) => {
      const label = c.key.charAt(0).toUpperCase() + c.key.slice(1);
      const orderLabel = c.order === "asc" ? "Low to High" : "High to Low";
      return `${label} (${orderLabel})`;
    });

    let finalSummary = "";
    if (filters.length > 0) {
      finalSummary += filters.join(", ");
    }
    if (sortSummaries.length > 0) {
      if (filters.length > 0) {
        finalSummary += "; ";
      }
      finalSummary += `Sorted by: ${sortSummaries.join(", ")}`;
    }

    return finalSummary ? ` (${finalSummary})` : "";
  };

  const filterSummary = getActiveFilterSummary();

  // Clears all search queries and sort criteria
  const handleClearFilters = () => {
    setSearchQuery("");
    setSortCriteria([]);
    setShowSortOptions(false); // Close sort options dropdown
  };

  // Handles sorting based on criterion key and order (asc/desc)
  const handleSort = (criterionKey, order) => {
    setSortCriteria((prevCriteria) => {
      const existingIndex = prevCriteria.findIndex((c) => c.key === criterionKey);

      if (existingIndex !== -1) {
        const existingCriterion = prevCriteria[existingIndex];
        // If same criterion and order, remove it (toggle off)
        if (existingCriterion.order === order) {
          return prevCriteria.filter((_, i) => i !== existingIndex);
        } else {
          // If same criterion but different order, update the order
          const newCriteria = [...prevCriteria];
          newCriteria[existingIndex] = { key: criterionKey, order: order };
          return newCriteria;
        }
      } else {
        // Add new criterion
        return [...prevCriteria, { key: criterionKey, order: order }];
      }
    });
    setShowSortOptions(false); // Close sort options after selection
  };

  // Filters and sorts shops based on current search query and sort criteria
  const sortedAndFilteredShops = [...shopRatings]
    .filter((shop) => {
      return searchQuery ? shop.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    })
    .sort((a, b) => {
      // Apply multiple sort criteria in order of precedence
      for (let i = 0; i < sortCriteria.length; i++) {
        const { key, order } = sortCriteria[i];
        let comparison = 0;

        if (key === "rating") {
          comparison = a.rating - b.rating;
        } else if (key === "distance") {
          comparison = a.distance - b.distance;
        } else if (key === "queue") {
          comparison = (queueCounts[a._id] || 0) - (queueCounts[b._id] || 0);
        }

        if (order === "desc") {
          comparison = -comparison; // Reverse order for descending
        }

        if (comparison !== 0) {
          return comparison; // If a comparison is found, return it
        }
      }
      return 0; // If no criteria, or all criteria are equal, maintain original order
    });

  // Renders each shop item in the FlatList
  const renderShopItem = ({ item }) => {
    const shop = item;
    const isSelected = shop._id === selectedShopId;
    const shopRating = shop.rating || 0;
    const queueCount = queueCounts[shop._id] !== undefined ? queueCounts[shop._id] : 0;
    const isShopOpen = shop.isOpen; // Get the isOpen status

    return (
      <TouchableOpacity
        style={[
          styles.shopCard,
          isSelected && styles.selectedShopCard, // Apply selected style if current shop is pinned
          !isShopOpen && styles.closedShopCard, // Apply closed style if shop is closed
        ]}
        onPress={() => handleSelectShop(shop._id, isShopOpen)} // Pass isOpen to handler
        activeOpacity={isShopOpen ? 0.7 : 1} // Reduce opacity slightly on press only if open
        disabled={!isShopOpen} // Disable touch if shop is closed
      >
        <View style={styles.shopImageContainer}>
          {/* Using a placeholder image with random ID for variety */}
          <Image
            source={{ uri: `https://picsum.photos/300/300?random=${shop._id}` }}
            style={styles.shopImage}
          />
          {isSelected && (
            <View style={styles.selectedBadge}>
              <FontAwesome5 name="check" size={getResponsiveFontSize(12)} color={colors.white} />
            </View>
          )}
          {!isShopOpen && (
            <View style={styles.closedOverlay}>
              <Text style={styles.closedText}>CLOSED</Text>
            </View>
          )}
        </View>

        <View style={styles.shopDetails}>
          <Text style={styles.shopName} numberOfLines={1}>
            {shop.name}
          </Text>

          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {/* Render 5 star icons based on shop rating */}
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                  key={star}
                  name="star"
                  size={getResponsiveFontSize(14)}
                  color={star <= Math.round(shopRating) ? colors.starActive : colors.starInactive}
                  style={{ marginRight: screenWidth * 0.005 }} // Responsive margin
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{shopRating.toFixed(1)}</Text>
          </View>

          <View style={styles.shopMeta}>
            <View style={styles.metaItem}>
              <FontAwesome5 name="map-marker-alt" size={getResponsiveFontSize(12)} color={colors.textSecondary} />
              <Text style={styles.metaText}>{shop.distance.toFixed(1)} km</Text>
            </View>
            <View style={styles.metaItem}>
              <FontAwesome5 name="clock" size={getResponsiveFontSize(12)} color={colors.textSecondary} />
              <Text style={styles.metaText}>{isShopOpen ? "Open" : "Closed"}</Text>
            </View>
            <View style={styles.metaItem}>
              <FontAwesome5 name="users" size={getResponsiveFontSize(12)} color={colors.textSecondary} />
              <Text style={styles.metaText}>Queue: {queueCount}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Display loading indicator while data is being fetched
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading shops...</Text>
      </View>
    );
  }

  // Display error message if fetching data fails
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-circle" size={getResponsiveFontSize(40)} color={colors.error} />
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchShops}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate the approximate height of the bottom button container to add padding to FlatList
  const bottomButtonHeight = screenHeight * 0.02 + screenHeight * 0.018 * 2 + (Platform.OS === 'ios' ? insets.bottom : screenHeight * 0.02);
  const extraPadding = bottomButtonHeight + screenHeight * 0.03; // Add some extra margin

  return (
    <View style={styles.container}>
      {/* App Header (Numbr title) */}
      <View style={[styles.headerApp, { paddingTop: insets.top }]}>
        <Text style={styles.titleApp}>Numbr</Text>
      </View>
      {/* StatusBar for iOS/Android */}
      <StatusBar backgroundColor={colors.headerBackground} barStyle="light-content" />

      {/* Main Header for Shop List (Search, Sort, Clear) */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { flexShrink: 1 }]}>Shops</Text>
          <View style={styles.headerActions}>
            {/* Sort By Button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowSortOptions(!showSortOptions)}
            >
              <FontAwesome5 name="sort" size={getResponsiveFontSize(18)} color={colors.textDark} />
              <Text style={styles.actionButtonText}>Sort By</Text>
              <Icon
                name={showSortOptions ? "chevron-up" : "chevron-down"}
                size={getResponsiveFontSize(16)}
                color={colors.textDark}
                style={styles.actionButtonIcon}
              />
            </TouchableOpacity>
            {/* Clear All Filters Button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleClearFilters}
            >
              <Text style={styles.actionButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={getResponsiveFontSize(18)} color={colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search shops by name..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            // Clear search query button
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }} // Increase touchable area
            >
              <Icon name="times-circle" size={getResponsiveFontSize(18)} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Summary Display */}
      <View style={styles.controlsContainer}>
        {filterSummary ? (
          <Text style={styles.filterSummaryText}>{filterSummary}</Text>
        ) : null}
      </View>

      {/* FlatList for displaying shops */}
      {/* TouchableWithoutFeedback to close sort options when tapping outside */}
      <TouchableWithoutFeedback onPress={() => setShowSortOptions(false)}>
        <View style={{ flex: 1 }}>
          <FlatList
            data={sortedAndFilteredShops}
            renderItem={renderShopItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={[styles.shopList, { paddingBottom: extraPadding }]} // Added extra padding
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              // Component to show when no shops are found
              <View style={styles.emptyContainer}>
                <FontAwesome5 name="search" size={getResponsiveFontSize(50)} color={colors.textLight} />
                <Text style={styles.emptyText}>No shops found matching your criteria</Text>
              </View>
            }
          />
        </View>
      </TouchableWithoutFeedback>

      {/* Sort Options Dropdown */}
      {showSortOptions && (
        <View style={styles.sortOptionsDropdown}>
          <Text style={styles.dropdownHeader}>Rating</Text>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort("rating", "desc")}>
            <Text style={styles.sortOptionText}>High to Low</Text>
            {/* Checkmark if this option is currently selected */}
            {sortCriteria.some((c) => c.key === "rating" && c.order === "desc") && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort("rating", "asc")}>
            <Text style={styles.sortOptionText}>Low to High</Text>
            {sortCriteria.some((c) => c.key === "rating" && c.order === "asc") && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
          <View style={styles.sortOptionDivider} />

          <Text style={styles.dropdownHeader}>Distance</Text>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort("distance", "asc")}>
            <Text style={styles.sortOptionText}>Low to High</Text>
            {sortCriteria.some((c) => c.key === "distance" && c.order === "asc") && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort("distance", "desc")}>
            <Text style={styles.sortOptionText}>High to Low</Text>
            {sortCriteria.some((c) => c.key === "distance" && c.order === "desc") && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
          <View style={styles.sortOptionDivider} />

          <Text style={styles.dropdownHeader}>Queue</Text>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort("queue", "asc")}>
            <Text style={styles.sortOptionText}>Low to High</Text>
            {sortCriteria.some((c) => c.key === "queue" && c.order === "asc") && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort("queue", "desc")}>
            <Text style={styles.sortOptionText}>High to Low</Text>
            {sortCriteria.some((c) => c.key === "queue" && c.order === "desc") && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
        </View>
      )}

      {/* "Back to Home" button, visible if onClose prop is provided */}
      {onClose && (
        <View style={[styles.bottomButtonContainer, { paddingBottom: insets.bottom }]}>
          <TouchableOpacity
            style={styles.bottomCloseButton}
            onPress={onClose}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Text style={styles.bottomCloseButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Stylesheet using screen dimensions for responsive layout, consistent with menu.js
const styles = StyleSheet.create({
  headerApp: {
    backgroundColor: colors.headerBackground, // Original black
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: screenWidth * 0.042,
    // paddingTop handled by useSafeAreaInsets directly on the element
  },
  titleApp: {
    color: colors.white,
    fontSize: getResponsiveFontSize(24),
    fontWeight: 'bold',
    paddingVertical: screenHeight * 0.02, // Consistent padding for title
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: screenHeight * 0.02,
    fontSize: getResponsiveFontSize(16),
    color: colors.textMedium,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: screenWidth * 0.06,
    backgroundColor: colors.background,
  },
  errorText: {
    marginTop: screenHeight * 0.02,
    fontSize: getResponsiveFontSize(16),
    color: colors.textMedium,
    textAlign: "center",
    lineHeight: getResponsiveFontSize(24), // Using responsive font size for line height
    fontWeight: "500",
  },
  retryButton: {
    marginTop: screenHeight * 0.03,
    paddingVertical: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.06,
    backgroundColor: colors.primary,
    borderRadius: 8,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: getResponsiveFontSize(16),
    fontWeight: "600",
  },
  header: {
    backgroundColor: colors.cardBackground,
    paddingTop: screenHeight * 0.02,
    paddingBottom: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.04,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.001 },
    shadowOpacity: 0.05,
    shadowRadius: screenWidth * 0.005,
    elevation: 2,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: screenHeight * 0.015,
  },
  title: {
    fontSize: getResponsiveFontSize(22),
    fontWeight: "700",
    color: colors.textDark,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: screenWidth * 0.025, // Increased gap for better spacing on smaller screens
  },
  closeButton: {
    padding: screenWidth * 0.02,
    borderRadius: 50,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: screenWidth * 0.04,
    height: screenHeight * 0.06,
    marginBottom: screenHeight * 0.01,
    borderWidth: 1, // Added border for better input field visibility
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: screenWidth * 0.03,
    color: colors.textSecondary,
  },
  searchInput: {
    flex: 1,
    fontSize: getResponsiveFontSize(16),
    color: colors.textDark,
    paddingVertical: 0, // Ensure no extra padding for text input
  },
  controlsContainer: {
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.01,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.001 },
    shadowOpacity: 0.1,
    shadowRadius: screenWidth * 0.005,
    elevation: 3,
    zIndex: 9,
    position: 'relative',
    alignItems: 'flex-end',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: screenWidth * 0.025,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: screenHeight * 0.008,
    paddingHorizontal: screenWidth * 0.025,
    borderRadius: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.002 },
    shadowOpacity: 0.15,
    shadowRadius: screenWidth * 0.0075,
    elevation: 4,
    minWidth: screenWidth * 0.25, // Ensure buttons don't get too small
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '600',
    color: colors.textDark,
    marginLeft: screenWidth * 0.01,
  },
  actionButtonIcon: {
    marginLeft: screenWidth * 0.01,
  },
  filterSummaryText: {
    fontSize: getResponsiveFontSize(14),
    color: colors.textSecondary,
    textAlign: 'right',
    paddingHorizontal: screenWidth * 0.012,
  },
  sortOptionsDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? insets.top + (screenHeight * 0.10) + (screenHeight * 0.02) : (screenHeight * 0.10) + (screenHeight * 0.02), // Adjusted dynamic top position
    right: screenWidth * 0.04,
    width: screenWidth * 0.65, // Slightly wider for better readability
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.004 },
    shadowOpacity: 0.25,
    shadowRadius: screenWidth * 0.015,
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: screenHeight * 0.01,
    zIndex: 100,
  },
  dropdownHeader: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '700',
    color: colors.textMedium,
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.008,
    backgroundColor: colors.background,
    borderRadius: 5,
    marginHorizontal: screenWidth * 0.02,
    marginBottom: screenHeight * 0.005,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: screenHeight * 0.012,
    paddingHorizontal: screenWidth * 0.04,
  },
  sortOptionText: {
    fontSize: getResponsiveFontSize(15),
    color: colors.textDark,
    fontWeight: '500',
  },
  sortOptionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: screenHeight * 0.005,
    marginHorizontal: screenWidth * 0.02,
  },
  shopList: {
    paddingHorizontal: screenWidth * 0.04,
    paddingTop: screenHeight * 0.015,
    // paddingBottom will be dynamically set by 'extraPadding'
  },
  shopCard: {
    backgroundColor: colors.cardBackground,
    width: '100%',
    marginBottom: screenHeight * 0.02,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4, // Slightly increased elevation for more pop
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.003 }, // Adjusted shadow for depth
    shadowOpacity: 0.15,
    shadowRadius: screenWidth * 0.015,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedShopCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOpacity: 0.3, // Increased shadow for selected card
    shadowRadius: screenWidth * 0.025, // Increased shadow radius
  },
  closedShopCard: {
    backgroundColor: colors.lightGrey,
    borderColor: colors.lightGrey,
    opacity: 0.8, // Slightly dim the closed card
  },
  shopImageContainer: {
    position: "relative",
    width: "100%",
    height: screenWidth * 0.32,
  },
  shopImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  selectedBadge: {
    position: "absolute",
    top: screenHeight * 0.01,
    right: screenWidth * 0.02,
    backgroundColor: colors.primary,
    width: screenWidth * 0.07, // Slightly larger badge
    height: screenWidth * 0.07,
    borderRadius: screenWidth * 0.035, // Adjusted for new size
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.001 },
    shadowOpacity: 0.2,
    shadowRadius: screenWidth * 0.005,
  },
  closedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker overlay for better contrast
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedText: {
    color: colors.red,
    fontSize: getResponsiveFontSize(26), // Slightly larger text
    fontWeight: 'bold',
    backgroundColor: colors.white,
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.01,
    borderRadius: 8,
    overflow: 'hidden',
    transform: [{ rotate: '-15deg' }],
  },
  shopDetails: {
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.015, // Increased vertical padding
  },
  shopName: {
    fontSize: getResponsiveFontSize(20), // Slightly larger font for name
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: screenHeight * 0.008, // Adjusted margin
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: screenHeight * 0.015,
  },
  starsContainer: {
    flexDirection: "row",
    marginRight: screenWidth * 0.02,
  },
  ratingText: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: "600",
    color: colors.textMedium,
  },
  shopMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: 'wrap',
    gap: screenWidth * 0.025, // Increased gap
    marginTop: screenHeight * 0.005, // Added a small top margin
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    paddingVertical: screenHeight * 0.007, // Slightly more vertical padding
    paddingHorizontal: screenWidth * 0.025, // Slightly more horizontal padding
    borderRadius: 8,
  },
  metaText: {
    fontSize: getResponsiveFontSize(14),
    color: colors.textSecondary,
    marginLeft: screenWidth * 0.015,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    padding: screenWidth * 0.10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: screenHeight * 0.4, // Ensure it takes up sufficient space
  },
  emptyText: {
    marginTop: screenHeight * 0.02,
    fontSize: getResponsiveFontSize(16),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: getResponsiveFontSize(24),
    fontWeight: "500",
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0, // Align to bottom, safe area handled by paddingBottom
    width: '100%',
    paddingHorizontal: screenWidth * 0.04,
    zIndex: 200,
    paddingTop: screenHeight * 0.02, // Add some padding above the button
    backgroundColor: colors.background, // Match background to blend
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bottomCloseButton: {
    backgroundColor: colors.bottomButton, // Reverted to black for the button
    paddingVertical: screenHeight * 0.02, // Reverted to original padding for button
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.004 },
    shadowOpacity: 0.3,
    shadowRadius: screenWidth * 0.015,
    elevation: 10,
  },
  bottomCloseButtonText: {
    color: colors.white,
    fontSize: getResponsiveFontSize(18),
    fontWeight: '700',
  },
});