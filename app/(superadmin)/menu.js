// menu.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  ImageBackground,
  Modal,
  Platform,
  StatusBar
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";
import { format, utcToZonedTime } from "date-fns-tz";
import { LineChart, BarChart } from "react-native-chart-kit";
import History from '../../components/owner/History';

const IST_TIMEZONE = "Asia/Kolkata";
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const Menu = () => {
  const [shopId, setShopId] = useState(null);
  const [todayStats, setTodayStats] = useState({
    earnings: 0,
    customers: 0,
    popularService: "Loading...",
    topEmployee: "Loading...",
  });
  const [graphFlag, setGraphFlag] = useState(1);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);

  useEffect(() => {
    const getShopId = async () => {
      try {
        const uid = await AsyncStorage.getItem("uid");
        if (!uid) {
          setShopId("defaultShop123");
          fetchTodayStats("defaultShop123");
          return;
        }
        setShopId(uid);
        fetchTodayStats(uid);
      } catch (error) {
        console.error("Error fetching shop ID:", error);
      }
    };
    getShopId();
  }, []);

  const fetchTodayStats = async (uid) => {
    try {
      const barbersData = [
        {
          name: "Dummy Barber 1",
          history: [
            { totalCost: 150, services: ["Haircut"], date: "2025-06-01T10:00:00Z" },
            { totalCost: 200, services: ["Shave"], date: "2025-06-01T11:30:00Z" },
          ],
        },
        {
          name: "Dummy Barber 2",
          history: [
            { totalCost: 100, services: ["Haircut"], date: "2025-06-01T13:00:00Z" },
            { totalCost: 180, services: ["Beard Trim"], date: "2025-06-01T14:45:00Z" },
          ],
        },
      ];

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
          const transactionDateString = format(transactionDate, "yyyy-MM-dd", {
            timeZone: IST_TIMEZONE,
          });
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

  const revenueTimelineData = {
    labels: ["9 AM", "12 PM", "3 PM", "6 PM", "9 PM"],
    datasets: [{
      data: [500, 1200, 800, 1600, 900],
      color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
      strokeWidth: 2
    }],
  };

  const barberContributionData = [
    { name: "John", revenue: 4500 },
    { name: "Jane", revenue: 3800 },
    { name: "Mike", revenue: 2900 },
    { name: "Sara", revenue: 4200 },
  ];

  const handleLeft = () => {
    setGraphFlag((prev) => (prev === 1 ? 2 : prev - 1));
  };

  const handleRight = () => {
    setGraphFlag((prev) => (prev === 2 ? 1 : prev + 1));
  };

  return (
    <View style={styles.safeArea}>
      <ImageBackground
        source={require("../image/bglogin.png")}
        style={styles.backgroundImage}
      >
        <View style={styles.overlay} />
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>Today's Overview</Text>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statCardLabel}>Earnings</Text>
              <Text style={styles.statCardValue}>₹{todayStats.earnings}</Text>
              <View style={styles.statCardIcon}>
                <Icon name="money" size={20} color="#fff" />
              </View>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statCardLabel}>Customers</Text>
              <Text style={styles.statCardValue}>{todayStats.customers}</Text>
              <View style={styles.statCardIcon}>
                <Icon name="users" size={20} color="#fff" />
              </View>
            </View>
          </View>

          {/* Graph Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {graphFlag === 1 ? "Revenue Trend" : "Barber Contribution"}
              </Text>
              <View style={styles.navigationContainer}>
                <TouchableOpacity onPress={handleLeft} style={styles.navButton}>
                  <Icon name="chevron-left" size={20} color="#6a11cb" />
                </TouchableOpacity>
                <View style={styles.paginationContainer}>
                  {[1, 2].map((value) => (
                    <View
                      key={value}
                      style={[
                        styles.paginationDot,
                        graphFlag === value && styles.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>
                <TouchableOpacity onPress={handleRight} style={styles.navButton}>
                  <Icon name="chevron-right" size={20} color="#6a11cb" />
                </TouchableOpacity>
              </View>
            </View>

            {graphFlag === 1 ? (
              <LineChart
                data={revenueTimelineData}
                width={screenWidth * 0.85}
                height={220}
                chartConfig={{
                  backgroundColor: "#fff",
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(106, 17, 203, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "5", strokeWidth: "2", stroke: "#ffa726" },
                }}
                bezier
                style={styles.chart}
                yAxisLabel="₹"
                yAxisInterval={1}
                verticalLabelRotation={30}
                segments={5}
              />
            ) : (
              <BarChart
                data={{
                  labels: barberContributionData.map((item) => item.name),
                  datasets: [{ data: barberContributionData.map((item) => item.revenue) }],
                }}
                width={screenWidth * 0.85}
                height={220}
                fromZero
                verticalLabelRotation={45}
                chartConfig={{
                  backgroundColor: "#fff",
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(34, 128, 176, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                }}
                style={styles.chart}
              />
            )}
          </View>

          {/* Insights Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Today's Insights</Text>
            </View>
            <View style={styles.insightsContainer}>
              <View style={styles.insightItem}>
                <View style={[styles.insightIcon, { backgroundColor: '#6a11cb20' }]}>
                  <Icon name="scissors" size={20} color="#6a11cb" />
                </View>
                <View style={styles.insightText}>
                  <Text style={styles.insightLabel}>Popular Service</Text>
                  <Text style={styles.insightValue}>{todayStats.popularService}</Text>
                </View>
              </View>
              <View style={styles.insightItem}>
                <View style={[styles.insightIcon, { backgroundColor: '#30cfd020' }]}>
                  <Icon name="star" size={20} color="#30cfd0" />
                </View>
                <View style={styles.insightText}>
                  <Text style={styles.insightLabel}>Top Employee</Text>
                  <Text style={styles.insightValue}>{todayStats.topEmployee}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* See All Stats Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setIsHistoryModalVisible(true)}
          >
            <Text style={styles.primaryButtonText}>View Detailed Statistics</Text>
            <Icon name="arrow-right" size={16} color="#fff" style={{ marginLeft: 10 }} />
          </TouchableOpacity>
        </ScrollView>
      </ImageBackground>

      {/* History Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isHistoryModalVisible}
        onRequestClose={() => setIsHistoryModalVisible(false)}
      >
        <History onClose={() => setIsHistoryModalVisible(false)} />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#6a11cb',
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statCardLabel: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 4,
  },
  statCardValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  statCardIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButton: {
    padding: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    marginHorizontal: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#6a11cb',
  },
  chart: {
    borderRadius: 12,
    marginTop: 8,
  },
  insightsContainer: {
    marginTop: 8,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightText: {
    flex: 1,
  },
  insightLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  primaryButton: {
    backgroundColor: '#6a11cb',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Menu;