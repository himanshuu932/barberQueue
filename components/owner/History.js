import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Switch,
  ImageBackground,
  Alert,
  Platform,
  ActivityIndicator, // Moved from react-native-paper to react-native
} from "react-native";
import { Menu, Provider } from "react-native-paper"; // Keep Provider for Menu
import { DatePickerModal } from "react-native-paper-dates";
import { format, utcToZonedTime } from 'date-fns-tz';
import { registerTranslation } from 'react-native-paper-dates';
import { en } from 'react-native-paper-dates';
import { BarChart, LineChart } from "react-native-chart-kit";
import { startOfMonth, endOfMonth, eachDayOfInterval, getDate, getDay } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

registerTranslation('en', en);

const IST_TIMEZONE = 'Asia/Kolkata';
const screenWidth = Dimensions.get("window").width - 32; // Accounting for padding

// --- Dummy Data for Shops and Barbers with Transaction History ---
// This data structure supports the shop and barber filtering
const dummyShopsData = [
  {
    id: "shop1",
    name: "The Classic Cut",
    address: { textData: "123 Main St, Anytown, USA" },
    barbers: [
      {
        id: "barber1_shop1",
        name: "Alice",
        history: [
          { totalCost: 250, services: ["Haircut", "Shave"], date: "2025-05-28T10:30:00Z" },
          { totalCost: 150, services: ["Haircut"], date: "2025-05-29T11:00:00Z" },
          { totalCost: 300, services: ["Haircut", "Facial"], date: "2025-06-01T09:00:00Z" },
          { totalCost: 200, services: ["Haircut"], date: "2025-06-01T15:00:00Z" },
          { totalCost: 100, services: ["Beard Trim"], date: "2025-06-02T10:00:00Z" },
        ],
      },
      {
        id: "barber2_shop1",
        name: "Bob",
        history: [
          { totalCost: 180, services: ["Beard Trim"], date: "2025-05-30T14:00:00Z" },
          { totalCost: 220, services: ["Haircut"], date: "2025-06-01T10:00:00Z" },
          { totalCost: 150, services: ["Shave"], date: "2025-06-02T11:00:00Z" },
        ],
      },
    ],
  },
  {
    id: "shop2",
    name: "Modern Styles",
    address: { textData: "456 Oak Ave, Othercity, USA" },
    barbers: [
      {
        id: "barber1_shop2",
        name: "Charlie",
        history: [
          { totalCost: 200, services: ["Haircut"], date: "2025-05-27T09:30:00Z" },
          { totalCost: 280, services: ["Haircut", "Coloring"], date: "2025-06-01T11:00:00Z" },
          { totalCost: 180, services: ["Haircut"], date: "2025-06-02T13:00:00Z" },
        ],
      },
      {
        id: "barber2_shop2",
        name: "Diana",
        history: [
          { totalCost: 120, services: ["Trim"], date: "2025-05-29T16:00:00Z" },
          { totalCost: 180, services: ["Haircut"], date: "2025-06-01T13:00:00Z" },
          { totalCost: 250, services: ["Haircut", "Shave"], date: "2025-06-02T14:00:00Z" },
        ],
      },
    ],
  },
];

