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
  PixelRatio, // Import PixelRatio for responsive fonts
  ActivityIndicator, // Import ActivityIndicator
  Animated, // Import Animated for animations
  PanResponder, // Import PanResponder for gestures
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";
import { format, utcToZonedTime } from "date-fns-tz";
import { LineChart, BarChart } from "react-native-chart-kit";
import History from '../../components/owner/History';

const IST_TIMEZONE = "Asia/Kolkata";
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Responsive utility functions
const fontScale = PixelRatio.getFontScale();
const getResponsiveFontSize = (size) => size / fontScale;
const responsiveHeight = (h) => screenHeight * (h / 100);
const responsiveWidth = (w) => screenWidth * (w / 100);

// Define colors based on History.js for consistency
const colors = {
  // Removed primary color, will use green/blue directly where primary was used for main elements
  secondary: '#30cfd0', // Secondary accent color (can be kept for insights if desired)
  background: '#f5f7fa', // Light grey background
  cardBackground: '#ffffff', // White cards
  headerBackground: '#000000', // Black for app name (as per original menu.js)
  textDark: '#333', // Dark grey for main text
  textMedium: '#666', // Medium grey for labels
  textLight: '#a0aec0', // Light grey for placeholders
  textSecondary: '#555', // Muted grey for meta info
  border: '#f0f0f0', // Light border
  shadow: 'rgba(0, 0, 0, 0.15)', // Soft shadow for cards
  error: '#dc3545', // Red for errors
  white: '#ffffff',
  green: '#00b894', // Green for revenue
  blue: '#0984e3', // Blue for customers
};

// SliderButton Component
const SliderButton = ({ onSlideComplete, initialColor, finalColor, text }) => {
  const slideX = useRef(new Animated.Value(0)).current;
  // Initialize buttonWidth and thumbWidth with their calculated responsive values
  const [buttonWidth, setButtonWidth] = useState(screenWidth - (responsiveWidth(5) * 2));
  const [thumbWidth, setThumbWidth] = useState(responsiveWidth(15));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        slideX.setOffset(slideX._value); // Store current value as offset
        slideX.setValue(0); // Reset current value for delta tracking
      },
      onPanResponderMove: (evt, gestureState) => {
        // Clamp the movement within the button bounds
        const newX = Math.max(0, Math.min(gestureState.dx, buttonWidth - thumbWidth));
        slideX.setValue(newX);
      },
      onPanResponderRelease: (evt, gestureState) => {
        slideX.flattenOffset(); // Add the offset back to the current value
        const slideRange = buttonWidth - thumbWidth;
        // Adjusted slideThreshold to 15% for even easier activation
        const slideThreshold = slideRange * 0.15; // 15% to trigger

        if (gestureState.dx >= slideThreshold && slideRange > 0) { // Ensure slideRange is positive
          Animated.timing(slideX, {
            toValue: slideRange,
            duration: 100,
            useNativeDriver: false,
          }).start(() => {
            onSlideComplete();
            // Reset after a short delay or when modal closes
            setTimeout(() => {
              slideX.setValue(0); // Reset for next use
            }, 500); // Small delay to show completion
          });
        } else {
          Animated.spring(slideX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // Ensure inputRange is monotonically non-decreasing and always valid
  const safeSlideRange = Math.max(0, buttonWidth - thumbWidth);

  const backgroundColor = slideX.interpolate({
    inputRange: [0, safeSlideRange],
    outputRange: [initialColor, finalColor],
    extrapolate: 'clamp',
  });

  const thumbTranslateX = slideX.interpolate({
    inputRange: [0, safeSlideRange],
    outputRange: [0, safeSlideRange],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[sliderStyles.sliderButtonContainer, { backgroundColor }]}
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          sliderStyles.sliderThumb,
          { transform: [{ translateX: thumbTranslateX }] },
        ]}
      >
        <Icon name="chevron-right" size={getResponsiveFontSize(18)} color={colors.white} />
      </Animated.View>
      <Text style={sliderStyles.sliderButtonText}>{text}</Text>
    </Animated.View>
  );
};

