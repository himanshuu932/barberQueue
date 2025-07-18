import React, { useState, useEffect, useRef } from "react";
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
  StatusBar,
  ActivityIndicator,
  Animated,
  PanResponder,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";
import { format, utcToZonedTime } from "date-fns-tz";
import { getHours } from 'date-fns';
import { LineChart, BarChart } from "react-native-chart-kit";
import History from '../../components/owner/History'; // Assuming this path is correct

const API_BASE_URL = 'https://numbr-exq6.onrender.com';
const IST_TIMEZONE = "Asia/Kolkata";
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Colors
const colors = {
  secondary: '#30cfd0',
  background: '#f5f7fa',
  cardBackground: '#ffffff',
  headerBackground: '#000000',
  textDark: '#333',
  textMedium: '#666',
  textLight: '#a0aec0',
  textSecondary: '#555',
  border: '#f0f0f0',
  shadow: 'rgba(0, 0, 0, 0.15)',
  error: '#dc3545',
  white: '#ffffff',
  green: '#00b894',
  blue: '#0984e3',
  // Added a new color for header background gradient
  headerGradientStart: '#007bff', // A vibrant blue
  headerGradientEnd: '#0056b3',   // A darker blue
};

// SliderButton Component (Modified)
const SliderButton = ({ onSlideComplete, initialColor, finalColor, text }) => {
  const slideX = useRef(new Animated.Value(0)).current;
  const buttonWidth = screenWidth * 0.9;
  const thumbWidth = screenWidth * 0.15;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        // Clamp the movement to stay within the button's bounds
        const newX = Math.max(0, Math.min(gestureState.dx, buttonWidth - thumbWidth));
        slideX.setValue(newX);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const slideRange = buttonWidth - thumbWidth;
        // If the thumb has moved past half the slideable range, complete the slide
        if (slideX._value > slideRange * 0.5) {
          Animated.timing(slideX, {
            toValue: slideRange,
            duration: 200,
            useNativeDriver: false
          }).start(() => {
            onSlideComplete();
            // Reset the thumb position after a short delay for visual feedback
            setTimeout(() => slideX.setValue(0), 500);
          });
        } else {
          // Snap back to the initial position if not slid far enough
          Animated.spring(slideX, {
            toValue: 0,
            useNativeDriver: false
          }).start();
        }
      },
    })
  ).current;

  // Interpolate background color based on thumb's position
  const backgroundColor = slideX.interpolate({
    inputRange: [0, Math.max(0, buttonWidth - thumbWidth)],
    outputRange: [initialColor, finalColor],
    extrapolate: 'clamp'
  });
  // The thumb's translateX directly follows slideX
  const thumbTranslateX = slideX.interpolate({
    inputRange: [0, Math.max(0, buttonWidth - thumbWidth)],
    outputRange: [0, Math.max(0, buttonWidth - thumbWidth)],
    extrapolate: 'clamp'
  });

  return (
    // Apply panResponder.panHandlers to the main container to make the whole area slidable
    <Animated.View
      style={[sliderStyles.sliderButtonContainer, { backgroundColor }]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[sliderStyles.sliderThumb, { transform: [{ translateX: thumbTranslateX }] }]}
      >
        <Icon name="chevron-right" size={screenWidth * 0.045} color={colors.white} />
      </Animated.View>
      <Text style={sliderStyles.sliderButtonText}>{text}</Text>
    </Animated.View>
  );
};

const sliderStyles = StyleSheet.create({
  sliderButtonContainer: {
    width: screenWidth * 0.9,
    height: screenHeight * 0.07,
    borderRadius: screenWidth * 0.03,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: screenHeight * 0.03,
    elevation: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.003 },
    shadowOpacity: 0.2,
    shadowRadius: screenWidth * 0.01,
  },
  sliderThumb: {
    width: screenWidth * 0.15,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: screenWidth * 0.03,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
  },
  sliderButtonText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    color: colors.white,
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
  },
});

