import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";
import { format, utcToZonedTime } from "date-fns-tz";

const IST_TIMEZONE = "Asia/Kolkata";
const { width: screenWidth } = Dimensions.get("window");

// Carousel data with Picsum image URLs
const carouselData = [
  "https://picsum.photos/seed/1/600/300",
  "https://picsum.photos/seed/2/600/300",
  "https://picsum.photos/seed/3/600/300",
];

const Menu = () => {
  const [todayStats, setTodayStats] = useState({
    earnings: 0,
    customers: 0,
    popularService: "Loading...",
    topEmployee: "Loading...",
  });

  useEffect(() => {
    fetchTodayStats();
  }, []);

  const fetchTodayStats = async () => {
    try {
      // Fetch barbers data
      const barbersResponse = await fetch("http://10.0.2.2:5000/barbers");
      const barbersData = await barbersResponse.json();

      // Get current date in IST timezone
      const now = new Date();
      const todayIST = utcToZonedTime(now, IST_TIMEZONE);
      const todayDateString = format(todayIST, "yyyy-MM-dd", {
        timeZone: IST_TIMEZONE,
      });

      // Process all transactions
      let totalEarnings = 0;
      let customerCount = 0;
      const serviceCount = {};
      const barberEarnings = {};

      barbersData.forEach((barber) => {
        // Initialize barber earnings
        barberEarnings[barber.name] = 0;

        barber.history.forEach((transaction) => {
          const transactionDate = utcToZonedTime(
            new Date(transaction.date),
            IST_TIMEZONE
          );
          const transactionDateString = format(
            transactionDate,
            "yyyy-MM-dd",
            { timeZone: IST_TIMEZONE }
          );

          // Only count today's transactions
          if (transactionDateString === todayDateString) {
            totalEarnings += transaction.totalCost;
            customerCount += 1;

            // Track service popularity (if services exist and is a string)
            if (
              transaction.services &&
              typeof transaction.services === "string"
            ) {
              transaction.services
                .split(",")
                .map((service) => service.trim())
                .forEach((service) => {
                  serviceCount[service] = (serviceCount[service] || 0) + 1;
                });
            }

            // Track barber earnings
            barberEarnings[barber.name] += transaction.totalCost;
          }
        });
      });

      // Find most popular service
      let popularService = "None";
      let maxServiceCount = 0;
      Object.entries(serviceCount).forEach(([service, count]) => {
        if (count > maxServiceCount) {
          maxServiceCount = count;
          popularService = service;
        }
      });

      // Find top earning (popular) barber based on number of customers served today
      let popularBarber = "None";
      let maxCustomerCount = 0;
      Object.entries(barberEarnings).forEach(([barber, earnings]) => {
        if (earnings > maxCustomerCount) {
          maxCustomerCount = earnings;
          popularBarber = barber;
        }
      });

      // Update state with calculated values
      setTodayStats({
        earnings: totalEarnings,
        customers: customerCount,
        popularService: popularService,
        topEmployee: popularBarber,
      });
    } catch (error) {
      console.error("Error fetching today's stats:", error);
    }
  };

  return (
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
          <LinearGradient key={index} colors={item.colors} style={styles.smallCard}>
            <Icon name={item.iconName} size={24} color="#fff" />
            <Text style={styles.smallCardTitle}>{item.title}</Text>
            <Text style={styles.smallCardValue}>{item.value}</Text>
          </LinearGradient>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    alignItems: "center",
    padding: 20,
  },
  carouselContainer: {
    marginBottom: 20,
  },
  carouselContentContainer: {
    paddingHorizontal: 20,
  },
  carouselImage: {
    height: 200,
    borderRadius: 12,
    marginRight: 10,
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
