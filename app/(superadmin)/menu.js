import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  ImageBackground
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";
import { format, utcToZonedTime } from "date-fns-tz";

const IST_TIMEZONE = "Asia/Kolkata";
const { width: screenWidth } = Dimensions.get("window");

// Image URL from Picsum
const carouselData = [
  "https://picsum.photos/seed/1/600/400",
];

const Menu = () => {
  const [shopId, setShopId] = useState(null);
  const [todayStats, setTodayStats] = useState({
    earnings: 0,
    customers: 0,
    popularService: "Loading...",
    topEmployee: "Loading...",
  });

  useEffect(() => {
    const getShopId = async () => {
      try {
        const uid = await AsyncStorage.getItem("uid");
        if (!uid) {
          console.error("Shop ID not found in AsyncStorage");
          return;
        }
        setShopId(uid);
        fetchTodayStats(uid); // Fetch stats after getting shopId
      } catch (error) {
        console.error("Error fetching shop ID:", error);
      }
    };

    getShopId();
  }, []);

  const fetchTodayStats = async (uid) => {
    try {
      const barbersResponse = await fetch(`https://numbr-p7zc.onrender.com/barbers?shopId=${uid}`);
      const barbersData = await barbersResponse.json();

      const now = new Date();
      const todayIST = utcToZonedTime(now, IST_TIMEZONE);
      const todayDateString = format(todayIST, "yyyy-MM-dd", { timeZone: IST_TIMEZONE });

      let totalEarnings = 0;
      let customerCount = 0;
      const serviceCount = {};
      const barberEarnings = {};

      barbersData.forEach((barber) => {
        barberEarnings[barber.name] = 0;
        barber.history.forEach((transaction) => {
          const transactionDate = utcToZonedTime(new Date(transaction.date), IST_TIMEZONE);
          const transactionDateString = format(transactionDate, "yyyy-MM-dd", { timeZone: IST_TIMEZONE });

          if (transactionDateString === todayDateString) {
            totalEarnings += transaction.totalCost;
            customerCount += 1;

            if (transaction.services) {
              transaction.services.forEach((service) => {
                serviceCount[service] = (serviceCount[service] || 0) + 1;
              });
            }

            barberEarnings[barber.name] += transaction.totalCost;
          }
        });
      });

      let popularService = "None";
      let maxServiceCount = 0;
      Object.entries(serviceCount).forEach(([service, count]) => {
        if (count > maxServiceCount) {
          maxServiceCount = count;
          popularService = service;
        }
      });

      let topEmployee = "None";
      let maxEarnings = 0;
      Object.entries(barberEarnings).forEach(([barber, earnings]) => {
        if (earnings > maxEarnings) {
          maxEarnings = earnings;
          topEmployee = barber;
        }
      });

      setTodayStats({
        earnings: totalEarnings,
        customers: customerCount,
        popularService: popularService,
        topEmployee: topEmployee,
      });
    } catch (error) {
      console.error("Error fetching today's stats:", error);
    }
  };

  return (
    <ImageBackground
      source={require("../image/bglogin.png")}
      style={styles.backgroundImage}
    >
      <View style={styles.overlay}/>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Image Carousel Section */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.carouselContainer}
          contentContainerStyle={styles.carouselContentContainer}
        >
          {carouselData.map((imageUrl, index) => (
            <Image
              key={index}
              source={{ uri: imageUrl }}
              style={[styles.carouselImage, { width: screenWidth - 40 }]}
              resizeMode="cover"
            />
          ))}
        </ScrollView>

        {/* Small Cards Section */}
        <View style={styles.smallCardsContainer}>
          {[
            {
              title: "Today's Earnings",
              value: `₹${todayStats.earnings}`,
              iconName: "money",
              colors: ["#6a11cb", "#2575fc"],
            },
            {
              title: "Today's Customers",
              value: todayStats.customers.toString(),
              iconName: "users",
              colors: ["#ff7e5f", "#feb47b"],
            },
            {
              title: "Popular Service",
              value: todayStats.popularService,
              iconName: "scissors",
              colors: ["#4c669f", "#3b5998"],
            },
            {
              title: "Top Employee",
              value: todayStats.topEmployee,
              iconName: "star",
              colors: ["#30cfd0", "#330867"],
            },
          ].map((item, index) => (
            <LinearGradient
              key={index}
              colors={item.colors}
              style={styles.smallCard}
            >
              <Icon name={item.iconName} size={24} color="#fff" />
              <Text style={styles.smallCardTitle}>{item.title}</Text>
              <Text style={styles.smallCardValue}>{item.value}</Text>
            </LinearGradient>
          ))}
        </View>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(237, 236, 236, 0.77)",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    alignItems: "center",
    padding: 20,
  },
  carouselContainer: {
    marginBottom: 20,
  },
  carouselContentContainer: {},
  carouselImage: {
    height: 200,
    borderRadius: 12,
  },
  smallCardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
    width: "100%",
  },
  smallCard: {
    width: "48%",
    aspectRatio: 1,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  smallCardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8,
    textAlign: "center",
  },
  smallCardValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 4,
  },
});

export default Menu;
