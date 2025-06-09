// menu.js (Corrected and more robust)

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
  PixelRatio,
  ActivityIndicator,
  Animated,
  PanResponder,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";
import { format, utcToZonedTime } from "date-fns-tz";
import { getHours } from 'date-fns'; // Add this line
import { LineChart, BarChart } from "react-native-chart-kit";
import History from '../../components/owner/History';

const API_BASE_URL = 'http://10.0.2.2:5000';
const IST_TIMEZONE = "Asia/Kolkata";
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Responsive utility functions
const fontScale = PixelRatio.getFontScale();
const getResponsiveFontSize = (size) => size / fontScale;
const responsiveHeight = (h) => screenHeight * (h / 100);
const responsiveWidth = (w) => screenWidth * (w / 100);

// Colors
const colors = {
  secondary: '#30cfd0', background: '#f5f7fa', cardBackground: '#ffffff', headerBackground: '#000000', textDark: '#333', textMedium: '#666', textLight: '#a0aec0', textSecondary: '#555', border: '#f0f0f0', shadow: 'rgba(0, 0, 0, 0.15)', error: '#dc3545', white: '#ffffff', green: '#00b894', blue: '#0984e3',
};

// SliderButton Component (No changes)
const SliderButton = ({ onSlideComplete, initialColor, finalColor, text }) => {
    const slideX = useRef(new Animated.Value(0)).current;
    const buttonWidth = screenWidth - (responsiveWidth(5) * 2);
    const thumbWidth = responsiveWidth(15);
  
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (evt, gestureState) => {
          const newX = Math.max(0, Math.min(gestureState.dx, buttonWidth - thumbWidth));
          slideX.setValue(newX);
        },
        onPanResponderRelease: (evt, gestureState) => {
          const slideRange = buttonWidth - thumbWidth;
          if (gestureState.dx > slideRange * 0.5) {
            Animated.timing(slideX, { toValue: slideRange, duration: 200, useNativeDriver: false }).start(() => {
              onSlideComplete();
              setTimeout(() => slideX.setValue(0), 500);
            });
          } else {
            Animated.spring(slideX, { toValue: 0, useNativeDriver: false }).start();
          }
        },
      })
    ).current;
  
    const backgroundColor = slideX.interpolate({ inputRange: [0, Math.max(0, buttonWidth - thumbWidth)], outputRange: [initialColor, finalColor], extrapolate: 'clamp' });
    const thumbTranslateX = slideX.interpolate({ inputRange: [0, Math.max(0, buttonWidth - thumbWidth)], outputRange: [0, Math.max(0, buttonWidth - thumbWidth)], extrapolate: 'clamp' });
  
    return (
      <Animated.View style={[sliderStyles.sliderButtonContainer, { backgroundColor }]}>
        <Animated.View {...panResponder.panHandlers} style={[sliderStyles.sliderThumb, { transform: [{ translateX: thumbTranslateX }] }]}>
          <Icon name="chevron-right" size={getResponsiveFontSize(18)} color={colors.white} />
        </Animated.View>
        <Text style={sliderStyles.sliderButtonText}>{text}</Text>
      </Animated.View>
    );
};
const sliderStyles = StyleSheet.create({
    sliderButtonContainer: { width: screenWidth - (responsiveWidth(5) * 2), height: responsiveHeight(7), borderRadius: responsiveWidth(3), flexDirection: 'row', alignItems: 'center', overflow: 'hidden', marginTop: responsiveHeight(3), elevation: 5, shadowColor: colors.shadow, shadowOffset: { width: 0, height: responsiveHeight(0.3) }, shadowOpacity: 0.2, shadowRadius: responsiveWidth(1), },
    sliderThumb: { width: responsiveWidth(15), height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: responsiveWidth(3), justifyContent: 'center', alignItems: 'center', position: 'absolute', left: 0, },
    sliderButtonText: { position: 'absolute', width: '100%', textAlign: 'center', color: colors.white, fontSize: getResponsiveFontSize(16), fontWeight: '600', },
});

