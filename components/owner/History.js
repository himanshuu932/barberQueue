// History.js (Fully Dynamic Version)

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Switch, ImageBackground, Alert, Platform, ActivityIndicator, PixelRatio
} from "react-native";
import { Menu, Provider } from "react-native-paper";
import { DatePickerModal, registerTranslation } from "react-native-paper-dates";
import { en } from 'react-native-paper-dates';
import { format, utcToZonedTime } from 'date-fns-tz';
import { startOfMonth, endOfMonth, eachDayOfInterval, getDate, getDay } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarChart, LineChart } from "react-native-chart-kit";

// --- CONFIGURATION ---
const API_BASE_URL = 'http://10.0.2.2:5000';
const IST_TIMEZONE = 'Asia/Kolkata';
const screenWidth = Dimensions.get("window").width - 32;

// --- SETUP ---
registerTranslation('en', en);

const History = ({ onClose }) => {
  // Filter States
  const [filter, setFilter] = useState("All");
  const [selectedShop, setSelectedShop] = useState("AllShops");
  const [selectedBarber, setSelectedBarber] = useState("AllBarbers");
  const [selectedDate, setSelectedDate] = useState(null);

  // Data States
  const [allPayments, setAllPayments] = useState([]);
  const [shops, setShops] = useState([]);

  // UI Control States
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [shopMenuVisible, setShopMenuVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [showVisualizations, setShowVisualizations] = useState(true);
  const [graphFlag, setGraphFlag] = useState(1);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  
  // Async Operation States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const fetchHistoryData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) throw new Error("Authentication failed. Please log in again.");

      const response = await fetch(`${API_BASE_URL}/api/owners/me/shops`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok || !data.success) throw new Error(data.message || "Could not fetch history.");

      const fetchedShops = data.data || [];
      setShops(fetchedShops);

      const allHistory = fetchedShops.reduce((acc, shop) => {
        const shopHistory = (shop.history || []).map(entry => {
          const istDate = utcToZonedTime(new Date(entry.date), IST_TIMEZONE);
          return {
            ...entry,
            shopName: shop.name,
            barberName: entry.barber?.name || 'Unknown Barber',
            date: format(istDate, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE }),
            time: format(istDate, 'HH:mm', { timeZone: IST_TIMEZONE }),
            originalDate: new Date(entry.date)
          };
        });
        return [...acc, ...shopHistory];
      }, []);
      setAllPayments(allHistory);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(fetchHistoryData);

  const getFilteredPayments = () => {
    // This function logic remains largely the same as it correctly filters the `allPayments` state
    const now = new Date();
    const todayIST = utcToZonedTime(now, IST_TIMEZONE);
    const oneWeekAgoIST = new Date(todayIST); oneWeekAgoIST.setDate(todayIST.getDate() - 7);
    const oneMonthAgoIST = new Date(todayIST); oneMonthAgoIST.setMonth(todayIST.getMonth() - 1);

    return allPayments.filter(payment => {
      const istPaymentDate = utcToZonedTime(payment.originalDate, IST_TIMEZONE);
      if (filter === "Today" && format(istPaymentDate, 'yyyy-MM-dd') !== format(todayIST, 'yyyy-MM-dd')) return false;
      if (filter === "ThisWeek" && istPaymentDate < oneWeekAgoIST) return false;
      if (filter === "ThisMonth" && istPaymentDate < oneMonthAgoIST) return false;
      if (selectedDate && format(istPaymentDate, 'yyyy-MM-dd') !== format(new Date(selectedDate), 'yyyy-MM-dd')) return false;
      if (selectedShop !== "AllShops" && payment.shopName !== selectedShop) return false;
      if (selectedBarber !== "AllBarbers" && payment.barberName !== selectedBarber) return false;
      return true;
    });
  };

  const createAndSavePdf = async () => {
    setIsPdfLoading(true);
    try {
        const filtered = getFilteredPayments();
        let shopData = { name: "All Shops", address: { textData: "Multiple Locations" } };

        if (selectedShop !== "AllShops") {
            const currentShop = shops.find(s => s.name === selectedShop);
            if (currentShop) {
                shopData = { name: currentShop.name, address: { textData: currentShop.address?.textData || 'No address provided' } };
            }
        }
        
        const htmlContent = generatePdfContent(filtered, shopData);
        const { uri } = await Print.printToFileAsync({ html: htmlContent });

        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Download Report' });
    } catch (error) {
        Alert.alert("Error", "Failed to create or share PDF.");
        console.error("PDF generation error:", error);
    } finally {
        setIsPdfLoading(false);
    }
  };

  const generatePdfContent = (transactions, shopData) => {
    const totalRevenue = transactions.reduce((sum, p) => sum + p.totalCost, 0);
    const tableRows = transactions.map(p =>
      `<tr>
        <td>${p.barberName}</td>
        <td>₹${p.totalCost}</td>
        <td>${(p.services || []).map(s => s.name).join(", ")}</td>
        <td>${p.date} • ${p.time}</td>
      </tr>`
    ).join('');

    return `
        <html><body>
            <h1>Transaction Report for ${shopData.name}</h1>
            <p>${shopData.address.textData}</p>
            <h3>Total Revenue: ₹${totalRevenue} | Total Customers: ${transactions.length}</h3>
            <table border="1" style="width:100%; border-collapse: collapse;">
                <thead><tr><th>Barber</th><th>Amount</th><th>Services</th><th>Date & Time</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </body></html>
    `;
  };

  // All other helper functions (getBarberContributionData, getRevenueTimelineData, etc.)
  // and rendering logic (renderCalendar, JSX return) can remain largely the same,
  // as they are designed to work off the `filteredPayments` array, which is now dynamic.
  // The below is a placeholder for the full component JSX.

  if (loading) {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" />
            <Text>Loading History...</Text>
        </View>
    );
  }

  if (error) {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ color: 'red', marginBottom: 10 }}>Error: {error}</Text>
            <TouchableOpacity onPress={fetchHistoryData} style={{ padding: 10, backgroundColor: 'lightblue' }}>
                <Text>Retry</Text>
            </TouchableOpacity>
        </View>
    );
  }

  const filteredPayments = getFilteredPayments();
  // Ensure the rest of the component (the return statement with all the UI) is here,
  // it was omitted for brevity as the core logic change is the data fetching.
  // The original UI structure you had is fine.
  return (
    <ImageBackground source={require("../../app/image/bglogin.png")} style={styles.backgroundImage}>
      <View style={styles.header}><Text style={styles.title}>Numbr</Text></View>
      <View style={styles.overlay} />
      <Provider>
        <View style={styles.fullscreenContainer}>
          <ScrollView contentContainerStyle={styles.scrollContentContainer}>
            <View style={styles.fixedHeader}><Text style={styles.headerTitle}>STATISTICS</Text></View>
            
            {/* Filter UI - No logical changes needed here */}
            <View style={styles.outerContainer}>
              <View style={styles.filterGroup}>
                <Menu visible={filterMenuVisible} onDismiss={() => setFilterMenuVisible(false)} anchor={<TouchableOpacity onPress={() => setFilterMenuVisible(true)} style={styles.filterButton}><Text style={styles.filterButtonText}>📅 {filter}</Text></TouchableOpacity>}>
                  {["All", "Today", "ThisWeek", "ThisMonth", "CustomDate"].map(f => <Menu.Item key={f} onPress={() => { setFilter(f); setFilterMenuVisible(false); if (f === "CustomDate") setDatePickerVisible(true); }} title={f} />)}
                </Menu>
                <Menu visible={shopMenuVisible} onDismiss={() => setShopMenuVisible(false)} anchor={<TouchableOpacity onPress={() => setShopMenuVisible(true)} style={styles.filterButton}><Text style={styles.filterButtonText}>🏢 {selectedShop === "AllShops" ? "All Shops" : selectedShop}{selectedShop !== "AllShops" && selectedBarber !== "AllBarbers" ? ` / ${selectedBarber}` : ""}</Text></TouchableOpacity>}>
                  <Menu.Item onPress={() => { setSelectedShop("AllShops"); setSelectedBarber("AllBarbers"); setShopMenuVisible(false); }} title="All Shops" />
                  {shops.map(shop => (
                    <View key={shop._id}>
                      <Menu.Item onPress={() => { setSelectedShop(shop.name); setSelectedBarber("AllBarbers"); setShopMenuVisible(false); }} title={`• ${shop.name}`} style={styles.shopMenuItem} />
                      {(shop.barbers || []).map(barber => (
                        <Menu.Item key={barber._id} onPress={() => { setSelectedShop(shop.name); setSelectedBarber(barber.name); setShopMenuVisible(false); }} title={`    - ${barber.name}`} style={styles.barberMenuItem} />
                      ))}
                    </View>
                  ))}
                </Menu>
              </View>
              <View style={styles.visualizeGroup}>
                <Text style={styles.toggleLabel}>Visualize</Text>
                <Switch value={showVisualizations} onValueChange={setShowVisualizations} trackColor={{ false: "rgb(0,0,0)", true: "#0984e3" }} thumbColor={"#fff"}/>
              </View>
            </View>

            {/* Summary Cards, Charts, and Transaction List - No logical changes needed */}
            {/* These will now reflect the dynamic data automatically */}
            <View style={styles.summaryContainer}>
              <View style={[styles.summaryCard, styles.revenueCard]}><Text style={styles.summaryTitle}>Total Revenue</Text><Text style={styles.summaryValue}>₹{filteredPayments.reduce((s, p) => s + p.totalCost, 0)}</Text></View>
              <View style={[styles.summaryCard, styles.customersCard]}><Text style={styles.summaryTitle}>Total Customers</Text><Text style={styles.summaryValue}>{filteredPayments.length}</Text></View>
            </View>

            {/* ... rest of your JSX for charts and transaction list ... */}
            <View style={styles.controlsContainer}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity style={styles.buttonContainer} onPress={createAndSavePdf} disabled={isPdfLoading}>
                <LinearGradient colors={["#e63946", "#d62828"]} style={styles.pdfButton}>
                  {isPdfLoading ? <ActivityIndicator size="small" color="white" /> : <MaterialCommunityIcons name="file-export" size={25} color="white" />}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.recentTransactionsContainer}>
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((payment, index) => (
                    <View key={payment._id || index} style={styles.transactionCard}>
                      <View style={styles.transactionHeader}>
                        <Text style={styles.barberName}>{payment.barberName} ({payment.shopName})</Text>
                        <Text style={styles.transactionAmount}>₹{payment.totalCost}</Text>
                      </View>
                      <Text style={styles.servicesList}>{(payment.services || []).map(s => s.name).join(", ")}</Text>
                      <Text style={styles.transactionDate}>{payment.date} • {payment.time} IST</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noTransactionsText}>No transactions found for the selected filters.</Text>
                )}
            </View>

          </ScrollView>
          <TouchableOpacity onPress={onClose} style={styles.fixedCloseButton}><MaterialCommunityIcons name="close-circle" size={30} color="#2d3436" /></TouchableOpacity>
        </View>
      </Provider>
    </ImageBackground>
  );
};


