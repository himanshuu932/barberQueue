import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Switch,
  Image,
  Dimensions,
  StatusBar,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

export const ShopList = ({ onSelect, onClose }) => {
  const [shopRatings, setShopRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [error, setError] = useState("");
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [showFilters, setShowFilters] = useState(false); // State for filter visibility

  useEffect(() => {
    fetchShopsWithRatings();
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

  const fetchShopsWithRatings = async () => {
    try {
      const shopRes = await fetch("https://numbr-p7zc.onrender.com/shop/shops");
      const shops = await shopRes.json();

      const ratedShops = await Promise.all(
        shops.map(async (shop) => {
          const avg = await getAverageRating(shop._id);
          return { shop, averageRating: avg };
        })
      );

      setShopRatings(ratedShops);
    } catch (err) {
      setError(err.message || "Error loading shops");
    } finally {
      setLoading(false);
    }
  };

  const getAverageRating = async (shopId) => {
    try {
      const res = await fetch(`https://numbr-p7zc.onrender.com/barbers?shopId=${shopId}`);
      const barbers = await res.json();

      let total = 0,
        count = 0;
      barbers.forEach((b) => {
        if (b.totalRatings > 0) {
          total += b.totalStarsEarned / b.totalRatings;
          count++;
        } else if (b.ratings?.length) {
          const sum = b.ratings.reduce((s, r) => s + r, 0);
          total += sum / b.ratings.length;
          count++;
        }
      });

      return count ? total / count : 0;
    } catch {
      return 0;
    }
  };

  const handleSelectShop = async (shopId) => {
    setSelectedShopId(shopId);
    await AsyncStorage.setItem("pinnedShop", shopId);
    onSelect?.();
  };

  const isNearby = (shop) => {
    return shop.address?.x <= 100; // sample proximity logic
  };

  const filtered = shopRatings.filter(({ shop, averageRating }) => {
    const matchesName = searchQuery ? shop.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    const matchesRating = averageRating >= minRating;
    const matchesProximity = !nearbyOnly || isNearby(shop);
    return matchesName && matchesRating && matchesProximity;
  });

  // Function to generate active filter summary string
  const getActiveFilterSummary = () => {
    const filters = [];
    if (searchQuery) {
      filters.push(`"${searchQuery}"`);
    }
    if (minRating > 0) {
      filters.push(`Rating: ${minRating}+`);
    }
    if (nearbyOnly) {
      filters.push("Nearby");
    }
    return filters.length > 0 ? ` (${filters.join(", ")})` : "";
  };

  const filterSummary = getActiveFilterSummary();

  const renderShopItem = ({ item }) => {
    const { shop, averageRating } = item;
    const isSelected = shop._id === selectedShopId;

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
              <FontAwesome5 name="check" size={12} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.shopDetails}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>

          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                  key={star}
                  name="star"
                  size={14}
                  color={star <= Math.round(averageRating) ? "#FFD700" : "#E0E0E0"}
                  style={{ marginRight: 2 }}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
          </View>

          <View style={styles.shopMeta}>
            <View style={styles.metaItem}>
              <FontAwesome5 name="map-marker-alt" size={12} color="#666" />
              <Text style={styles.metaText}>2.3 km</Text>
            </View>
            <View style={styles.metaItem}>
              <FontAwesome5 name="clock" size={12} color="#666" />
              <Text style={styles.metaText}>Open</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#186ac8" />
        <Text style={styles.loadingText}>Loading shops...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-circle" size={40} color="#ff6b6b" />
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchShopsWithRatings}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* App Name Header */}
      <View style={styles.headerApp}>
        <Text style={styles.titleApp}>Numbr</Text>
      </View>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Choose Barber Shop</Text>
          <View style={styles.headerActions}>
            {/* Close Button (if needed, or can be handled by navigation.goBack in parent screen) */}
            {onClose && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Icon name="times" size={20} color="#333" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search shops by name..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Icon name="times-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Toggle and Section */}
      <View style={styles.filterToggleContainer}>
        <TouchableOpacity
          style={styles.filterToggleButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <FontAwesome5 name="filter" size={18} color="#333" />
          <Text style={styles.filterToggleButtonText}>Filter</Text>
          <Icon
            name={showFilters ? "chevron-up" : "chevron-down"}
            size={16}
            color="#333"
            style={styles.filterToggleIcon}
          />
        </TouchableOpacity>
        {filterSummary ? (
          <Text style={styles.filterSummaryText}>{filterSummary}</Text>
        ) : null}
      </View>

      {showFilters && (
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Min Rating:</Text>
              <View style={styles.ratingSelector}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setMinRating(star)}
                  >
                    <Icon
                      name="star"
                      size={18}
                      color={star <= minRating ? "#FFD700" : "#E0E0E0"}
                      style={{ marginHorizontal: 1 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Nearby Only:</Text>
              <Switch
                value={nearbyOnly}
                onValueChange={(val) => setNearbyOnly(val)}
                trackColor={{ false: "#ccc", true: "#186ac8" }}
                thumbColor={nearbyOnly ? "#fff" : "#f4f3f4"}
                ios_backgroundColor="#ccc"
                style={styles.switch}
              />
            </View>
          </View>

          <View style={styles.filterStats}>
            <Text style={styles.resultsText}>
              {filtered.length} {filtered.length === 1 ? "shop" : "shops"} found
            </Text>
          </View>
        </View>
      )}

      <FlatList
        data={filtered}
        renderItem={renderShopItem}
        keyExtractor={(item) => item.shop._id}
        contentContainerStyle={styles.shopList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="search" size={50} color="#ccc" />
            <Text style={styles.emptyText}>No shops found matching your criteria</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  headerApp: {
    height: 60,
    backgroundColor: "black",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    width: '100%',
  },
  titleApp: {
    color: "#fff",
    fontSize: 20,
    marginLeft: 15,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#555",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 20,
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    color: "#555",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#186ac8",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingTop: 15,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
  },
  filterToggleContainer: {
    flexDirection: 'row', // Arrange children horizontally
    justifyContent: 'flex-end', // Align to the right
    alignItems: 'center', // Vertically center items
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 10, // Space between button and summary text
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  filterToggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 5,
  },
  filterToggleIcon: {
    marginLeft: 8,
  },
  filterSummaryText: {
    fontSize: 14,
    color: '#666',
    flexShrink: 1, // Allow text to wrap
  },
  filterSection: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  filterItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterLabel: {
    fontSize: 15,
    color: "#555",
  },
  ratingSelector: {
    flexDirection: "row",
    alignItems: "center",
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  filterStats: {
    marginVertical: 8,
  },
  resultsText: {
    fontSize: 14,
    color: "#777",
  },
  shopList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  shopCard: {
    backgroundColor: "#fff",
    width: width - 32,
    height: 200,
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#eee",
    flexDirection: 'column',
  },
  selectedShopCard: {
    borderColor: "#186ac8",
    borderWidth: 2,
    transform: [{ scale: 1.00 }],
  },
  shopImageContainer: {
    position: "relative",
    width: "100%",
    height: "50%",
  },
  shopImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  selectedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#186ac8",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  shopDetails: {
    padding: 12,
    height: "50%",
    justifyContent: 'space-between',
  },
  shopName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  starsContainer: {
    flexDirection: "row",
  },
  ratingText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#555",
  },
  shopMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 4,
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: "#888",
    textAlign: "center",
  },
});