// Main Menu Component
const Menu = () => {
  const [todayStats, setTodayStats] = useState({ earnings: 0, customers: 0, popularService: "N/A", topEmployee: "N/A" });
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

    const popularService = Object.keys(serviceCount).length > 0 ? Object.entries(serviceCount).reduce((a, b) => a[1] > b[1] ? a : b)[0] : "N/A";
    const topEmployee = Object.keys(barberEarnings).length > 0 ? Object.entries(barberEarnings).reduce((a, b) => a[1] > b[1] ? a : b)[0] : "N/A";
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
      
      // *** UNCOMMENT THE NEXT LINE TO DEBUG YOUR API RESPONSE IN THE CONSOLE ***
      // console.log("API Response Data:", JSON.stringify(data.data, null, 2));

      processDashboardData(data.data || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError(error.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    backgroundColor: colors.cardBackground, backgroundGradientFrom: colors.cardBackground, backgroundGradientTo: colors.cardBackground, decimalPlaces: 0, color: (opacity = 1) => `rgba(0,0,0,${opacity})`, labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, style: { borderRadius: responsiveWidth(4) }, propsForDots: { r: responsiveWidth(1.2), strokeWidth: responsiveWidth(0.5), stroke: "#ffa726" }, barPercentage: 0.8,
  };

  const defaultLineChartData = {
    labels: ["9 AM", "12 PM", "3 PM", "6 PM"],
    datasets: [{ data: [0, 0, 0, 0] }],
  };
  const defaultBarChartData = {
      labels: ['No Data'],
      datasets: [{ data: [0] }]
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.green} /><Text style={styles.loadingText}>Loading Dashboard...</Text></View>;
  if (error) return <View style={styles.errorContainer}><Icon name="exclamation-triangle" size={responsiveWidth(10)} color={colors.error} /><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={fetchDashboardData}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></View>;

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBackground} />
      <ImageBackground source={require("../../app/image/bglogin.png")} style={styles.backgroundImage}>
        <LinearGradient colors={['rgba(240, 240, 240, 0.8)', 'rgba(240, 240, 240, 0.9)']} style={styles.overlay} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
          <View style={styles.header}><Text style={styles.headerTitle}>Dashboard</Text><Text style={styles.headerSubtitle}>Today's Overview</Text></View>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.green }]}><Text style={styles.statCardLabel}>Earnings</Text><Text style={styles.statCardValue}>₹{todayStats.earnings}</Text><View style={styles.statCardIcon}><Icon name="money" size={getResponsiveFontSize(20)} color={colors.white} /></View></View>
            <View style={[styles.statCard, { backgroundColor: colors.blue }]}><Text style={styles.statCardLabel}>Customers</Text><Text style={styles.statCardValue}>{todayStats.customers}</Text><View style={styles.statCardIcon}><Icon name="users" size={getResponsiveFontSize(20)} color={colors.white} /></View></View>
          </View>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{graphFlag === 1 ? "Revenue Trend" : "Barber Contribution"}</Text>
              <View style={styles.navigationContainer}>
                <TouchableOpacity onPress={() => setGraphFlag(graphFlag === 1 ? 2 : 1)} style={styles.navButton}><Icon name="chevron-left" size={getResponsiveFontSize(20)} color={colors.blue} /></TouchableOpacity>
                <View style={styles.paginationContainer}>{[1, 2].map(v => <View key={v} style={[styles.paginationDot, graphFlag === v && styles.paginationDotActive]} />)}</View>
                <TouchableOpacity onPress={() => setGraphFlag(graphFlag === 1 ? 2 : 1)} style={styles.navButton}><Icon name="chevron-right" size={getResponsiveFontSize(20)} color={colors.blue} /></TouchableOpacity>
              </View>
            </View>
            {graphFlag === 1 ? (
              <LineChart data={revenueData || defaultLineChartData} width={responsiveWidth(90) - responsiveWidth(8)} height={responsiveHeight(30)} chartConfig={{...chartConfig, color: (opacity = 1) => colors.green}} bezier style={styles.chart} yAxisLabel="₹" />
            ) : (
              <BarChart data={contributionData || defaultBarChartData} width={responsiveWidth(90) - responsiveWidth(8)} height={responsiveHeight(30)} fromZero chartConfig={{...chartConfig, color: (opacity = 1) => colors.blue}} style={styles.chart} yAxisLabel="₹" />
            )}
          </View>
          <View style={styles.card}>
            <View style={styles.cardHeader}><Text style={styles.cardTitle}>Today's Insights</Text></View>
            <View style={styles.insightsContainer}>
              <View style={styles.insightItem}><View style={[styles.insightIcon, { backgroundColor: `${colors.green}20` }]}><Icon name="scissors" size={getResponsiveFontSize(20)} color={colors.green} /></View><View style={styles.insightText}><Text style={styles.insightLabel}>Popular Service</Text><Text style={styles.insightValue}>{todayStats.popularService}</Text></View></View>
              <View style={styles.insightItem}><View style={[styles.insightIcon, { backgroundColor: `${colors.blue}20` }]}><Icon name="star" size={getResponsiveFontSize(20)} color={colors.blue} /></View><View style={styles.insightText}><Text style={styles.insightLabel}>Top Employee</Text><Text style={styles.insightValue}>{todayStats.topEmployee}</Text></View></View>
            </View>
          </View>
          <SliderButton onSlideComplete={() => setIsHistoryModalVisible(true)} initialColor={colors.green} finalColor={colors.blue} text="Slide to View Detailed Statistics" />
        </ScrollView>
      </ImageBackground>
      <Modal animationType="slide" visible={isHistoryModalVisible} onRequestClose={() => setIsHistoryModalVisible(false)}><History onClose={() => setIsHistoryModalVisible(false)} /></Modal>
    </View>
  );
};