// Main Menu Component (Unchanged)
const Menu = () => {
  const [todayStats, setTodayStats] = useState({
    earnings: 0,
    customers: 0,
    popularService: "N/A",
    topEmployee: "N/A"
  });
  const [revenueData, setRevenueData] = useState(null);
  const [contributionData, setContributionData] = useState(null);
  const [graphFlag, setGraphFlag] = useState(1);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const processDashboardData = (shopsWithHistory) => {
    const todayDateString = format(utcToZonedTime(new Date(), IST_TIMEZONE), "yyyy-MM-dd", { timeZone: IST_TIMEZONE });
    let totalEarnings = 0, customerCount = 0;
    const serviceCount = {}, barberEarnings = {}, hourlyRevenue = { 9: 0, 12: 0, 15: 0, 18: 0, 21: 0 };

    shopsWithHistory.forEach(shop => {
        (shop.history || []).forEach(transaction => {
          const transactionDate = utcToZonedTime(new Date(transaction.date), IST_TIMEZONE);
          if (format(transactionDate, "yyyy-MM-dd", { timeZone: IST_TIMEZONE }) === todayDateString) {
            totalEarnings += transaction.totalCost;
            customerCount++;
            const barberName = transaction.barber?.name || 'Unknown';
            barberEarnings[barberName] = (barberEarnings[barberName] || 0) + transaction.totalCost;
            (transaction.services || []).forEach(s => {
              const serviceName = s.name || 'Unnamed Service';
              serviceCount[serviceName] = (serviceCount[serviceName] || 0) + (s.quantity || 1);
            });
            const hour = getHours(transactionDate);
            if (hour >= 9 && hour < 12) hourlyRevenue[9] += transaction.totalCost;
            else if (hour >= 12 && hour < 15) hourlyRevenue[12] += transaction.totalCost;
            else if (hour >= 15 && hour < 18) hourlyRevenue[15] += transaction.totalCost;
            else if (hour >= 18 && hour < 21) hourlyRevenue[18] += transaction.totalCost;
            else if (hour >= 21) hourlyRevenue[21] += transaction.totalCost;
          }
        });
    });

    const popularService = Object.keys(serviceCount).length > 0 ?
      Object.entries(serviceCount).reduce((a, b) => a[1] > b[1] ? a : b)[0] : "N/A";
    const topEmployee = Object.keys(barberEarnings).length > 0 ?
      Object.entries(barberEarnings).reduce((a, b) => a[1] > b[1] ? a : b)[0] : "N/A";
    setTodayStats({ earnings: totalEarnings, customers: customerCount, popularService, topEmployee });

    setRevenueData({
      labels: ["9 AM", "12 PM", "3 PM", "6 PM", "9 PM"],
      datasets: [{ data: Object.values(hourlyRevenue) }],
    });

    const barberNames = Object.keys(barberEarnings);
    setContributionData({
      labels: barberNames.length > 0 ? barberNames : ["No Data"],
      datasets: [{ data: barberNames.length > 0 ? Object.values(barberEarnings) : [0] }],
    });
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) throw new Error("Authentication token not found. Please log in again.");
      const response = await fetch(`${API_BASE_URL}/api/owners/me/shops`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Failed to fetch dashboard data.");

      processDashboardData(data.data || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError(error.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    backgroundColor: colors.cardBackground,
    backgroundGradientFrom: colors.cardBackground,
    backgroundGradientTo: colors.cardBackground,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: screenWidth * 0.04 },
    propsForDots: {
      r: screenWidth * 0.012,
      strokeWidth: screenWidth * 0.005,
      stroke: "#ffa726"
    },
    barPercentage: 0.8,
  };

  const defaultLineChartData = {
    labels: ["9 AM", "12 PM", "3 PM", "6 PM"],
    datasets: [{ data: [0, 0, 0, 0] }],
  };
  const defaultBarChartData = {
    labels: ['No Data'],
    datasets: [{ data: [0] }]
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.green} />
      <Text style={styles.loadingText}>Loading Dashboard...</Text>
    </View>
  );

  if (error) return (
    <View style={styles.errorContainer}>
      <Icon name="exclamation-triangle" size={screenWidth * 0.1} color={colors.error} />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={fetchDashboardData}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBackground} />
      <ImageBackground
        source={require("../../app/image/bglogin.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(240, 240, 240, 0.8)', 'rgba(240, 240, 240, 0.9)']}
          style={styles.overlay}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Enhanced Header Section */}
          <LinearGradient
            colors={[colors.headerGradientStart, colors.headerGradientEnd]}
            style={styles.headerGradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>Today's Overview</Text>
          </LinearGradient>
          {/* End Enhanced Header Section */}

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.green }]}>
              <Text style={styles.statCardLabel}>Earnings</Text>
              <Text style={styles.statCardValue}>₹{todayStats.earnings}</Text>
              <View style={styles.statCardIcon}>
                <Icon name="money" size={screenWidth * 0.05} color={colors.white} />
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.blue }]}>
              <Text style={styles.statCardLabel}>Customers</Text>
              <Text style={styles.statCardValue}>{todayStats.customers}</Text>
              <View style={styles.statCardIcon}>
                <Icon name="users" size={screenWidth * 0.05} color={colors.white} />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {graphFlag === 1 ? "Revenue Trend" : "Barber Contribution"}
              </Text>
              <View style={styles.navigationContainer}>
                <TouchableOpacity
                  onPress={() => setGraphFlag(graphFlag === 1 ? 2 : 1)}
                  style={styles.navButton}
                >
                  <Icon name="chevron-left" size={screenWidth * 0.05} color={colors.blue} />
                </TouchableOpacity>
                <View style={styles.paginationContainer}>
                  {[1, 2].map(v => (
                    <View
                      key={v}
                      style={[
                        styles.paginationDot,
                        graphFlag === v && styles.paginationDotActive
                      ]}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  onPress={() => setGraphFlag(graphFlag === 1 ? 2 : 1)}
                  style={styles.navButton}
                >
                  <Icon name="chevron-right" size={screenWidth * 0.05} color={colors.blue} />
                </TouchableOpacity>
              </View>
            </View>

            {graphFlag === 1 ? (
              <LineChart
                data={revenueData || defaultLineChartData}
                width={screenWidth * 0.9 - screenWidth * 0.08}
                height={screenHeight * 0.3}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => colors.green
                }}
                bezier
                style={styles.chart}
                yAxisLabel="₹"
              />
            ) : (
              <BarChart
                data={contributionData || defaultBarChartData}
                width={screenWidth * 0.9 - screenWidth * 0.08}
                height={screenHeight * 0.3}
                fromZero
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => colors.blue
                }}
                style={styles.chart}
                yAxisLabel="₹"
              />
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Today's Insights</Text>
            </View>
            <View style={styles.insightsContainer}>
              <View style={styles.insightItem}>
                <View style={[styles.insightIcon, { backgroundColor: `${colors.green}20` }]}>
                  <Icon name="scissors" size={screenWidth * 0.05} color={colors.green} />
                </View>
                <View style={styles.insightText}>
                  <Text style={styles.insightLabel}>Popular Service</Text>
                  <Text style={styles.insightValue}>{todayStats.popularService}</Text>
                </View>
              </View>

              <View style={styles.insightItem}>
                <View style={[styles.insightIcon, { backgroundColor: `${colors.blue}20` }]}>
                  <Icon name="star" size={screenWidth * 0.05} color={colors.blue} />
                </View>
                <View style={styles.insightText}>
                  <Text style={styles.insightLabel}>Top Employee</Text>
                  <Text style={styles.insightValue}>{todayStats.topEmployee}</Text>
                </View>
              </View>
            </View>
          </View>

          <SliderButton
            onSlideComplete={() => setIsHistoryModalVisible(true)}
            initialColor={colors.green}
            finalColor={colors.blue}
            text="Slide to View Detailed Statistics"
          />
        </ScrollView>
      </ImageBackground>

      <Modal
        animationType="slide"
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
    backgroundColor: colors.background,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  contentContainer: {
    padding: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.05,
  },
  headerGradientBackground: {
    width: '100%', // Take full width of parent padding
    paddingVertical: screenHeight * 0.03, // Responsive vertical padding
    paddingHorizontal: screenWidth * 0.05, // Responsive horizontal padding
    borderRadius: screenWidth * 0.04, // Responsive border radius
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: screenHeight * 0.03, // Space below the header
    elevation: 8, // Android shadow
    shadowColor: colors.shadow, // iOS shadow
    shadowOffset: { width: 0, height: screenHeight * 0.005 },
    shadowOpacity: 0.3,
    shadowRadius: screenWidth * 0.02,
  },
  headerTitle: {
    fontSize: screenWidth * 0.1, // Slightly reduced for better fit, still prominent
    fontWeight: '800', // Bolder
    color: colors.white, // White text for contrast on gradient
    textShadowColor: 'rgba(0, 0, 0, 0.3)', // Subtle text shadow
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginBottom: screenHeight * 0.005, // Space between title and subtitle
  },
  headerSubtitle: {
    fontSize: screenWidth * 0.045, // Adjusted size
    width: screenWidth * 0.7, // Keep width constrained
    textAlign: 'center',
    color: colors.white, // White text for contrast
    opacity: 0.9, // Slightly transparent
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: screenHeight * 0.03,
  },
  statCard: {
    width: screenWidth * 0.44,
    borderRadius: screenWidth * 0.03,
    padding: screenWidth * 0.04,
    elevation: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.003 },
    shadowOpacity: 0.15,
    shadowRadius: screenWidth * 0.01,
  },
  statCardLabel: {
    color: colors.white,
    fontSize: screenWidth * 0.035,
    opacity: 0.9,
    marginBottom: screenHeight * 0.005,
  },
  statCardValue: {
    color: colors.white,
    fontSize: screenWidth * 0.06,
    fontWeight: '700',
  },
  statCardIcon: {
    position: 'absolute',
    right: screenWidth * 0.04,
    top: screenWidth * 0.04,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: screenWidth * 0.08,
    height: screenWidth * 0.08,
    borderRadius: screenWidth * 0.04,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: screenWidth * 0.04,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.03,
    elevation: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: screenHeight * 0.003 },
    shadowOpacity: 0.15,
    shadowRadius: screenWidth * 0.01,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: screenHeight * 0.02,
  },
  cardTitle: {
    fontSize: screenWidth * 0.048,
    fontWeight: '600',
    color: colors.textDark,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButton: {
    padding: screenWidth * 0.02,
  },
  paginationContainer: {
    flexDirection: 'row',
    marginHorizontal: screenWidth * 0.02,
  },
  paginationDot: {
    width: screenWidth * 0.02,
    height: screenWidth * 0.02,
    borderRadius: screenWidth * 0.01,
    backgroundColor: '#ddd',
    marginHorizontal: screenWidth * 0.01,
  },
  paginationDotActive: {
    backgroundColor: colors.blue,
  },
  chart: {
    borderRadius: screenWidth * 0.03,
    alignSelf: 'center',
  },
  insightsContainer: {
    marginTop: screenHeight * 0.01,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: screenHeight * 0.015,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  insightIcon: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    borderRadius: screenWidth * 0.05,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: screenWidth * 0.03,
  },
  insightText: {
    flex: 1,
  },
  insightLabel: {
    fontSize: screenWidth * 0.038,
    color: colors.textMedium,
  },
  insightValue: {
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    color: colors.textDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: screenHeight * 0.02,
    fontSize: screenWidth * 0.04,
    color: colors.textMedium,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: screenWidth * 0.05,
  },
  errorText: {
    marginTop: screenHeight * 0.02,
    fontSize: screenWidth * 0.04,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: screenHeight * 0.03,
    backgroundColor: colors.green,
    paddingVertical: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.08,
    borderRadius: screenWidth * 0.02,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
  },
});

export default Menu;