const sliderStyles = StyleSheet.create({
  sliderButtonContainer: {
    width: screenWidth - (responsiveWidth(5) * 2), // Explicitly set width based on content area
    height: responsiveHeight(7), // Responsive height
    borderRadius: responsiveWidth(3),
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: responsiveHeight(3), // Responsive margin
    elevation: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.3) },
    shadowOpacity: 0.2,
    shadowRadius: responsiveWidth(1),
  },
  sliderThumb: {
    width: responsiveWidth(15), // Responsive thumb width
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Semi-transparent white thumb
    borderRadius: responsiveWidth(3),
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
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
  },
});


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
  const [loading, setLoading] = useState(true); // Added loading state
  const [error, setError] = useState(null); // Added error state

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
        setError("Failed to retrieve shop ID."); // Set error state
      }
    };
    getShopId();
  }, []);

  const fetchTodayStats = async (uid) => {
    try {
      // Dummy data for demonstration. In a real app, this would come from an API.
      const barbersData = [
        {
          name: "John Doe",
          history: [
            { totalCost: 150, services: ["Haircut"], date: "2025-06-01T10:00:00Z" },
            { totalCost: 200, services: ["Shave", "Facial"], date: "2025-06-01T11:30:00Z" },
            { totalCost: 100, services: ["Haircut"], date: "2025-06-02T09:00:00Z" }, // Today's data
            { totalCost: 250, services: ["Haircut", "Beard Trim"], date: "2025-06-02T10:30:00Z" }, // Today's data
          ],
        },
        {
          name: "Jane Smith",
          history: [
            { totalCost: 100, services: ["Haircut"], date: "2025-06-01T13:00:00Z" },
            { totalCost: 180, services: ["Beard Trim"], date: "2025-06-01T14:45:00Z" },
            { totalCost: 120, services: ["Shave"], date: "2025-06-02T11:00:00Z" }, // Today's data
            { totalCost: 300, services: ["Haircut", "Coloring"], date: "2025-06-02T12:30:00Z" }, // Today's data
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
        barberEarnings[barber.name] = 0; // Initialize earnings for each barber
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
      setError("Failed to load today's statistics."); // Set error state for UI feedback
    } finally {
      setLoading(false); // Ensure loading is set to false even on error
    }
  };

  // Dummy data for charts - replace with actual data fetched from API
  const revenueTimelineData = {
    labels: ["9 AM", "12 PM", "3 PM", "6 PM", "9 PM"],
    datasets: [{
      data: [500, 1200, 800, 1600, 900],
      color: (opacity = 1) => colors.green, // Line color, directly use green
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

  // Chart configuration for responsive design
  const chartConfig = {
    backgroundColor: colors.cardBackground,
    backgroundGradientFrom: colors.cardBackground,
    backgroundGradientTo: colors.cardBackground,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0,0,0,${opacity})`, // Label color
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: responsiveWidth(4) }, // Responsive border radius
    propsForDots: { r: responsiveWidth(1.2), strokeWidth: responsiveWidth(0.5), stroke: "#ffa726" }, // Responsive dot size
    barPercentage: 0.8, // Adjust bar width for BarChart
    categoryPercentage: 0.7, // Adjust spacing between bars
    // Explicitly set fillShadowGradient and opacity for the area below the line
    // fillShadowGradient: colors.green, // Use the green color for the fill
    // fillShadowGradientOpacity: 0.3, // Adjust opacity as needed
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.green} /> {/* Changed from primary to green */}
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-triangle" size={responsiveWidth(10)} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchTodayStats(shopId); }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBackground} />
      <ImageBackground
        source={require("../image/bglogin.png")} // Ensure this path is correct
        style={styles.backgroundImage}
      >
        <LinearGradient
          colors={['rgba(240, 240, 240, 0.8)', 'rgba(240, 240, 240, 0.9)']}
          style={styles.overlay}
        />
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
            <View style={[styles.statCard, { backgroundColor: colors.green }]}> {/* Changed to green */}
              <Text style={styles.statCardLabel}>Earnings</Text>
              <Text style={styles.statCardValue}>₹{todayStats.earnings}</Text>
              <View style={styles.statCardIcon}>
                <Icon name="money" size={getResponsiveFontSize(20)} color={colors.white} />
              </View>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.blue }]}> {/* Changed to blue */}
              <Text style={styles.statCardLabel}>Customers</Text>
              <Text style={styles.statCardValue}>{todayStats.customers}</Text>
              <View style={styles.statCardIcon}>
                <Icon name="users" size={getResponsiveFontSize(20)} color={colors.white} />
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
                  <Icon name="chevron-left" size={getResponsiveFontSize(20)} color={colors.blue} /> {/* Changed to blue */}
                </TouchableOpacity>
                <View style={styles.paginationContainer}>
                  {[1, 2].map((value) => (
                    <View
                      key={value}
                      style={[
                        styles.paginationDot,
                        graphFlag === value ? styles.paginationDotActive : styles.paginationDot, // Alternating colors
                      ]}
                    />
                  ))}
                </View>
                <TouchableOpacity onPress={handleRight} style={styles.navButton}>
                  <Icon name="chevron-right" size={getResponsiveFontSize(20)} color={colors.blue} /> {/* Changed to blue */}
                </TouchableOpacity>
              </View>
            </View>

            {graphFlag === 1 ? (
              <LineChart
                data={revenueTimelineData}
                width={responsiveWidth(90) - responsiveWidth(8)} // Card width - padding
                height={responsiveHeight(30)}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                yAxisLabel="₹"
                yAxisInterval={1}
                verticalLabelRotation={Platform.OS === 'ios' ? 0 : 30} // Adjust for platform
                segments={5}
              />
            ) : (
              <BarChart
                data={{
                  labels: barberContributionData.map((item) => item.name),
                  datasets: [{ data: barberContributionData.map((item) => item.revenue) }],
                }}
                width={responsiveWidth(90) - responsiveWidth(8)} // Card width - padding
                height={responsiveHeight(30)}
                fromZero
                verticalLabelRotation={Platform.OS === 'ios' ? 0 : 45} // Adjust for platform
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => colors.blue, // Bar color for BarChart
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
                <View style={[styles.insightIcon, { backgroundColor: `${colors.green}20` }]}> {/* Using green with opacity */}
                  <Icon name="scissors" size={getResponsiveFontSize(20)} color={colors.green} />
                </View>
                <View style={styles.insightText}>
                  <Text style={styles.insightLabel}>Popular Service</Text>
                  <Text style={styles.insightValue}>{todayStats.popularService}</Text>
                </View>
              </View>
              <View style={styles.insightItem}>
                <View style={[styles.insightIcon, { backgroundColor: `${colors.blue}20` }]}> {/* Using blue with opacity */}
                  <Icon name="star" size={getResponsiveFontSize(20)} color={colors.blue} />
                </View>
                <View style={styles.insightText}>
                  <Text style={styles.insightLabel}>Top Employee</Text>
                  <Text style={styles.insightValue}>{todayStats.topEmployee}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* See All Stats Slider Button */}
          <SliderButton
            onSlideComplete={() => setIsHistoryModalVisible(true)}
            initialColor={colors.green}
            finalColor={colors.blue}
            text="Slide to View Detailed Statistics"
          />
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
    backgroundColor: colors.background,
  },
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // LinearGradient is used in the component directly, so this overlay style is minimal
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: responsiveWidth(5), // Responsive padding
    // paddingBottom: responsiveHeight(5), // More padding at the bottom
  },
  header: {
    marginBottom: responsiveHeight(3), // Responsive margin
    alignItems: 'center', // Center align header text
  },
  headerTitle: {
    fontSize: getResponsiveFontSize(50), // Responsive font size
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: responsiveHeight(0.5), // Responsive margin
  },
  headerSubtitle: {
    fontSize: getResponsiveFontSize(18), // Responsive font size
    color: colors.textMedium,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveHeight(3), // Responsive margin
  },
  statCard: {
    width: responsiveWidth(44), // Responsive width (approx. 48% - gap/2)
    // backgroundColor handled inline for specific colors
    borderRadius: responsiveWidth(3), // Responsive border radius
    padding: responsiveWidth(4), // Responsive padding
    elevation: 5, // Increased elevation for a more prominent shadow
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.3) }, // Responsive shadow offset
    shadowOpacity: 0.15, // Adjusted shadow opacity
    shadowRadius: responsiveWidth(1), // Responsive shadow radius
  },
  statCardLabel: {
    color: colors.white,
    fontSize: getResponsiveFontSize(14), // Responsive font size
    opacity: 0.9,
    marginBottom: responsiveHeight(0.5), // Responsive margin
  },
  statCardValue: {
    color: colors.white,
    fontSize: getResponsiveFontSize(24), // Responsive font size
    fontWeight: '700',
  },
  statCardIcon: {
    position: 'absolute',
    right: responsiveWidth(4), // Responsive position
    top: responsiveWidth(4), // Responsive position
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: responsiveWidth(8), // Responsive size
    height: responsiveWidth(8), // Responsive size
    borderRadius: responsiveWidth(4), // Responsive border radius
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: responsiveWidth(4), // Responsive border radius
    padding: responsiveWidth(4), // Responsive padding
    marginBottom: responsiveHeight(3), // Responsive margin
    elevation: 5, // Increased elevation
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: responsiveHeight(0.3) },
    shadowOpacity: 0.15,
    shadowRadius: responsiveWidth(1),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveHeight(2), // Responsive margin
  },
  cardTitle: {
    fontSize: getResponsiveFontSize(18), // Responsive font size
    fontWeight: '600',
    color: colors.textDark,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButton: {
    padding: responsiveWidth(2), // Responsive padding
  },
  paginationContainer: {
    flexDirection: 'row',
    marginHorizontal: responsiveWidth(2), // Responsive margin
  },
  paginationDot: {
    width: responsiveWidth(2), // Responsive size
    height: responsiveWidth(2), // Responsive size
    borderRadius: responsiveWidth(1), // Responsive border radius
    backgroundColor: '#ddd',
    marginHorizontal: responsiveWidth(1), // Responsive margin
  },
  // paginationDotActive: { // New style for green active dot
  //   backgroundColor: colors.green,
  // },
  paginationDotActive: { // New style for blue active dot
    backgroundColor: colors.blue,
  },
  chart: {
    borderRadius: responsiveWidth(3), // Responsive border radius
    marginTop: responsiveHeight(1), // Responsive margin
    alignSelf: 'center', // Center the chart
  },
  insightsContainer: {
    marginTop: responsiveHeight(1), // Responsive margin
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: responsiveHeight(1.5), // Responsive padding
    borderBottomWidth: StyleSheet.hairlineWidth, // Thin border
    borderBottomColor: colors.border,
  },
  insightIcon: {
    width: responsiveWidth(10), // Responsive size
    height: responsiveWidth(10), // Responsive size
    borderRadius: responsiveWidth(5), // Responsive border radius
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveWidth(3), // Responsive margin
  },
  insightText: {
    flex: 1,
  },
  insightLabel: {
    fontSize: getResponsiveFontSize(14), // Responsive font size
    color: colors.textMedium,
    marginBottom: responsiveHeight(0.2), // Responsive margin
  },
  insightValue: {
    fontSize: getResponsiveFontSize(16), // Responsive font size
    fontWeight: '600',
    color: colors.textDark,
  },
  // primaryButton: { // This style is no longer directly used for the button, but kept for reference if needed elsewhere.
  //   backgroundColor: colors.green, // Default to green if used
  //   paddingVertical: responsiveHeight(2), // Responsive padding
  //   paddingHorizontal: responsiveWidth(6), // Responsive padding
  //   borderRadius: responsiveWidth(3), // Responsive border radius
  //   flexDirection: 'row',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   elevation: 5, // Increased elevation
  //   shadowColor: colors.shadow,
  //   shadowOffset: { width: 0, height: responsiveHeight(0.3) },
  //   shadowOpacity: 0.2,
  //   shadowRadius: responsiveWidth(1),
  //   marginTop: responsiveHeight(3), // Responsive margin
  // },
  // primaryButtonText: { // This style is no longer directly used for the button, but kept for reference if needed elsewhere.
  //   color: colors.white,
  //   fontSize: getResponsiveFontSize(16), // Responsive font size
  //   fontWeight: '600',
  // },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: responsiveHeight(2),
    fontSize: getResponsiveFontSize(16),
    color: colors.textMedium,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: responsiveWidth(5),
  },
  errorText: {
    marginTop: responsiveHeight(2),
    fontSize: getResponsiveFontSize(16),
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: responsiveHeight(2),
    backgroundColor: colors.green, // Changed from primary to green
    paddingVertical: responsiveHeight(1.5),
    paddingHorizontal: responsiveWidth(5),
    borderRadius: responsiveWidth(2),
  },
  retryButtonText: {
    color: colors.white,
    fontSize: getResponsiveFontSize(16),
    fontWeight: '600',
  },
});

export default Menu;