const History = ({ onClose }) => {
  // State for date filter (All, Today, ThisWeek, ThisMonth, CustomDate)
  const [filter, setFilter] = useState("All");
  // State for selected shop: "AllShops" or specific shop name
  const [selectedShop, setSelectedShop] = useState("AllShops");
  // State for selected barber: "AllBarbers" or specific barber name
  const [selectedBarber, setSelectedBarber] = useState("AllBarbers");
  // All payments flattened from dummy data
  const [allPayments, setAllPayments] = useState([]);
  // State to hold all shops data (from dummyShopsData)
  const [shops, setShops] = useState([]);

  // Menu visibility states
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [shopMenuVisible, setShopMenuVisible] = useState(false); // Only one shop menu now

  // Date picker states
  const [selectedDate, setSelectedDate] = useState(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Visualization states
  const [showVisualizations, setShowVisualizations] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [graphFlag, setGraphFlag] = useState(1); // 1: LineChart, 2: BarChart, 3: Calendar

  // Shop ID from AsyncStorage (for PDF generation, not for filtering)
  const [shopId, setShopId] = useState(null);
  // Loading state for PDF generation
  const [isLoading, setIsLoading] = useState(false);

  // Dummy function to fetch shop profile data (mimicking API call)
  const fetchShopProfile = async (id) => {
    const shopData = dummyShopsData.find((shop) => shop.id === id);
    if (!shopData) {
      // Return a default structure if shop not found, to prevent errors
      return { name: "Unknown Shop", address: { textData: "" } };
    }
    return shopData;
  };

  // Function to create and save PDF report
  const createAndSavePdf = async () => {
    try {
      setIsLoading(true);
      let currentShopData = { name: "Shop", address: { textData: "" } };

      // Determine shop data for PDF header
      if (selectedShop !== "AllShops") {
        currentShopData = await fetchShopProfile(dummyShopsData.find((s) => s.name === selectedShop)?.id);
      } else if (shopId) {
        // Fallback to the shopId from AsyncStorage if "AllShops" is selected
        currentShopData = await fetchShopProfile(shopId);
      }

      const htmlContent = generatePdfContent(filteredPayments, currentShopData);
      const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
      console.log('PDF created at', uri);

      const currentDate = format(new Date(), 'yyyy-MM-dd', { timeZone: IST_TIMEZONE });
      const fileName = `Transactions_${currentShopData.name.replace(/\s+/g, '_')}_${currentDate}.pdf`;

      if (Platform.OS === "android") {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "Download Transaction Report",
            UTI: "com.adobe.pdf",
            filename: fileName,
          });
          Alert.alert("Success", "File ready to be saved to your device.");
        } else {
          Alert.alert("Error", "Sharing is not supported on this device.");
        }
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          filename: fileName,
        });
        Alert.alert("Success", "PDF shared successfully.");
      }
    } catch (error) {
      console.error("Error creating/sharing PDF:", error);
      Alert.alert("Error", "Failed to create or save the PDF.");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to generate HTML content for PDF
  const generatePdfContent = (transactions, shopData) => {
    const currentDate = format(utcToZonedTime(new Date(), IST_TIMEZONE), 'MMMM dd, yyyy', { timeZone: IST_TIMEZONE });
    const currentTime = format(utcToZonedTime(new Date(), IST_TIMEZONE), 'HH:mm:ss', { timeZone: IST_TIMEZONE });
    const totalRevenue = transactions.reduce((sum, p) => sum + p.totalCost, 0);
    const totalCustomers = transactions.length;

    const formatAddress = (address) => {
      if (!address) return '';
      const maxLength = 30;
      let lines = [];
      let remaining = address;
      while (remaining.length > 0) {
        let breakPoint = Math.min(maxLength, remaining.length);
        if (breakPoint < remaining.length) {
          const lastSpace = remaining.substring(0, breakPoint).lastIndexOf(' ');
          if (lastSpace > 0) {
            breakPoint = lastSpace;
          }
        }
        lines.push(remaining.substring(0, breakPoint));
        remaining = remaining.substring(breakPoint).trim();
      }
      return lines.join('<br>');
    };

    const tableRows = transactions.map(payment =>
      `<tr><td>${payment.barberName}</td><td>₹${payment.totalCost}</td><td>${payment.services.join(", ")}</td><td>${payment.date} • ${payment.time}</td></tr>`
    ).join('');

    return `
      <html>
      <head>
          <style>
              body { font-family: 'Helvetica', sans-serif; padding: 20px; }
              h1 { text-align: center; color: #333; margin-bottom: 30px; }
              .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
              .shop-name { font-size: 18px; font-weight: bold; margin: 0; }
              .report-date { text-align: right; color: #666; margin: 0; }
              .shop-id { color: #666; margin: 5px 0; }
              .address { color: #666; max-width: 50%; margin: 5px 0; }
              .time-info { text-align: right; color: #666; margin: 5px 0; }
              .summary { display: flex; justify-content: space-between; margin: 30px 0; }
              .summary-card { padding: 15px; border-radius: 8px; width: 45%; }
              .revenue { background-color: #00b894; color: white; }
              .customers { background-color: #0984e3; color: white; }
              .card-title { margin: 0 0 10px 0; font-size: 16px; }
              .card-value { margin: 0; font-size: 24px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              tr:nth-child(even) { background-color: #f9f9f9; }
              .transactions-title { margin: 30px 0 10px 0; }
              .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #999; }
          </style>
      </head>
      <body>
          <h1>Transaction Report</h1>
          <div class="header-row">
              <p class="shop-name">${shopData.name}</p>
              <p class="report-date">Report Generated: ${currentDate}</p>
          </div>
          <div class="header-row">
              <div>
                  <p class="shop-id">Shop ID: ${shopId || "N/A"}</p>
                  <p class="address">${formatAddress(shopData.address.textData || '')}</p>
              </div>
              <p class="time-info">Time: ${currentTime} IST</p>
          </div>
          <div class="summary">
              <div class="summary-card revenue">
                  <h3 class="card-title">Total Revenue</h3>
                  <p class="card-value">₹${totalRevenue}</p>
              </div>
              <div class="summary-card customers">
                  <h3 class="card-title">Total Customers</h3>
                  <p class="card-value">${totalCustomers}</p>
              </div>
          </div>
          <h2 class="transactions-title">Transactions (${filter} - ${selectedShop}${selectedBarber !== "AllBarbers" ? ` - ${selectedBarber}` : ""})</h2>
          <table>
              <thead>
                  <tr>
                      <th>Barber</th>
                      <th>Amount</th>
                      <th>Services</th>
                      <th>Date & Time</th>
                  </tr>
              </thead>
              <tbody>
                  ${tableRows}
              </tbody>
          </table>
          <div class="footer">
              <p>Numbr - Automated Report</p>
          </div>
      </body>
      </html>
    `;
  };

  // Effect to fetch initial data on component focus
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          const uid = await AsyncStorage.getItem("uid");
          if (!uid) {
            console.warn("Shop ID not found in AsyncStorage. Using default for history.");
            setShopId("defaultShop123"); // Set a default ID for consistency
          } else {
            setShopId(uid);
          }

          // Set dummy shops data
          setShops(dummyShopsData);

          // Flatten all payments from dummy data
          const allHistory = dummyShopsData.reduce((acc, shop) => {
            const shopBarbers = shop.barbers.reduce((barberAcc, barber) => {
              const barberPayments = barber.history.map(entry => {
                const utcDate = new Date(entry.date);
                const istDate = utcToZonedTime(utcDate, IST_TIMEZONE);
                return {
                  ...entry,
                  shopName: shop.name, // Add shop name to payment
                  barberName: barber.name,
                  date: format(istDate, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE }),
                  time: format(istDate, 'HH:mm', { timeZone: IST_TIMEZONE }),
                  originalDate: utcDate // Keep original date for filtering
                };
              });
              return [...barberAcc, ...barberPayments];
            }, []);
            return [...acc, ...shopBarbers];
          }, []);
          setAllPayments(allHistory);
        } catch (error) {
          console.error("Error fetching data for history:", error);
        }
      };
      fetchData();
      return () => {
        console.log("History screen unfocused");
      };
    }, [])
  );

  // Helper function to check if two dates are the same day in IST
  const isSameDayIST = (date1, date2) => {
    return format(date1, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE }) === format(date2, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE });
  };

  // Function to get filtered payments based on current filters
  const getFilteredPayments = () => {
    const now = new Date();
    const todayIST = utcToZonedTime(now, IST_TIMEZONE);
    const oneWeekAgoIST = new Date(todayIST);
    oneWeekAgoIST.setDate(todayIST.getDate() - 7);
    const oneMonthAgoIST = new Date(todayIST);
    oneMonthAgoIST.setMonth(todayIST.getMonth() - 1);

    return allPayments.filter(payment => {
      const istPaymentDate = utcToZonedTime(payment.originalDate, IST_TIMEZONE);

      // Apply date filters
      if (filter === "Today" && !isSameDayIST(istPaymentDate, todayIST)) return false;
      if (filter === "ThisWeek" && istPaymentDate < oneWeekAgoIST) return false;
      if (filter === "ThisMonth" && istPaymentDate < oneMonthAgoIST) return false;
      if (selectedDate) {
        const selectedIST = utcToZonedTime(new Date(selectedDate), IST_TIMEZONE);
        if (!isSameDayIST(istPaymentDate, selectedIST)) return false;
      }

      // Apply shop filter
      if (selectedShop !== "AllShops" && payment.shopName !== selectedShop) return false;

      // Apply barber filter
      // If a specific shop is selected AND a specific barber is selected for that shop
      if (selectedShop !== "AllShops" && selectedBarber !== "AllBarbers" && payment.barberName !== selectedBarber) return false;
      // If "AllShops" is selected, but a specific barber is picked (meaning that barber across all shops)
      if (selectedShop === "AllShops" && selectedBarber !== "AllBarbers" && payment.barberName !== selectedBarber) return false;

      return true;
    });
  };

  // Handler for date selection from date picker
  const handleDateSelect = (params) => {
    if (params.date) {
      const selectedIST = utcToZonedTime(params.date, IST_TIMEZONE);
      setSelectedDate(selectedIST.toISOString());
      setFilter("CustomDate");
    }
    setDatePickerVisible(false);
  };

  // Calendar Navigation handlers
  const previousMonth = () => {
    const newDate = new Date(calendarMonth);
    newDate.setMonth(calendarMonth.getMonth() - 1);
    setCalendarMonth(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(calendarMonth);
    newDate.setMonth(calendarMonth.getMonth() + 1);
    setCalendarMonth(newDate);
  };

  // Generate Business Activity Heat Map Data for Calendar
  const getBusinessActivityData = () => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const dailyTransactions = {};

    let filteredForCalendar = allPayments;
    // Apply shop and barber filters to calendar data
    if (selectedShop !== "AllShops") {
      filteredForCalendar = filteredForCalendar.filter(p => p.shopName === selectedShop);
    }
    if (selectedBarber !== "AllBarbers") {
      filteredForCalendar = filteredForCalendar.filter(p => p.barberName === selectedBarber);
    }

    filteredForCalendar.forEach(payment => {
      const paymentDate = payment.date; // already in 'yyyy-MM-dd' format
      if (dailyTransactions[paymentDate]) {
        dailyTransactions[paymentDate].count += 1;
        dailyTransactions[paymentDate].revenue += payment.totalCost;
      } else {
        dailyTransactions[paymentDate] = { count: 1, revenue: payment.totalCost };
      }
    });

    const counts = Object.values(dailyTransactions).map(day => day.count);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;

    return { dailyData: dailyTransactions, maxCount: maxCount, daysInMonth: daysInMonth, monthStart: monthStart };
  };

  // Get color intensity for calendar cells based on activity count
  const getColorIntensity = (count, maxCount) => {
    if (!count) return '#f5f5f5'; // Light grey for no activity
    const intensity = Math.max(0.2, Math.min(1, count / maxCount)); // Scale from 0.2 to 1

    // Interpolate between light green and dark green
    // Using a more distinct gradient for better visual separation
    const r = Math.floor(255 - (200 * intensity));
    const g = Math.floor(255 - (100 * intensity));
    const b = Math.floor(255 - (200 * intensity));
    return `rgb(${r},${g},${b})`;
  };

  // Get currently filtered payments
  const filteredPayments = getFilteredPayments();
  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.totalCost, 0);
  const totalCustomers = filteredPayments.length;

  // Prepare data for Barber Contribution Bar Chart
  const getBarberContributionData = () => {
    const revenueData = {};
    // Get all barbers from the selected shop, or all barbers if "AllShops" is selected
    let relevantBarbers = [];
    if (selectedShop === "AllShops") {
      relevantBarbers = shops.flatMap(shop => shop.barbers);
    } else {
      const currentShop = shops.find(s => s.name === selectedShop);
      if (currentShop) {
        relevantBarbers = currentShop.barbers;
      }
    }

    relevantBarbers.forEach(b => {
      revenueData[b.name] = 0;
    });

    filteredPayments.forEach(payment => {
      revenueData[payment.barberName] = (revenueData[payment.barberName] || 0) + payment.totalCost;
    });

    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC926', '#1982C4', '#6A4C93', '#F94144'];
    return Object.entries(revenueData).map(([name, revenue], index) => ({
      name,
      revenue,
      color: colors[index % colors.length],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    }));
  };

  // Prepare data for Revenue Timeline Line Chart
  const getRevenueTimelineData = () => {
    const now = new Date();
    const todayIST = utcToZonedTime(now, IST_TIMEZONE);

    let dateKeys = [];
    if (filter === "Today" || filter === "CustomDate") {
      dateKeys = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    } else if (filter === "ThisWeek") {
      dateKeys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    } else if (filter === "ThisMonth" || filter === "All") {
      const daysInMonth = new Date(todayIST.getFullYear(), todayIST.getMonth() + 1, 0).getDate();
      dateKeys = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
    }

    const dailyRevenue = {};
    const dailyCompare = {};
    dateKeys.forEach(key => {
      dailyRevenue[key] = 0;
      dailyCompare[key] = 0;
    });

    filteredPayments.forEach(payment => {
      const paymentDate = utcToZonedTime(payment.originalDate, IST_TIMEZONE);
      let dateKey;
      if (filter === "Today" || filter === "CustomDate") {
        dateKey = format(paymentDate, 'HH:00', { timeZone: IST_TIMEZONE });
      } else if (filter === "ThisWeek") {
        dateKey = format(paymentDate, 'EEE', { timeZone: IST_TIMEZONE });
      } else if (filter === "ThisMonth" || filter === "All") {
        dateKey = format(paymentDate, 'dd', { timeZone: IST_TIMEZONE });
      }
      if (dailyRevenue[dateKey] !== undefined) {
        dailyRevenue[dateKey] += payment.totalCost;
      }
    });

    // Calculate data for previous period comparison
    const previousPeriodPayments = allPayments.filter(payment => {
      const istPaymentDate = utcToZonedTime(payment.originalDate, IST_TIMEZONE);
      if (selectedShop !== "AllShops" && payment.shopName !== selectedShop) return false;
      if (selectedBarber !== "AllBarbers" && payment.barberName !== selectedBarber) return false;

      if (filter === "Today") {
        const yesterdayIST = new Date(todayIST);
        yesterdayIST.setDate(todayIST.getDate() - 1);
        return isSameDayIST(istPaymentDate, yesterdayIST);
      } else if (filter === "ThisWeek") {
        const oneWeekAgoIST = new Date(todayIST);
        oneWeekAgoIST.setDate(todayIST.getDate() - 7);
        const twoWeeksAgoIST = new Date(todayIST);
        twoWeeksAgoIST.setDate(todayIST.getDate() - 14);
        return istPaymentDate >= twoWeeksAgoIST && istPaymentDate < oneWeekAgoIST;
      } else if (filter === "ThisMonth") {
        const oneMonthAgoIST = new Date(todayIST);
        oneMonthAgoIST.setMonth(todayIST.getMonth() - 1);
        const twoMonthsAgoIST = new Date(todayIST);
        twoMonthsAgoIST.setMonth(todayIST.getMonth() - 2);
        return istPaymentDate >= twoMonthsAgoIST && istPaymentDate < oneMonthAgoIST;
      }
      return false;
    });

    previousPeriodPayments.forEach(payment => {
      const paymentDate = utcToZonedTime(payment.originalDate, IST_TIMEZONE);
      let dateKey;
      if (filter === "Today" || filter === "CustomDate") {
        dateKey = format(paymentDate, 'HH:00', { timeZone: IST_TIMEZONE });
      } else if (filter === "ThisWeek") {
        dateKey = format(paymentDate, 'EEE', { timeZone: IST_TIMEZONE });
      } else if (filter === "ThisMonth" || filter === "All") {
        dateKey = format(paymentDate, 'dd', { timeZone: IST_TIMEZONE });
      }
      if (dateKey && dailyCompare[dateKey] !== undefined) {
        dailyCompare[dateKey] += payment.totalCost;
      }
    });

    const displayedKeys = dateKeys.filter(key => dailyRevenue[key] > 0 || dailyCompare[key] > 0);
    if (displayedKeys.length === 0 && dateKeys.length > 0) {
      // Ensure at least one label if no data, to avoid chart errors
      displayedKeys.push(dateKeys[0]);
      dailyRevenue[dateKeys[0]] = 0;
      dailyCompare[dateKeys[0]] = 0;
    }

    return {
      labels: displayedKeys,
      datasets: [
        {
          data: displayedKeys.map(key => dailyRevenue[key]),
          color: (opacity = 1) => `rgba(0,184,148,${opacity})`, // Current Period Color (Green)
          strokeWidth: 2
        },
        {
          data: displayedKeys.map(key => dailyCompare[key] || 0),
          color: (opacity = 1) => `rgba(9,132,227,${opacity})`, // Previous Period Color (Blue)
          strokeWidth: 2,
          strokeDashArray: [5, 5] // Dashed line for previous period
        }
      ],
      legend: ["Current Period", "Previous Period"]
    };
  };

  // Navigation handlers for the graphs using wrap-around logic
  const handleLeft = () => {
    setGraphFlag(prev => (prev === 1 ? 3 : prev - 1));
  };

  const handleRight = () => {
    setGraphFlag(prev => (prev === 3 ? 1 : prev + 1));
  };

  // Prepare data for visualizations
  const barberContributionData = getBarberContributionData();
  const revenueTimelineData = getRevenueTimelineData();
  const businessActivityData = getBusinessActivityData();

  // Render calendar view
  const renderCalendar = () => {
    const { dailyData, maxCount, daysInMonth, monthStart } = businessActivityData;
    const firstDayOfMonth = getDay(monthStart); // 0 for Sunday, 1 for Monday, etc.
    const emptyStartCells = Array(firstDayOfMonth).fill(null); // Fill leading empty cells for calendar grid
    const allCells = [...emptyStartCells, ...daysInMonth];

    const weeks = [];
    for (let i = 0; i < allCells.length; i += 7) {
      weeks.push(allCells.slice(i, i + 7));
    }

    return (
      <View style={styles.calendarInnerContainer}>
        {/* Calendar Header with navigation buttons */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={previousMonth} style={styles.calendarNavButton}>
            <Text style={styles.calendarNavButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>{format(calendarMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.calendarNavButton}>
            <Text style={styles.calendarNavButtonText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Days of the week header */}
        <View style={styles.calendarDaysHeader}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <Text key={day} style={styles.calendarDayHeaderText}>{day}</Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {weeks.map((week, weekIndex) => (
            <View key={`week-${weekIndex}`} style={styles.calendarRow}>
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                const day = week[dayIndex];
                if (!day) {
                  return <View key={`empty-${dayIndex}`} style={styles.calendarEmptyCell} />;
                }
                const dateString = format(day, 'yyyy-MM-dd');
                const dayData = dailyData[dateString];
                const backgroundColor = getColorIntensity(dayData ? dayData.count : 0, maxCount);
                return (
                  <TouchableOpacity
                    key={`day-${dateString}`}
                    style={[styles.calendarCell, { backgroundColor }]}
                    onPress={() => {
                      setSelectedDate(day.toISOString());
                      setFilter("CustomDate");
                    }}
                  >
                    <Text style={styles.calendarDayText}>{getDate(day)}</Text>
                    {dayData && <Text style={styles.calendarDayCount}>{dayData.count}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Calendar Legend */}
        <View style={styles.calendarLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#f5f5f5' }]} />
            <Text style={styles.legendText}>No activity</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#c5e1a5' }]} />
            <Text style={styles.legendText}>Low</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#8bc34a' }]} />
            <Text style={styles.legendText}>Medium</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#003B23' }]} />
            <Text style={styles.legendText}>High</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground
      source={require("../../app/image/bglogin.png")} // Adjusted path for assets
      style={styles.backgroundImage}
    >
      <View style={styles.overlay} />
      <Provider>
        <View style={styles.fullscreenContainer}>
          {/* Fixed Header with Close Button */}
          <View style={styles.fixedHeader}>
            <Text style={styles.headerTitle}>STATISTICS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close-circle" size={30} color="#2d3436" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollableContent}
            contentContainerStyle={styles.scrollContentContainer}
          >
            {/* Filter and Visualize Controls */}
            <View style={styles.outerContainer}>
              <View style={styles.filterGroup}>
                {/* Date Filter */}
                <Menu
                  visible={filterMenuVisible}
                  onDismiss={() => setFilterMenuVisible(false)}
                  anchor={
                    <TouchableOpacity onPress={() => setFilterMenuVisible(true)} style={styles.filterButton}>
                      <Text style={styles.filterButtonText}>📅 {filter}</Text>
                    </TouchableOpacity>
                  }
                >
                  {["All", "Today", "ThisWeek", "ThisMonth", "CustomDate"].map(f => (
                    <Menu.Item
                      key={f}
                      onPress={() => {
                        setFilter(f);
                        setFilterMenuVisible(false);
                        if (f === "CustomDate") setDatePickerVisible(true);
                      }}
                      title={f}
                    />
                  ))}
                </Menu>

                {/* Shop and Barber Filter (Combined Dropdown) */}
                <Menu
                  visible={shopMenuVisible}
                  onDismiss={() => setShopMenuVisible(false)}
                  anchor={
                    <TouchableOpacity onPress={() => setShopMenuVisible(true)} style={styles.filterButton}>
                      <Text style={styles.filterButtonText}>
                        🏢 {selectedShop === "AllShops" ? "All Shops" : selectedShop}
                        {selectedShop !== "AllShops" && selectedBarber !== "AllBarbers" ? ` / ${selectedBarber}` : ""}
                      </Text>
                    </TouchableOpacity>
                  }
                >
                  {/* Option for All Shops (overall) */}
                  <Menu.Item
                    onPress={() => {
                      setSelectedShop("AllShops");
                      setSelectedBarber("AllBarbers"); // Reset barber when "All Shops" is chosen
                      setShopMenuVisible(false);
                    }}
                    title="All Shops"
                  />
                  {/* Iterate through each shop */}
                  {shops.map(shop => (
                    <View key={shop.id}>
                      {/* Menu Item for the specific shop */}
                      <Menu.Item
                        onPress={() => {
                          setSelectedShop(shop.name);
                          setSelectedBarber("AllBarbers"); // Select "All Barbers" for this shop by default
                          setShopMenuVisible(false);
                        }}
                        title={`• ${shop.name}`} // Shop name, slightly indented
                        style={styles.shopMenuItem}
                      />
                      {/* Option for All Barbers within this specific shop */}
                      <Menu.Item
                        onPress={() => {
                          setSelectedShop(shop.name);
                          setSelectedBarber("AllBarbers");
                          setShopMenuVisible(false);
                        }}
                        title={`    - All Barbers`} // Indented for sub-option
                        style={styles.barberMenuItem}
                      />
                      {/* Iterate through barbers of the current shop */}
                      {shop.barbers.map(barber => (
                        <Menu.Item
                          key={barber.id}
                          onPress={() => {
                            setSelectedShop(shop.name); // Ensure the shop is also set
                            setSelectedBarber(barber.name);
                            setShopMenuVisible(false);
                          }}
                          title={`    - ${barber.name}`} // Indented for sub-option
                          style={styles.barberMenuItem}
                        />
                      ))}
                    </View>
                  ))}
                </Menu>
              </View>

              {/* Visualize Toggle */}
              <View style={styles.visualizeGroup}>
                <Text style={styles.toggleLabel}>Visualize</Text>
                <Switch
                  value={showVisualizations}
                  onValueChange={setShowVisualizations}
                  trackColor={{ false: "rgb(0,0,0)", true: "#0984e3" }}
                  thumbColor={showVisualizations ? "#ffffff" : "#f4f3f4"}
                />
              </View>
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={[styles.summaryCard, styles.revenueCard]}>
                <Text style={styles.summaryTitle}>Total Revenue</Text>
                <Text style={styles.summaryValue}>₹{totalRevenue}</Text>
              </View>
              <View style={[styles.summaryCard, styles.customersCard]}>
                <Text style={styles.summaryTitle}>Total Customers</Text>
                <Text style={styles.summaryValue}>{totalCustomers}</Text>
              </View>
            </View>

            {/* Date Picker Modal */}
            <DatePickerModal
              locale="en"
              mode="single"
              visible={datePickerVisible}
              onDismiss={() => setDatePickerVisible(false)}
              date={selectedDate ? new Date(selectedDate) : undefined}
              onConfirm={handleDateSelect}
            />

            {/* Visualizations Section */}
            {showVisualizations && (
              <View>
                <View style={styles.chartContainer}>
                  {graphFlag === 1 && filteredPayments.length > 0 && (
                    <>
                      <Text style={styles.revenueText}>Revenue Timeline</Text>
                      <LineChart
                        data={revenueTimelineData}
                        width={screenWidth * 0.9}
                        height={300}
                        chartConfig={{
                          backgroundColor: '#ffffff',
                          backgroundGradientFrom: '#ffffff',
                          backgroundGradientTo: '#ffffff',
                          decimalPlaces: 0,
                          color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
                          labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,
                          style: { borderRadius: 16 },
                          propsForDots: { r: "5", strokeWidth: "2", stroke: "#ffa726" },
                          propsForLabels: { fontSize: 10 },
                        }}
                        bezier
                        style={[styles.chart, { marginLeft: -10 }]}
                        yAxisLabel="₹"
                        yAxisInterval={1}
                        verticalLabelRotation={30}
                        segments={5}
                      />
                    </>
                  )}
                  {graphFlag === 2 && barberContributionData.length > 0 && (
                    <>
                      <Text style={styles.revenueText}>Barber Contribution</Text>
                      <View style={styles.centeredChartContainer}>
                        <BarChart
                          data={{
                            labels: barberContributionData.map(item => item.name),
                            datasets: [{ data: barberContributionData.map(item => item.revenue) }]
                          }}
                          width={screenWidth * 0.9}
                          height={350}
                          fromZero
                          verticalLabelRotation={50}
                          chartConfig={{
                            backgroundColor: '#ffffff',
                            backgroundGradientFrom: '#ffffff',
                            backgroundGradientTo: '#ffffff',
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(34,128,176,${opacity})`,
                            labelColor: (opacity = 1) => `rgba(34,34,34,${opacity})`,
                            style: { borderRadius: 16 },
                          }}
                          style={styles.chart}
                        />
                      </View>
                    </>
                  )}
                  {graphFlag === 3 && (
                    <View style={styles.calendarWrapper}>
                      <Text style={styles.revenueText}>Business Activity Heatmap</Text>
                      {renderCalendar()}
                    </View>
                  )}
                  {/* Message when no data for charts */}
                  {filteredPayments.length === 0 && (graphFlag === 1 || graphFlag === 2) && (
                    <Text style={styles.noChartDataText}>No data available for this chart with current filters.</Text>
                  )}
                </View>

                {/* Chart Navigation */}
                <View style={styles.navigationContainer}>
                  <TouchableOpacity onPress={handleLeft} style={styles.navButton}>
                    <Text style={styles.navButtonText}>{"<"}</Text>
                  </TouchableOpacity>
                  <View style={styles.paginationContainer}>
                    {[1, 2, 3].map((value, index) => (
                      <View
                        key={index}
                        style={[styles.paginationDot, graphFlag === value && styles.paginationDotActive]}
                      />
                    ))}
                  </View>
                  <TouchableOpacity onPress={handleRight} style={styles.navButton}>
                    <Text style={styles.navButtonText}>{">"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Recent Transactions Section */}
            <View style={styles.controlsContainer}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity
                style={styles.buttonContainer}
                onPress={createAndSavePdf}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={["#e63946", "#d62828"]}
                  style={styles.pdfButton}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <MaterialCommunityIcons name="file-export" size={25} color="white" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.recentTransactionsContainer}>
              <ScrollView style={styles.recentTransactionsScroll} nestedScrollEnabled={true}>
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((payment, index) => (
                    <View key={index} style={styles.transactionCard}>
                      <View style={styles.transactionHeader}>
                        <Text style={styles.barberName}>{payment.barberName} ({payment.shopName})</Text>
                        <Text style={styles.transactionAmount}>₹{payment.totalCost}</Text>
                      </View>
                      <Text style={styles.servicesList}>{payment.services.join(", ")}</Text>
                      <Text style={styles.transactionDate}>{payment.date} • {payment.time} IST</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noTransactionsText}>No transactions found for the selected filters.</Text>
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </Provider>
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
    backgroundColor: "rgba(237,236,236,0.77)",
  },
  fullscreenContainer: {
    flex: 1,
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
  },
  fixedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 40 : 50, // Adjust for status bar padding
    paddingBottom: 15,
    backgroundColor: "rgba(237,236,236,0.9)", // Semi-transparent header
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    position: "relative",
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#2d3436",
    textAlign: "center",
    flex: 1, // Allow text to take available space
  },
  closeButton: {
    position: "absolute",
    right: 20,
    top: Platform.OS === "android" ? 45 : 55, // Align with header content
    zIndex: 11,
  },
  scrollableContent: {
    flex: 1,
    padding: 16,
  },
  scrollContentContainer: {
    paddingBottom: 20, // Add some padding at the bottom
  },
  buttonContainer: {
    borderRadius: 15,
    overflow: "hidden",
  },
  pdfButton: {
    padding: 7,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    width: 40,
    height: 40,
  },
  recentTransactionsContainer: {
    maxHeight: 550, // Max height for the container
    backgroundColor: "#ffffff",
    borderRadius: 12, // More rounded corners
    padding: 15, // Increased padding
    elevation: 4, // More prominent shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    marginBottom: 20,
  },
  recentTransactionsScroll: {
    maxHeight: 450, // Max height for the scrollable content within the container
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 5, // Adjusted padding
    marginBottom: 15, // Increased margin
  },
  sectionTitle: {
    fontSize: 22, // Larger font size
    fontWeight: "bold",
    color: "#333",
  },
  outerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 0,
    marginBottom: 20,
  },
  filterGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: 'wrap', // Allow filters to wrap to next line if needed
    rowGap: 10, // Spacing between rows if they wrap
    columnGap: 10, // Spacing between columns
    flexShrink: 1, // Allow shrinking
  },
  filterButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: "#ffffff",
    borderRadius: 10, // More rounded corners
    alignItems: "center",
    elevation: 3, // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  filterButtonText: {
    color: "#2d3436",
    fontWeight: "600", // Slightly bolder
    fontSize: 15,
  },
  shopMenuItem: {
    paddingLeft: 10, // Slightly indent shop names
  },
  barberMenuItem: {
    paddingLeft: 30, // Indent barber names more to show hierarchy
  },
  visualizeGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleLabel: {
    fontWeight: "900",
    marginRight: 8,
    color: "#333",
    fontSize: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10, // Spacing between cards
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 20, // Increased padding
    borderRadius: 12, // More rounded corners
    elevation: 4, // More prominent shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  revenueCard: {
    backgroundColor: '#00b894', // Green
  },
  customersCard: {
    backgroundColor: '#0984e3', // Blue
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 17, // Slightly larger
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 28, // Larger value font
    fontWeight: 'bold',
    textAlign: 'center',
  },
  chartContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 15, // Increased padding
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  revenueText: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15, // Increased margin
    color: "#333",
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  centeredChartContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  navButton: {
    padding: 10,
    backgroundColor: "#ddd",
    borderRadius: 8, // Rounded buttons
    elevation: 2,
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#555",
  },
  paginationContainer: {
    flexDirection: "row",
  },
  paginationDot: {
    width: 10, // Slightly larger dots
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ccc",
    marginHorizontal: 5,
  },
  paginationDotActive: {
    backgroundColor: "#888",
  },
  calendarWrapper: {
    width: "100%",
    padding: 10,
  },
  calendarInnerContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  calendarNavButton: {
    padding: 8,
  },
  calendarNavButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  calendarDaysHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  calendarDayHeaderText: {
    fontWeight: "bold",
    width: `${100 / 7}%`,
    textAlign: "center",
    color: "#555",
  },
  calendarGrid: {
    width: "100%",
  },
  calendarRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 2,
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#eee",
    borderRadius: 5,
  },
  calendarEmptyCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  calendarDayCount: {
    fontSize: 10,
    color: "#666",
  },
  calendarLegend: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 5,
    marginBottom: 5,
  },
  legendColor: {
    width: 15,
    height: 15,
    borderRadius: 3,
    marginRight: 5,
    borderWidth: 0.5,
    borderColor: "#ccc",
  },
  legendText: {
    fontSize: 12,
    color: "#555",
  },
  transactionCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10, // More rounded
    padding: 15,
    marginBottom: 10,
    elevation: 2, // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  barberName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00b894", // Green for amount
  },
  servicesList: {
    fontSize: 14,
    color: "#555",
    marginBottom: 5,
  },
  transactionDate: {
    fontSize: 12,
    color: "#777",
    textAlign: "right",
  },
  noTransactionsText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  noChartDataText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 20,
  }
});

export default History;
