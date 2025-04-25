
import React, { useState, useEffect } from "react";
import {
  TouchableOpacity,
  Modal,
  Alert,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  FlatList,
  TextInput,
  Platform,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { io } from "socket.io-client";
import { Rating } from "react-native-ratings";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

export const ShopList = ({ onSelect, onClose }) => {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      const response = await fetch(
        "http://10.0.2.2:5000/shop/shops"
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      setShops(data);
    } catch (err) {
      setError(err.message || "Error fetching shops");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShop = async (shopId) => {
    try {
      await AsyncStorage.setItem("pinnedShop", shopId);
      if (onSelect) {
        onSelect();
      }
    } catch (error) {
      console.error("Error saving pinned shop:", error);
    }
  };

  const filteredShops = shops.filter((shop) =>
    shop.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function fetchBarbersAndCalculateAverage(shopId) {
    try {
      const response = await fetch(
        `http://10.0.2.2:5000/barbers?shopId=${shopId}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const barbers = await response.json();

      let overallSum = 0;
      barbers.forEach((barber) => {
        let avgRating = 0;
        if (barber.totalRatings > 0) {
          avgRating = barber.totalStarsEarned / barber.totalRatings;
        } else if (barber.ratings && barber.ratings.length > 0) {
          const total = barber.ratings.reduce((sum, rating) => sum + rating, 0);
          avgRating = total / barber.ratings.length;
        }
        overallSum += avgRating;
      });
      const overallAverage = barbers.length > 0 ? overallSum / barbers.length : 0;
      return { overallAverage };
    } catch (error) {
      console.error("Error fetching barbers and calculating average:", error);
      return { overallAverage: 0 };
    }
  }

  // Inner component for each shop item.
  const ShopItem = ({ item }) => {
    const [averageRating, setAverageRating] = useState(null);

    useEffect(() => {
      async function getAverageRating() {
        const { overallAverage } = await fetchBarbersAndCalculateAverage(item._id);
        setAverageRating(overallAverage);
      }
      getAverageRating();
    }, [item._id]);

    return (
      <TouchableOpacity
        style={shopListStyles.shopContainer}
        onPress={() => handleSelectShop(item._id)}
      >
        <View style={shopListStyles.itemHeader}>
          <Text style={shopListStyles.shopName}>{item.name}</Text>
          <Text style={shopListStyles.shopName}>{item.address.x}</Text>
        </View>
        {item.address && (
          <View style={shopListStyles.addressContainer}>
            <Text style={shopListStyles.addressText}>
              {`Address: ${item.address.textData}`}
            </Text>
          </View>
        )}
        {averageRating !== null && (
          <View style={shopListStyles.ratingContainer}>
            <Text style={shopListStyles.ratingText}>
              Rating : {averageRating.toFixed(1)}
            </Text>
            <Icon
              name="star"
              size={16}
              color="#FFD700"
              style={shopListStyles.starIcon}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderShop = ({ item }) => <ShopItem item={item} />;

  const renderHeader = () => (
    <View style={shopListStyles.headerContainer}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={shopListStyles.heading}>Choose Shop</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={20} color="black" />
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        style={shopListStyles.searchInput}
        placeholder="Search shops..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={shopListStyles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={shopListStyles.centered}>
        <Text>Error: {error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredShops}
      keyExtractor={(item) => item._id}
      renderItem={renderShop}
      ListHeaderComponent={renderHeader}
      stickyHeaderIndices={[0]}
      contentContainerStyle={shopListStyles.listContainer}
    />
  );
};

const shopListStyles = StyleSheet.create({
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  listContainer: {
    paddingBottom: 16,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContainer: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginBottom: 8,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    // marginBottom: 8,
    color: "#333",
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    marginVertical: 10,
  },
  shopContainer: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  shopName: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
    color: "#333",
  },
  addressContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  addressText: {
    flexBasis: "100%",
    color: "#555",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginRight: 4,
  },
  starIcon: {
    marginTop: 2, // Adjust this value if needed to align vertically
  },
});  