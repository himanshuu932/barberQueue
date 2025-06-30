import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from "expo-location";

// Get screen dimensions for responsive styling, consistent with menu.js
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const fontScale = PixelRatio.getFontScale();

// Helper function for responsive font sizes
const getResponsiveFontSize = (size) => size / fontScale;

// Base API URL
const API_BASE = "https://numbr-exq6.onrender.com/api";

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
  const insets = useSafeAreaInsets();

  const [shopRatings, setShopRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [queueCounts, setQueueCounts] = useState({});
  const [sortCriteria, setSortCriteria] = useState([]);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // Helper: convert degrees to radians.
  const toRad = (value) => (value * Math.PI) / 180;

  // Helper: calculate haversine distance (in km) between two coordinates.
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Request permission and get current user location
  const requestLocationPermissionAndSetLocation = useCallback(async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setError("Permission to access location was denied. Distance calculation will not be available.");
      Alert.alert(
        "Location Permission Denied",
        "Permission to access your location was denied. We cannot calculate distances to shops without this. Please enable it in your device settings.",
        [{ text: "OK" }]
      );
      return null;
    }
    try {
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation(location.coords);
      return location.coords;
    } catch (locError) {
      console.error("Error fetching current location:", locError);
      setError("Could not fetch your current location. Distance calculation will not be available.");
      Alert.alert("Location Error", "Failed to get your current location. Please check your GPS settings.", [{ text: "OK" }]);
      return null;
    }
  }, []);

  // Memoized fetchShops to prevent unnecessary re-creations
  const fetchShops = useCallback(async (currentUserLocation) => {
    setLoading(true);
    setError("");
    try {
      const shopRes = await fetch(`${API_BASE}/shops`);
      const shopsData = await shopRes.json();

      let shops = [];
      if (shopsData && typeof shopsData === "object" && Array.isArray(shopsData.data)) {
        shops = shopsData.data;
      } else {
        console.warn("API response 'data' property is missing or not an array:", shopsData);
      }
      
      const shopsWithExtraData = shops.map((shop) => {
        let distance = null;
        if (currentUserLocation && shop.address && shop.address.coordinates && shop.address.coordinates.coordinates && shop.address.coordinates.coordinates.length === 2) {
          // Backend provides [longitude, latitude], need to swap for calculateDistance which expects (lat, lon)
          const [shopLongitude, shopLatitude] = shop.address.coordinates.coordinates;
          distance = calculateDistance(
            currentUserLocation.latitude,
            currentUserLocation.longitude,
            shopLatitude,
            shopLongitude
          );
        }
        return {
          ...shop,
          distance: distance !== null ? parseFloat(distance.toFixed(1)) : null, // Assign calculated distance or null
        };
      });

      setShopRatings(shopsWithExtraData);
    } catch (err) {
      console.error("Error fetching shops:", err);
      setError(err.message || "Error loading shops");
      setShopRatings([]);
    } finally {
      setLoading(false);
    }
  }, [calculateDistance]);

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
          counts[shop._id] = 0;
        }
      })
    );
    setQueueCounts(counts);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const locationCoords = await requestLocationPermissionAndSetLocation();
      await fetchShops(locationCoords);
      loadCurrentShop();
    };
    initialize();
  }, [fetchShops, requestLocationPermissionAndSetLocation]);

  useEffect(() => {
    if (shopRatings.length > 0) {
      fetchQueueCounts(shopRatings);
    }
  }, [shopRatings, fetchQueueCounts]);

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

  const handleSelectShop = async (shopId, isOpen) => {
    if (!isOpen) {
      return;
    }
    setSelectedShopId(shopId);
    await AsyncStorage.setItem("pinnedShop", shopId);
    onSelect?.(shopId);
  };

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

  const handleClearFilters = () => {
    setSearchQuery("");
    setSortCriteria([]);
    setShowSortOptions(false);
  };

  const handleSort = (criterionKey, order) => {
    setSortCriteria((prevCriteria) => {
      const existingIndex = prevCriteria.findIndex((c) => c.key === criterionKey);

      if (existingIndex !== -1) {
        const existingCriterion = prevCriteria[existingIndex];
        if (existingCriterion.order === order) {
          return prevCriteria.filter((_, i) => i !== existingIndex);
        } else {
          const newCriteria = [...prevCriteria];
          newCriteria[existingIndex] = { key: criterionKey, order: order };
          return newCriteria;
        }
      } else {
        return [...prevCriteria, { key: criterionKey, order: order }];
      }
    });
    setShowSortOptions(false);
  };

  const sortedAndFilteredShops = [...shopRatings]
    .filter((shop) => {
      return searchQuery ? shop.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    })
    .sort((a, b) => {
      for (let i = 0; i < sortCriteria.length; i++) {
        const { key, order } = sortCriteria[i];
        let comparison = 0;

        if (key === "rating") {
          comparison = a.rating - b.rating;
        } else if (key === "distance") {
          // Handle null distances by pushing them to the end
          if (a.distance === null && b.distance === null) comparison = 0;
          else if (a.distance === null) comparison = 1; // a comes after b
          else if (b.distance === null) comparison = -1; // a comes before b
          else comparison = a.distance - b.distance;
        } else if (key === "queue") {
          comparison = (queueCounts[a._id] || 0) - (queueCounts[b._id] || 0);
        }

        if (order === "desc") {
          comparison = -comparison;
        }

        if (comparison !== 0) {
          return comparison;
        }
      }
      return 0;
    });

  // Image Carousel Component
  const ImageCarousel = ({ photos }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef(null);

    useEffect(() => {
      if (photos && photos.length > 1) {
        const interval = setInterval(() => {
          setActiveIndex((prevIndex) => {
            const nextIndex = (prevIndex + 1) % photos.length;
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
            return nextIndex;
          });
        }, 3000); // Change image every 3 seconds

        return () => clearInterval(interval);
      }
    }, [photos]);

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index);
      }
    }, []);

    const viewabilityConfig = {
      itemVisiblePercentThreshold: 50,
    };

    if (!photos || photos.length === 0) {
      // Fallback to a placeholder if no photos are available
      return (
        <Image
          source={{ uri: `https://picsum.photos/300/300?random=${Math.random()}` }}
          style={styles.shopImage}
        />
      );
    }

    return (
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => item.public_id || index.toString()}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item.url }}
              style={styles.carouselImage}
            />
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
        {photos.length > 1 && (
          <View style={styles.paginationDots}>
            {photos.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === activeIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderShopItem = ({ item }) => {
    const shop = item;
    const isSelected = shop._id === selectedShopId;
    const shopRating = shop.rating || 0;
    const queueCount = queueCounts[shop._id] !== undefined ? queueCounts[shop._id] : 0;
    const isShopOpen = shop.isOpen;

    return (
      <TouchableOpacity
        style={[
          styles.shopCard,
          isSelected && styles.selectedShopCard,
          !isShopOpen && styles.closedShopCard,
        ]}
        onPress={() => handleSelectShop(shop._id, isShopOpen)}
        activeOpacity={isShopOpen ? 0.7 : 1}
        disabled={!isShopOpen}
      >
        <View style={styles.shopImageContainer}>
          <ImageCarousel photos={shop.photos} />
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
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                  key={star}
                  name="star"
                  size={getResponsiveFontSize(14)}
                  color={star <= Math.round(shopRating) ? colors.starActive : colors.starInactive}
                  style={{ marginRight: screenWidth * 0.005 }}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{shopRating.toFixed(1)}</Text>
          </View>

          <View style={styles.shopMeta}>
            <View style={styles.metaItem}>
              <FontAwesome5 name="map-marker-alt" size={getResponsiveFontSize(12)} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                {shop.distance !== null ? `${shop.distance.toFixed(1)} km` : "N/A km"}
              </Text>
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading shops...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-circle" size={getResponsiveFontSize(40)} color={colors.error} />
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => {
          setError(""); // Clear error before retrying
          requestLocationPermissionAndSetLocation().then(fetchShops); // Re-fetch location and then shops
        }}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bottomButtonHeight = screenHeight * 0.02 + screenHeight * 0.018 * 2 + (Platform.OS === 'ios' ? insets.bottom : screenHeight * 0.02);
  const extraPadding = bottomButtonHeight + screenHeight * 0.03;

  return (
    <View style={styles.container}>
      <View style={styles.headerApp}>
        <Text style={styles.titleApp}>Numbr</Text>
      </View>
      <StatusBar backgroundColor={colors.headerBackground} barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { flexShrink: 1 }]}>Shops</Text>
          <View style={styles.headerActions}>
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
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleClearFilters}
            >
              <Text style={styles.actionButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </View>

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
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Icon name="times-circle" size={getResponsiveFontSize(18)} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.controlsContainer}>
        {filterSummary ? (
          <Text style={styles.filterSummaryText}>{filterSummary}</Text>
        ) : null}
      </View>

      {/* Only overlay when sort menu is open */}
      {showSortOptions && (
        <TouchableWithoutFeedback onPress={() => setShowSortOptions(false)}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      )}

      <FlatList
        data={sortedAndFilteredShops}
        renderItem={renderShopItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[styles.shopList, { paddingBottom: extraPadding }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="search" size={getResponsiveFontSize(50)} color={colors.textLight} />
            <Text style={styles.emptyText}>No shops found matching your criteria</Text>
          </View>
        }
        // You might need to implement getItemLayout for better FlatList performance
        // getItemLayout={(data, index) => (
        //   { length: YOUR_ITEM_HEIGHT + YOUR_ITEM_MARGIN_BOTTOM, offset: (YOUR_ITEM_HEIGHT + YOUR_ITEM_MARGIN_BOTTOM) * index, index }
        // )}
        // Add nestedScrollEnabled if you have nested scrollables
        // nestedScrollEnabled={true}
      />

      {showSortOptions && (
        <View style={styles.sortOptionsDropdown}>
          <Text style={styles.dropdownHeader}>Rating</Text>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort("rating", "desc")}>
            <Text style={styles.sortOptionText}>High to Low</Text>
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

      {onClose && (
        <View style={[styles.bottomButtonContainer, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
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

const styles = StyleSheet.create({
  headerApp: {
    backgroundColor: colors.headerBackground,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: screenWidth * 0.042,
    height: screenHeight * 0.06,
    paddingTop : screenHeight * 0.01
  },
  titleApp: {
    color: colors.white,
    fontSize: screenWidth * 0.055,
    // fontWeight: 'bold',
    marginLeft: screenWidth * 0.042,
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
    lineHeight: getResponsiveFontSize(24),
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
    gap: screenWidth * 0.025,
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
    borderWidth: 1,
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
    paddingVertical: 0,
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
    minWidth: screenWidth * 0.25,
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
    top: Platform.OS === 'ios' ? insets.top + (screenHeight * 0.10) + (screenHeight * 0.02) : (screenHeight * 0.10) + (screenHeight * 0.02),
    right: screenWidth * 0.04,
    width: screenWidth * 0.65,
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
  },
  shopCard: {
    backgroundColor: colors.cardBackground,
    width: '100%',
    marginBottom: screenHeight * 0.02,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.003 },
    shadowOpacity: 0.15,
    shadowRadius: screenWidth * 0.015,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedShopCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: screenWidth * 0.025,
  },
  closedShopCard: {
    backgroundColor: colors.lightGrey,
    borderColor: colors.lightGrey,
    opacity: 0.8,
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
  carouselContainer: {
    width: "100%",
    height: "100%",
    position: 'relative',
  },
  carouselImage: {
    width: screenWidth - (screenWidth * 0.08), // Adjust for horizontal padding of FlatList
    height: "100%",
    resizeMode: "cover",
  },
  paginationDots: {
    position: 'absolute',
    bottom: screenHeight * 0.01,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: screenWidth * 0.02,
    height: screenWidth * 0.02,
    borderRadius: screenWidth * 0.01,
    marginHorizontal: screenWidth * 0.005,
  },
  activeDot: {
    backgroundColor: colors.white,
  },
  inactiveDot: {
    backgroundColor: colors.textLight,
    opacity: 0.5,
  },
  selectedBadge: {
    position: "absolute",
    top: screenHeight * 0.01,
    right: screenWidth * 0.02,
    backgroundColor: colors.primary,
    width: screenWidth * 0.07,
    height: screenWidth * 0.07,
    borderRadius: screenWidth * 0.035,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.001 },
    shadowOpacity: 0.2,
    shadowRadius: screenWidth * 0.005,
    zIndex: 1,
  },
  closedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closedText: {
    color: colors.red,
    fontSize: getResponsiveFontSize(26),
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
    paddingVertical: screenHeight * 0.015,
  },
  shopName: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: screenHeight * 0.008,
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
    gap: screenWidth * 0.025,
    marginTop: screenHeight * 0.005,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    paddingVertical: screenHeight * 0.007,
    paddingHorizontal: screenWidth * 0.025,
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
    minHeight: screenHeight * 0.4,
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
    bottom: 0,
    width: '100%',
    paddingHorizontal: screenWidth * 0.04,
    zIndex: 200,
    paddingTop: screenHeight * 0.015,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bottomCloseButton: {
    backgroundColor: colors.bottomButton,
    paddingVertical: screenHeight * 0.02,
    bottom: screenHeight * 0.005,
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