// Styles (condensed for brevity, no changes from your original)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  backgroundImage: { flex: 1, resizeMode: "cover" },
  overlay: { ...StyleSheet.absoluteFillObject },
  contentContainer: { padding: responsiveWidth(5) },
  header: { marginBottom: responsiveHeight(3), alignItems: 'center' },
  headerTitle: { fontSize: getResponsiveFontSize(50), fontWeight: '700', color: colors.textDark },
  headerSubtitle: { fontSize: getResponsiveFontSize(18), color: colors.textMedium },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: responsiveHeight(3) },
  statCard: { width: responsiveWidth(44), borderRadius: responsiveWidth(3), padding: responsiveWidth(4), elevation: 5, shadowColor: colors.shadow, shadowOffset: { width: 0, height: responsiveHeight(0.3) }, shadowOpacity: 0.15, shadowRadius: responsiveWidth(1) },
  statCardLabel: { color: colors.white, fontSize: getResponsiveFontSize(14), opacity: 0.9, marginBottom: responsiveHeight(0.5) },
  statCardValue: { color: colors.white, fontSize: getResponsiveFontSize(24), fontWeight: '700' },
  statCardIcon: { position: 'absolute', right: responsiveWidth(4), top: responsiveWidth(4), backgroundColor: 'rgba(255, 255, 255, 0.2)', width: responsiveWidth(8), height: responsiveWidth(8), borderRadius: responsiveWidth(4), justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: colors.cardBackground, borderRadius: responsiveWidth(4), padding: responsiveWidth(4), marginBottom: responsiveHeight(3), elevation: 5, shadowColor: colors.shadow, shadowOffset: { width: 0, height: responsiveHeight(0.3) }, shadowOpacity: 0.15, shadowRadius: responsiveWidth(1) },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: responsiveHeight(2) },
  cardTitle: { fontSize: getResponsiveFontSize(18), fontWeight: '600', color: colors.textDark },
  navigationContainer: { flexDirection: 'row', alignItems: 'center' },
  navButton: { padding: responsiveWidth(2) },
  paginationContainer: { flexDirection: 'row', marginHorizontal: responsiveWidth(2) },
  paginationDot: { width: responsiveWidth(2), height: responsiveWidth(2), borderRadius: responsiveWidth(1), backgroundColor: '#ddd', marginHorizontal: responsiveWidth(1) },
  paginationDotActive: { backgroundColor: colors.blue },
  chart: { borderRadius: responsiveWidth(3), alignSelf: 'center' },
  insightsContainer: { marginTop: responsiveHeight(1) },
  insightItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: responsiveHeight(1.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  insightIcon: { width: responsiveWidth(10), height: responsiveWidth(10), borderRadius: responsiveWidth(5), justifyContent: 'center', alignItems: 'center', marginRight: responsiveWidth(3) },
  insightText: { flex: 1 },
  insightLabel: { fontSize: getResponsiveFontSize(14), color: colors.textMedium },
  insightValue: { fontSize: getResponsiveFontSize(16), fontWeight: '600', color: colors.textDark },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: responsiveHeight(2), fontSize: getResponsiveFontSize(16), color: colors.textMedium },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: responsiveWidth(5) },
  errorText: { marginTop: responsiveHeight(2), fontSize: getResponsiveFontSize(16), color: colors.error, textAlign: 'center' },
  retryButton: { marginTop: responsiveHeight(3), backgroundColor: colors.green, paddingVertical: responsiveHeight(1.5), paddingHorizontal: responsiveWidth(8), borderRadius: responsiveWidth(2) },
  retryButtonText: { color: colors.white, fontSize: getResponsiveFontSize(16), fontWeight: '600' },
});

export default Menu;