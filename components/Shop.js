import React, { useState, useEffect } from "react";
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
  TouchableWithoutFeedback, // Import TouchableWithoutFeedback
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");
const fontScale = PixelRatio.getFontScale();
const getResponsiveFontSize = (size) => size / fontScale;

const responsiveHeight = (h) => height * (h / 100);
const responsiveWidth = (w) => width * (w / 100);

export const ShopList = ({ onSelect, onClose }) => {
  const [shopRatings, setShopRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [selectedShopId, setSelectedShopId] = useState(null);

  const [sortCriteria, setSortCriteria] = useState([]); // [{ key: 'rating', order: 'desc' }, { key: 'queue', order: 'asc' }]
  const [showSortOptions, setShowSortOptions] = useState(false); // Controls visibility of the sort dropdown

  useEffect(() => {
    fetchShops();
    loadCurrentShop();
  }, []);

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

  const fetchShops = async () => {
    try {
      const shopRes = await fetch("https://numbr-p7zc.onrender.com/api/shops");
      const shopsData = await shopRes.json();
      const shops = shopsData.data;

      if (!Array.isArray(shops)) {
        throw new Error("API did not return a list of shops.");
      }

      const shopsWithExtraData = shops.map(shop => ({
        ...shop,
        queueLength: Math.floor(Math.random() * 16), // Simulate queue length
        distance: parseFloat((Math.random() * 10 + 0.5).toFixed(1)), // Simulate distance in km
      }));

      setShopRatings(shopsWithExtraData);
    } catch (err) {
      setError(err.message || "Error loading shops");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShop = async (shopId) => {
    setSelectedShopId(shopId);
    console.log("Selected shop ID:", shopId);
    await AsyncStorage.setItem("pinnedShop", shopId);
    onSelect?.();
  };

  const getActiveFilterSummary = () => {
    const filters = [];
    if (searchQuery) {
      filters.push(`"${searchQuery}"`);
    }

    const sortSummaries = sortCriteria.map(c => {
      const label = c.key.charAt(0).toUpperCase() + c.key.slice(1);
      const orderLabel = c.order === 'asc' ? 'Low to High' : 'High to Low';
      return `${label} (${orderLabel})`;
    });

    let finalSummary = '';
    if (filters.length > 0) {
      finalSummary += filters.join(", ");
    }
    if (sortSummaries.length > 0) {
      if (filters.length > 0) {
        finalSummary += '; ';
      }
      finalSummary += `Sorted by: ${sortSummaries.join(', ')}`;
    }

    return finalSummary ? ` (${finalSummary})` : '';
  };

  const filterSummary = getActiveFilterSummary();

  const handleClearFilters = () => {
    setSearchQuery("");
    setSortCriteria([]);
    setShowSortOptions(false); // Close sort dropdown
  };

  const handleSort = (criterionKey, order) => {
    setSortCriteria(prevCriteria => {
      const existingIndex = prevCriteria.findIndex(c => c.key === criterionKey);

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
    setShowSortOptions(false); // Close sort options after selection
  };

  const sortedAndFilteredShops = [...shopRatings].filter((shop) => {
    return searchQuery ? shop.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
  }).sort((a, b) => {
    for (let i = 0; i < sortCriteria.length; i++) {
      const { key, order } = sortCriteria[i];
      let comparison = 0;

      if (key === 'rating') {
        comparison = a.rating - b.rating;
      } else if (key === 'distance') {
        comparison = a.distance - b.distance;
      } else if (key === 'queue') {
        comparison = a.queueLength - b.queueLength;
      }

      if (order === 'desc') {
        comparison = -comparison;
      }

      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  });

  const renderShopItem = ({ item }) => {
    const shop = item;
    const isSelected = shop._id === selectedShopId;
    const shopRating = shop.rating || 0;

    return (
      <TouchableOpacity
        style={[
          styles.shopCard,
          isSelected && styles.selectedShopCard
        ]}
        onPress={() => handleSelectShop(shop._id)}
        activeOpacity={0.7}
      >
        <View style={styles.shopImageContainer}>
          <Image
            source={{ uri: `https://picsum.photos/300/300?random=${shop._id}` }}
            style={styles.shopImage}
          />
          {isSelected && (
            <View style={styles.selectedBadge}>
              <FontAwesome5 name="check" size={getResponsiveFontSize(12)} color={colors.white} />
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
                  style={{ marginRight: responsiveWidth(0.5) }}
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
              <Text style={styles.metaText}>Open</Text>
            </View>
            {shop.queueLength !== undefined && (
              <View style={styles.metaItem}>
                <FontAwesome5 name="users" size={getResponsiveFontSize(12)} color={colors.textSecondary} />
                <Text style={styles.metaText}>Queue: {shop.queueLength}</Text>
              </View>
            )}
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
        <TouchableOpacity style={styles.retryButton} onPress={fetchShops}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerApp}>
        <Text style={styles.titleApp}>Numbr</Text>
      </View>
      <StatusBar backgroundColor={colors.headerBackground} barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { flexShrink: 1 }]}>Shops</Text> {/* Added flexShrink */}
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
            {/* Clear All Button */}
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

      {/* Filter Summary - remains in its current position */}
      <View style={styles.controlsContainer}>
        {filterSummary ? (
          <Text style={styles.filterSummaryText}>{filterSummary}</Text>
        ) : null}
      </View>

      {/* Main content area wrapped by TouchableWithoutFeedback */}
      <TouchableWithoutFeedback onPress={() => setShowSortOptions(false)}>
        <View style={{ flex: 1 }}>
          <FlatList
            data={sortedAndFilteredShops}
            renderItem={renderShopItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.shopList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome5 name="search" size={getResponsiveFontSize(50)} color={colors.textLight} />
                <Text style={styles.emptyText}>No shops found matching your criteria</Text>
              </View>
            }
          />
        </View>
      </TouchableWithoutFeedback>

      {/* Sort Options Dropdown - positioned absolutely on top of everything */}
      {showSortOptions && (
        <View style={styles.sortOptionsDropdown}>
          <Text style={styles.dropdownHeader}>Rating</Text>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort('rating', 'desc')}>
            <Text style={styles.sortOptionText}>High to Low</Text>
            {sortCriteria.some(c => c.key === 'rating' && c.order === 'desc') && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort('rating', 'asc')}>
            <Text style={styles.sortOptionText}>Low to High</Text>
            {sortCriteria.some(c => c.key === 'rating' && c.order === 'asc') && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
          <View style={styles.sortOptionDivider} />

          <Text style={styles.dropdownHeader}>Distance</Text>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort('distance', 'asc')}>
            <Text style={styles.sortOptionText}>Low to High</Text>
            {sortCriteria.some(c => c.key === 'distance' && c.order === 'asc') && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort('distance', 'desc')}>
            <Text style={styles.sortOptionText}>High to Low</Text>
            {sortCriteria.some(c => c.key === 'distance' && c.order === 'desc') && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
          <View style={styles.sortOptionDivider} />

          <Text style={styles.dropdownHeader}>Queue</Text>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort('queue', 'asc')}>
            <Text style={styles.sortOptionText}>Low to High</Text>
            {sortCriteria.some(c => c.key === 'queue' && c.order === 'asc') && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortOption} onPress={() => handleSort('queue', 'desc')}>
            <Text style={styles.sortOptionText}>High to Low</Text>
            {sortCriteria.some(c => c.key === 'queue' && c.order === 'desc') && <Icon name="check" size={getResponsiveFontSize(14)} color={colors.primary} />}
          </TouchableOpacity>
        </View>
      )}

      {/* Close Button - positioned at the bottom center */}
      {onClose && (
        <View style={styles.bottomButtonContainer}> {/* Added a container for padding */}
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

const colors = {
  primary: '#3182ce', // A vibrant blue
  secondary: '#63b3ed', // Lighter blue
  background: '#f5f7fa', // Light grey background
  cardBackground: '#ffffff', // White cards
  headerBackground: '#000000', // Black for app name
  textDark: '#2d3748', // Dark grey for main text
  textMedium: '#4a5568', // Medium grey for labels
  textLight: '#a0aec0', // Light grey for placeholders and empty states
  textSecondary: '#718096', // Muted grey for meta info
  border: '#e2e8f0', // Light border
  shadow: 'rgba(0, 0, 0, 0.08)', // Soft shadow
  starActive: '#FFD700', // Gold
  starInactive: '#cbd5e0', // Lighter grey for inactive stars
  switchInactive: '#cbd5e0',
  switchThumbInactive: '#f8f9fa',
  error: '#e53e3e', // Red for errors
  clearButton: '#000000', // Black for clear action
  white: '#ffffff',
};

const styles = StyleSheet.create({
  headerApp: {
    height: responsiveHeight(9),
    backgroundColor: "black",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(4),
    width: '100%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.4) },
    shadowOpacity: 0.2,
    shadowRadius: responsiveWidth(1.2),
    elevation: 8,
  },
  titleApp: {
    color: "#fff",
    fontSize: getResponsiveFontSize(20),
    marginLeft: responsiveWidth(4),
    marginTop: responsiveHeight(2),
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
    marginTop: responsiveHeight(2),
    fontSize: getResponsiveFontSize(16),
    color: colors.textMedium,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: responsiveWidth(6),
    backgroundColor: colors.background,
  },
  errorText: {
    marginTop: responsiveHeight(2),
    fontSize: getResponsiveFontSize(16),
    color: colors.textMedium,
    textAlign: "center",
    lineHeight: responsiveHeight(3),
    fontWeight: "500",
  },
  retryButton: {
    marginTop: responsiveHeight(3),
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(6),
    backgroundColor: colors.primary,
    borderRadius: 8,
    elevation: 2,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: getResponsiveFontSize(16),
    fontWeight: "600",
  },
  header: {
    backgroundColor: colors.cardBackground,
    paddingTop: responsiveHeight(2),
    paddingBottom: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.1) },
    shadowOpacity: 0.05,
    shadowRadius: responsiveWidth(0.5),
    elevation: 2,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: responsiveHeight(1.5),
  },
  title: {
    fontSize: getResponsiveFontSize(22),
    fontWeight: "700",
    color: colors.textDark,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5, // Reduced gap between buttons
  },
  closeButton: { // This style is no longer used for the close button in the header
    padding: responsiveWidth(2),
    borderRadius: 50,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: responsiveWidth(4),
    height: responsiveHeight(6),
    marginBottom: responsiveHeight(1),
  },
  searchIcon: {
    marginRight: responsiveWidth(3),
    color: colors.textSecondary,
  },
  searchInput: {
    flex: 1,
    fontSize: getResponsiveFontSize(16),
    color: colors.textDark,
    paddingVertical: 0,
  },
  controlsContainer: {
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(1),
    backgroundColor: colors.cardBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.1) },
    shadowOpacity: 0.1,
    shadowRadius: responsiveWidth(0.5),
    elevation: 3,
    zIndex: 9,
    position: 'relative',
    alignItems: 'flex-end', // Align summary text to the right
  },
  buttonsRow: { // This style is now used for the buttons in the headerActions
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveWidth(2.5),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: responsiveHeight(0.8), // Reduced vertical padding
    paddingHorizontal: 10, // Reduced horizontal padding
    borderRadius: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.2) },
    shadowOpacity: 0.15,
    shadowRadius: responsiveWidth(0.75),
    elevation: 4,
  },
  actionButtonText: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '600',
    color: colors.textDark,
    marginLeft: 4, // Reduced margin left
  },
  actionButtonIcon: {
    marginLeft: 4, // Reduced margin left
  },
  filterSummaryText: {
    fontSize: getResponsiveFontSize(14),
    color: colors.textSecondary,
    textAlign: 'right',
    paddingHorizontal: responsiveWidth(1.2),
  },
  sortOptionsDropdown: {
    position: 'absolute',
    top: responsiveHeight(6),
    right: responsiveWidth(4),
    width: responsiveWidth(60),
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.4) },
    shadowOpacity: 0.25,
    shadowRadius: responsiveWidth(1.5),
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: responsiveHeight(1),
    zIndex: 100,
  },
  dropdownHeader: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '700',
    color: colors.textMedium,
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(0.8),
    backgroundColor: colors.background,
    borderRadius: 5,
    marginHorizontal: responsiveWidth(2),
    marginBottom: responsiveHeight(0.5),
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: responsiveHeight(1.2),
    paddingHorizontal: responsiveWidth(4),
  },
  sortOptionText: {
    fontSize: getResponsiveFontSize(15),
    color: colors.textDark,
    fontWeight: '500',
  },
  sortOptionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: responsiveHeight(0.5),
    marginHorizontal: responsiveWidth(2),
  },
  shopList: {
    paddingHorizontal: responsiveWidth(4),
    paddingTop: responsiveHeight(1.5),
    paddingBottom: responsiveHeight(3),
  },
  shopCard: {
    backgroundColor: colors.cardBackground,
    width: '100%',
    marginBottom: responsiveHeight(2),
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.2) },
    shadowOpacity: 0.08,
    shadowRadius: responsiveWidth(1),
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedShopCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: responsiveWidth(2),
  },
  shopImageContainer: {
    position: "relative",
    width: "100%",
    height: responsiveWidth(32),
  },
  shopImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  selectedBadge: {
    position: "absolute",
    top: responsiveHeight(1),
    right: responsiveWidth(2),
    backgroundColor: colors.primary,
    width: responsiveWidth(6),
    height: responsiveWidth(6),
    borderRadius: responsiveWidth(3),
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.1) },
    shadowOpacity: 0.2,
    shadowRadius: responsiveWidth(0.5),
  },
  shopDetails: {
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(1.2),
  },
  shopName: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: responsiveHeight(1),
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: responsiveHeight(1.5),
  },
  starsContainer: {
    flexDirection: "row",
    marginRight: responsiveWidth(2),
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
    gap: responsiveWidth(2),
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    paddingVertical: responsiveHeight(0.6),
    paddingHorizontal: responsiveWidth(2),
    borderRadius: 8,
  },
  metaText: {
    fontSize: getResponsiveFontSize(14),
    color: colors.textSecondary,
    marginLeft: responsiveWidth(1.5),
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    padding: responsiveWidth(10),
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    marginTop: responsiveHeight(2),
    fontSize: getResponsiveFontSize(16),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: responsiveHeight(3),
    fontWeight: "500",
  },
  bottomButtonContainer: {
    position: 'absolute',
    top: responsiveHeight(92.8),
    width: '100%',
    paddingHorizontal: responsiveWidth(4), // Add horizontal padding for the container
    zIndex: 200,
  },
  bottomCloseButton: {
    backgroundColor: '#000000', // Changed to primary color
    paddingVertical: responsiveHeight(2),
    borderRadius: 10, // Slightly rounded corners for a button look
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.4) },
    shadowOpacity: 0.3,
    shadowRadius: responsiveWidth(1.5),
    elevation: 10,
  },
  bottomCloseButtonText: {
    color: colors.white,
    fontSize: getResponsiveFontSize(18),
    fontWeight: '700',
  },
});
