import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Switch,
  Image,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";

const screenWidth = Dimensions.get("window").width;

export const ShopList = ({ onSelect, onClose }) => {
  const [shopRatings, setShopRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchShopsWithRatings();
  }, []);

  const fetchShopsWithRatings = async () => {
    try {
      const shopRes = await fetch("http://10.0.2.2:5000/shop/shops");
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
      const res = await fetch(`http://10.0.2.2:5000/barbers?shopId=${shopId}`);
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
    await AsyncStorage.setItem("pinnedShop", shopId);
    onSelect?.();
  };

  const isNearby = (shop) => {
    return shop.address?.x <= 100; // sample proximity logic
  };

  const filtered = shopRatings.filter(({ shop, averageRating }) => {
    const matchesName = shop.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRating = averageRating >= minRating;
    const matchesProximity = !nearbyOnly || isNearby(shop);
    return matchesName && matchesRating && matchesProximity;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>Error: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Choose Shop</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={20} color="black" />
            </TouchableOpacity>
          )}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Search shops..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Min Rating:</Text>
          <TextInput
            style={styles.ratingInput}
            keyboardType="numeric"
            value={minRating.toString()}
            onChangeText={(val) => setMinRating(Number(val) || 0)}
          />
          <Text style={styles.filterLabel}>Nearby:</Text>
          <Switch
            value={nearbyOnly}
            onValueChange={(val) => setNearbyOnly(val)}
            trackColor={{ false: "#ccc", true: "#4caf50" }}
            thumbColor={nearbyOnly ? "#fff" : "#f4f3f4"}
          />
        </View>
      </View>

      <View style={styles.grid}>
        {filtered.map(({ shop, averageRating }) => (
          <TouchableOpacity
            key={shop._id}
            style={styles.tile}
            onPress={() => handleSelectShop(shop._id)}
          >
           <Image
  source={{ uri: `https://picsum.photos/200` }} 
  style={styles.image}
/>
            <Text style={styles.shopName}>{shop.name}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.rating}>{averageRating.toFixed(1)}</Text>
              <Icon name="star" size={16} color="#FFD700" />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 30,
    paddingHorizontal: 12,
    backgroundColor: "#f9f9f9",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    marginVertical: 10,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 26, fontWeight: "bold", color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  filterLabel: {
    fontSize: 16,
    color: "#555",
  },
  ratingInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    width: 60,
    fontSize: 16,
    marginRight: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  tile: {
    backgroundColor: "#fff",
    width: (screenWidth - 40) / 2.4, // 2 tiles with spacing
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
    borderColor: "#eee",
    borderWidth: 1,
    paddingBottom: 12,
  },
  image: {
    width: "100%",
    height: 150,
    resizeMode: "cover",
  },
  shopName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    paddingHorizontal: 10,
    marginTop: 10,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    marginTop: 6,
  },
  rating: {
    fontSize: 16,
    marginRight: 5,
    color: "#444",
  },
});