// Your full styles object should be here. It's omitted for brevity.
const styles = StyleSheet.create({
  header: { height: "8%", backgroundColor: "black", flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  title: { color: "#fff", fontSize: 20, marginLeft: 15 },
  backgroundImage: { flex: 1, resizeMode: "cover", position: "absolute", width: "100%", height: "100%" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(237,236,236,0.77)", top: "8%" },
  fullscreenContainer: { flex: 1, position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "transparent" },
  fixedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 15, position: "relative", zIndex: 10 },
  headerTitle: { fontSize: 40, fontWeight: "900", color: "#2d3436", textAlign: "center", flex: 1 },
  fixedCloseButton: { position: 'absolute', bottom: 20, alignSelf: 'center', zIndex: 100, backgroundColor: 'white', borderRadius: 20, padding: 5, elevation: 5 },
  scrollContentContainer: { padding: 16, paddingBottom: 60 },
  buttonContainer: { borderRadius: 15, overflow: "hidden" },
  pdfButton: { padding: 7, borderRadius: 15, alignItems: "center", justifyContent: "center", elevation: 6, width: 40, height: 40 },
  recentTransactionsContainer: { maxHeight: 550, backgroundColor: "#ffffff", borderRadius: 12, padding: 15, elevation: 4, marginBottom: 20 },
  controlsContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 5, marginBottom: 15 },
  sectionTitle: { fontSize: 22, fontWeight: "bold", color: "#333" },
  outerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", paddingHorizontal: 0, marginBottom: 20 },
  filterGroup: { flexDirection: "row", alignItems: "center", flexWrap: 'wrap', rowGap: 10, columnGap: 10, flexShrink: 1 },
  filterButton: { paddingVertical: 12, paddingHorizontal: 15, backgroundColor: "#ffffff", borderRadius: 10, alignItems: "center", elevation: 3 },
  filterButtonText: { color: "#2d3436", fontWeight: "600", fontSize: 15 },
  shopMenuItem: { paddingLeft: 10 },
  barberMenuItem: { paddingLeft: 30 },
  visualizeGroup: { flexDirection: "row", alignItems: "center" },
  toggleLabel: { fontWeight: "900", marginRight: 8, color: "#333", fontSize: 16 },
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, padding: 15, borderRadius: 12, elevation: 4 },
  revenueCard: { backgroundColor: '#00b894' },
  customersCard: { backgroundColor: '#0984e3' },
  summaryTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  summaryValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  transactionCard: { backgroundColor: "#f9f9f9", borderRadius: 10, padding: 15, marginBottom: 10, elevation: 2 },
  transactionHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  barberName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  transactionAmount: { fontSize: 16, fontWeight: "bold", color: "#00b894" },
  servicesList: { fontSize: 14, color: "#555", marginBottom: 5 },
  transactionDate: { fontSize: 12, color: "#777", textAlign: "right" },
  noTransactionsText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#666' },
});

export default History;