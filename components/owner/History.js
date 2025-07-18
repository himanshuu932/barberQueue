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
  ActivityIndicator,
  PixelRatio,
  Icon
} from "react-native";
import { Menu, Provider } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";
import { format, utcToZonedTime } from 'date-fns-tz';
import { registerTranslation } from "react-native-paper-dates";
import { en } from 'react-native-paper-dates';
import { BarChart, LineChart } from "react-native-chart-kit";
import { startOfMonth, endOfMonth, eachDayOfInterval, getDate, getDay } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";


// --- CONFIGURATION ---

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

registerTranslation('en', en);

const IST_TIMEZONE = 'Asia/Kolkata';

// --- CONFIGURATION ---
const API_BASE_URL = 'http://10.0.2.2:5000';

const History = ({ onClose }) => {
  // Filter States
  const [filter, setFilter] = useState("All");
  const [selectedShop, setSelectedShop] = useState("AllShops");
  const [selectedBarber, setSelectedBarber] = useState("AllBarbers");
  const [dateRange, setDateRange] = useState({ startDate: undefined, endDate: undefined });


  // Data States
  const [allPayments, setAllPayments] = useState([]);
  const [shops, setShops] = useState([]);

  // UI Control States
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [shopMenuVisible, setShopMenuVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [showVisualizations, setShowVisualizations] = useState(false);
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
      console.log("Fetched Shops:", fetchedShops);
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

  useFocusEffect(
    React.useCallback(() => {
      fetchHistoryData();
    }, [fetchHistoryData])
  );

  const getFilteredPayments = () => {
    const now = new Date();
    const todayIST = utcToZonedTime(now, IST_TIMEZONE);
    const oneWeekAgoIST = new Date(todayIST);
    oneWeekAgoIST.setDate(todayIST.getDate() - 7);
    const oneMonthAgoIST = new Date(todayIST);
    oneMonthAgoIST.setMonth(todayIST.getMonth() - 1);

    return allPayments.filter(payment => {
      const istPaymentDate = utcToZonedTime(payment.originalDate, IST_TIMEZONE);

      if (filter === "Today" && !isSameDayIST(istPaymentDate, todayIST)) return false;
      if (filter === "ThisWeek" && istPaymentDate < oneWeekAgoIST) return false;
      if (filter === "ThisMonth" && istPaymentDate < oneMonthAgoIST) return false;

      if (filter === "CustomRange" && dateRange.startDate && dateRange.endDate) {
        const paymentTime = istPaymentDate.getTime();
        const startTime = new Date(dateRange.startDate).getTime();
        const endOfDay = new Date(dateRange.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        const endTime = endOfDay.getTime();
        if (paymentTime < startTime || paymentTime > endTime) return false;
      }

      if (selectedShop !== "AllShops" && payment.shopName !== selectedShop) return false;
      if (selectedBarber !== "AllBarbers" && payment.barberName !== selectedBarber) return false;

      return true;
    });
  };

  const isSameDayIST = (date1, date2) => {
    return format(date1, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE }) === format(date2, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE });
  };

  const createAndSavePdf = async () => {
    setIsPdfLoading(true);
    try {
      const filtered = getFilteredPayments();
      let shopData = { name: "All Shops", address: { textData: "Multiple Locations" } };

      // --- FINAL FIX: Find the shop from the main 'shops' state. ---
      // This ensures we get the correct address even if there are no transactions for the selected period.
      if (selectedShop !== "AllShops") {
        const currentShop = shops.find(s => s.name === selectedShop);
        if (currentShop) {
          shopData = { 
            name: currentShop.name, 
            address: { textData: currentShop.address?.fullDetails || 'No address provided' } 
          };
        } else {
          // Fallback if the shop isn't found (unlikely but safe)
          shopData = {
            name: selectedShop,
            address: { textData: 'Address not found' }
          };
        }
      }

      const htmlContent = generatePdfContent(filtered, shopData);
      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      const currentDate = format(new Date(), 'yyyy-MM-dd', { timeZone: IST_TIMEZONE });
      const fileName = `Transactions_${shopData.name.replace(/\s+/g, '_')}_${currentDate}.pdf`;

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
      setIsPdfLoading(false);
    }
  };

  const generatePdfContent = (transactions, shopData) => {
    const currentDate = format(utcToZonedTime(new Date(), IST_TIMEZONE), 'MMMM dd, yyyy', { timeZone: IST_TIMEZONE });
    const currentTime = format(utcToZonedTime(new Date(), IST_TIMEZONE), 'HH:mm:ss', { timeZone: IST_TIMEZONE });
    const totalRevenue = transactions.reduce((sum, p) => sum + p.totalCost, 0);
    const totalCustomers = transactions.length;

    const formatAddress = (address) => {
      if (!address) return '';
      const maxLength = 40;
      let lines = [];
      let remaining = address;
      while (remaining.length > 0) {
        let breakPoint = Math.min(maxLength, remaining.length);
        if (breakPoint < remaining.length) {
          const lastSpace = remaining.substring(0, breakPoint).lastIndexOf(' ');
          if (lastSpace > -1) {
            breakPoint = lastSpace;
          }
        }
        lines.push(remaining.substring(0, breakPoint));
        remaining = remaining.substring(breakPoint).trim();
      }
      return lines.join('<br>');
    };

    const tableRows = transactions.map(payment =>
      `<tr><td>${payment.barberName}</td><td>₹${payment.totalCost}</td><td>${(payment.services || []).map(s => s.name).join(", ")}</td><td>${payment.date} • ${payment.time}</td></tr>`
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
              .shop-id { color: #666; margin: 5px 0; font-weight: bold; }
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
                  <p class="shop-id">Shop Address</p>
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
          <h2 class="transactions-title">Transactions (${getFilterDisplayName()} - ${selectedShop}${selectedBarber !== "AllBarbers" ? ` - ${selectedBarber}` : ""})</h2>
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

  const handleRangeConfirm = ({ startDate, endDate }) => {
    setDatePickerVisible(false);
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
      setFilter("CustomRange");
    }
  };


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

  const getBusinessActivityData = () => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const dailyTransactions = {};

    let filteredForCalendar = allPayments;
    if (selectedShop !== "AllShops") {
      filteredForCalendar = filteredForCalendar.filter(p => p.shopName === selectedShop);
    }
    if (selectedBarber !== "AllBarbers") {
      filteredForCalendar = filteredForCalendar.filter(p => p.barberName === selectedBarber);
    }

    filteredForCalendar.forEach(payment => {
      const paymentDate = payment.date;
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

  const getColorIntensity = (count, maxCount) => {
    if (!count) return '#f5f5f5';
    const intensity = Math.max(0.2, Math.min(1, count / maxCount));
    const r = Math.floor(255 - (200 * intensity));
    const g = Math.floor(255 - (100 * intensity));
    const b = Math.floor(255 - (200 * intensity));
    return `rgb(${r},${g},${b})`;
  };

  const handleLeft = () => {
    setGraphFlag(prev => (prev === 1 ? 3 : prev - 1));
  };

  const handleRight = () => {
    setGraphFlag(prev => (prev === 3 ? 1 : prev + 1));
  };

  const getBarberContributionData = () => {
    const revenueData = {};
    let relevantBarbers = [];
    if (selectedShop === "AllShops") {
      relevantBarbers = shops.flatMap(shop => shop.barbers || []);
    } else {
      const currentShop = shops.find(s => s.name === selectedShop);
      if (currentShop) {
        relevantBarbers = currentShop.barbers || [];
      }
    }

    relevantBarbers.forEach(b => {
      revenueData[b.name] = 0;
    });

    const filteredPayments = getFilteredPayments();
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

  const getRevenueTimelineData = () => {
    const now = new Date();
    const todayIST = utcToZonedTime(now, IST_TIMEZONE);

    let dateKeys = [];
    if (filter === "Today" || filter === "CustomRange") {
      dateKeys = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    } else if (filter === "ThisWeek") {
      dateKeys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    } else { // ThisMonth or All
      const daysInMonth = new Date(todayIST.getFullYear(), todayIST.getMonth() + 1, 0).getDate();
      dateKeys = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
    }

    const dailyRevenue = {};
    const dailyCompare = {};
    dateKeys.forEach(key => {
      dailyRevenue[key] = 0;
      dailyCompare[key] = 0;
    });

    const filteredPayments = getFilteredPayments();
    filteredPayments.forEach(payment => {
      const paymentDate = utcToZonedTime(payment.originalDate, IST_TIMEZONE);
      let dateKey;
      if (filter === "Today" || filter === "CustomRange") {
        dateKey = format(paymentDate, 'HH:00', { timeZone: IST_TIMEZONE });
      } else if (filter === "ThisWeek") {
        dateKey = format(paymentDate, 'EEE', { timeZone: IST_TIMEZONE });
      } else { // ThisMonth or All
        dateKey = format(paymentDate, 'dd', { timeZone: IST_TIMEZONE });
      }
      if (dailyRevenue[dateKey] !== undefined) {
        dailyRevenue[dateKey] += payment.totalCost;
      }
    });

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
      if (filter === "Today" || filter === "CustomRange") {
        dateKey = format(paymentDate, 'HH:00', { timeZone: IST_TIMEZONE });
      } else if (filter === "ThisWeek") {
        dateKey = format(paymentDate, 'EEE', { timeZone: IST_TIMEZONE });
      } else { // ThisMonth or All
        dateKey = format(paymentDate, 'dd', { timeZone: IST_TIMEZONE });
      }
      if (dateKey && dailyCompare[dateKey] !== undefined) {
        dailyCompare[dateKey] += payment.totalCost;
      }
    });

    const displayedKeys = dateKeys.filter(key => dailyRevenue[key] > 0 || dailyCompare[key] > 0);
    if (displayedKeys.length === 0 && dateKeys.length > 0) {
      displayedKeys.push(dateKeys[0]);
      dailyRevenue[dateKeys[0]] = 0;
      dailyCompare[dateKeys[0]] = 0;
    }

    return {
      labels: displayedKeys,
      datasets: [
        {
          data: displayedKeys.map(key => dailyRevenue[key]),
          color: (opacity = 1) => `rgba(0,184,148,${opacity})`,
          strokeWidth: 2
        },
        {
          data: displayedKeys.map(key => dailyCompare[key] || 0),
          color: (opacity = 1) => `rgba(9,132,227,${opacity})`,
          strokeWidth: 2,
          strokeDashArray: [5, 5]
        }
      ],
      legend: ["Current Period", "Previous Period"]
    };
  };

  const renderCalendar = () => {
    const { dailyData, maxCount, daysInMonth, monthStart } = getBusinessActivityData();
    const firstDayOfMonth = getDay(monthStart);
    const emptyStartCells = Array(firstDayOfMonth).fill(null);
    const allCells = [...emptyStartCells, ...daysInMonth];

    const weeks = [];
    for (let i = 0; i < allCells.length; i += 7) {
      weeks.push(allCells.slice(i, i + 7));
    }

    return (
      <View style={styles.calendarInnerContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={previousMonth} style={styles.calendarNavButton}>
            <Text style={styles.calendarNavButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>{format(calendarMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.calendarNavButton}>
            <Text style={styles.calendarNavButtonText}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calendarDaysHeader}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <Text key={day} style={styles.calendarDayHeaderText}>{day}</Text>
          ))}
        </View>

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
                        setDateRange({ startDate: day, endDate: day });
                        setFilter("CustomRange");
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
  
  const getFilterDisplayName = () => {
      if (filter === 'CustomRange' && dateRange.startDate && dateRange.endDate) {
          const start = format(new Date(dateRange.startDate), 'MMM d');
          const end = format(new Date(dateRange.endDate), 'MMM d');
          if (start === end) return start;
          return `${start} - ${end}`;
      }
      if (filter === 'ThisWeek') return 'This Week';
      if (filter === 'ThisMonth') return 'This Month';
      return filter;
  };


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
  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.totalCost, 0);
  const totalCustomers = filteredPayments.length;
  const barberContributionData = getBarberContributionData();
  const revenueTimelineData = getRevenueTimelineData();

  return (
    <ImageBackground
      source={require("../../app/image/bglogin.png")}
      style={styles.backgroundImage}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Numbr</Text>
      </View>
      <View style={styles.overlay} />
      <Provider>
        <View style={styles.fullscreenContainer}>
          <ScrollView
            style={styles.scrollableContent}
            contentContainerStyle={styles.scrollContentContainer}
          >
            <View style={styles.fixedHeader}>
              <Text style={styles.headerTitle}>STATISTICS</Text>
            </View>

            <View style={styles.outerContainer}>
              <View style={styles.filterGroup}>
                <Menu
                  visible={filterMenuVisible}
                  onDismiss={() => setFilterMenuVisible(false)}
                  anchor={
                    <TouchableOpacity onPress={() => setFilterMenuVisible(true)} style={styles.filterButton}>
                      <Text style={styles.filterButtonText}>📅 {getFilterDisplayName()}</Text>
                    </TouchableOpacity>
                  }
                >
                  {["All", "Today", "ThisWeek", "ThisMonth", "CustomRange"].map(f => (
                    <Menu.Item
                      key={f}
                      onPress={() => {
                        if (f !== "CustomRange") {
                          setDateRange({ startDate: undefined, endDate: undefined });
                        }
                        setFilter(f);
                        setFilterMenuVisible(false);
                        if (f === "CustomRange") setDatePickerVisible(true);
                      }}
                      title={f === 'CustomRange' ? 'Custom Range' : f}
                    />
                  ))}
                </Menu>

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
                  <ScrollView style={styles.xyz}>
                    <Menu.Item
                    onPress={() => {
                      setSelectedShop("AllShops");
                      setSelectedBarber("AllBarbers");
                      setShopMenuVisible(false);
                    }}
                    title="All Shops"
                  />
                  {shops.map(shop => (
                    <View key={shop._id}>
                      <Menu.Item
                        onPress={() => {
                          setSelectedShop(shop.name);
                          setSelectedBarber("AllBarbers");
                          setShopMenuVisible(false);
                        }}
                        title={`• ${shop.name}`}
                        style={styles.shopMenuItem}
                      />
                      <Menu.Item
                        onPress={() => {
                          setSelectedShop(shop.name);
                          setSelectedBarber("AllBarbers");
                          setShopMenuVisible(false);
                        }}
                        title={`     •All Barbers`}
                        style={styles.barberMenuItem}
                      />
                      {(shop.barbers || []).map(barber => (
                        <Menu.Item
                          key={barber._id}
                          onPress={() => {
                            setSelectedShop(shop.name);
                            setSelectedBarber(barber.name);
                            setShopMenuVisible(false);
                          }}
                          title={`     •${barber.name}`}
                          style={styles.barberMenuItem}
                        />
                      ))}
                    </View>
                  ))}
                  </ScrollView>
                </Menu>
              </View>

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

            <DatePickerModal
              locale="en"
              mode="range"
              visible={datePickerVisible}
              onDismiss={() => setDatePickerVisible(false)}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onConfirm={handleRangeConfirm}
            />

            {showVisualizations && (
              <View>
                <View style={styles.chartContainer}>
                  {graphFlag === 1 && filteredPayments.length > 0 && (
                    <>
                      <Text style={styles.revenueText}>Revenue Timeline</Text>
                      <LineChart
                        data={revenueTimelineData}
                        width={screenWidth * 0.9}
                        height={screenHeight * 0.35}
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
                          height={screenHeight * 0.4}
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
                  {filteredPayments.length === 0 && (graphFlag === 1 || graphFlag === 2) && (
                    <Text style={styles.noChartDataText}>No data available for this chart with current filters.</Text>
                  )}
                </View>

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

            <View style={styles.controlsContainer}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity
                style={styles.buttonContainer}
                onPress={createAndSavePdf}
                activeOpacity={0.7}
                disabled={isPdfLoading}
              >
                <LinearGradient
                  colors={["#e63946", "#d62828"]}
                  style={styles.pdfButton}
                >
                  {isPdfLoading ? (
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
              </ScrollView>
            </View>
          </ScrollView>
          <TouchableOpacity 
            onPress={onClose} 
            style={styles.fixedCloseButton}
          >
            <MaterialCommunityIcons name="close-circle" size={30} color="#2d3436" />
          </TouchableOpacity>
        </View>
      </Provider>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
    header: {
      height: screenHeight * 0.07,
      backgroundColor: "black",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: screenWidth * 0.04,
      // paddingTop: screenHeight * 0.01
    },
    title: {
      color: "#fff",
      fontSize: screenWidth * 0.055,
      marginLeft: screenWidth * 0.04,
    },
    backgroundImage: {
      flex: 1,
      resizeMode: "cover",
      width: "100%",
      height: "100%",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(237,236,236,0.77)",
      top: screenHeight * 0.07,
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
      paddingHorizontal: screenWidth * 0.05,
      paddingBottom: screenHeight * 0.02,
      position: "relative",
      zIndex: 10,
    },
    headerTitle: {
      fontSize: screenWidth * 0.1,
      fontWeight: "900",
      color: "#2d3436",
      textAlign: "center",
      flex: 1,
    },
    fixedCloseButton: {
      position: 'absolute',
      bottom: screenHeight * 0.02,
      alignSelf: 'center',
      zIndex: 100,
      backgroundColor: 'white',
      borderRadius: screenWidth * 0.05,
      padding: screenWidth * 0.01,
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: screenHeight * 0.002 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    scrollableContent: {
      flex: 1,
      padding: screenWidth * 0.04,
    },
    scrollContentContainer: {
      paddingBottom: screenHeight * 0.02,
    },
    buttonContainer: {
      borderRadius: screenWidth * 0.04,
      overflow: "hidden",
    },
    pdfButton: {
      padding: screenWidth * 0.01,
      borderRadius: screenWidth * 0.04,
      alignItems: "center",
      justifyContent: "center",
      elevation: 6,
      width: screenWidth * 0.11,
      height: screenWidth * 0.11,
    },
    recentTransactionsContainer: {
      maxHeight: screenHeight * 0.6,
      backgroundColor: "#ffffff",
      borderRadius: screenWidth * 0.03,
      padding: screenWidth * 0.04,
      elevation: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: screenHeight * 0.002 },
      shadowOpacity: 0.15,
      shadowRadius: screenWidth * 0.01,
      marginBottom: screenHeight * 0.02,
    },
    recentTransactionsScroll: {
      maxHeight: screenHeight * 0.5,
    },
    controlsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: screenWidth * 0.01,
      marginBottom: screenHeight * 0.02,
    },
    sectionTitle: {
      fontSize: screenWidth * 0.055,
      fontWeight: "bold",
      color: "#333",
    },
    outerContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      paddingHorizontal: 0,
      marginBottom: screenHeight * 0.02,
    },
    filterGroup: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: 'wrap',
      rowGap: screenHeight * 0.01,
      columnGap: screenWidth * 0.02,
      flexShrink: 1,
    },
    filterButton: {
      paddingVertical: screenHeight * 0.015,
      paddingHorizontal: screenWidth * 0.04,
      backgroundColor: "#ffffff",
      borderRadius: screenWidth * 0.02,
      alignItems: "center",
      elevation: 3,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: screenHeight * 0.001 },
      shadowOpacity: 0.1,
      shadowRadius: screenWidth * 0.008,
    },
    filterButtonText: {
      color: "#2d3436",
      fontWeight: "600",
      fontSize: screenWidth * 0.04,
    },
    shopMenuItem: {
      paddingLeft: screenWidth * 0.03,
    },
    barberMenuItem: {
      paddingLeft: screenWidth * 0.07,
    },
    visualizeGroup: {
      flexDirection: "row",
      alignItems: "center",
    },
    toggleLabel: {
      fontWeight: "900",
      marginRight: screenWidth * 0.02,
      color: "#333",
      fontSize: screenWidth * 0.04,
    },
    summaryContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: screenWidth * 0.02,
      marginBottom: screenHeight * 0.02,
    },
    summaryCard: {
      flex: 1,
      padding: screenWidth * 0.04,
      borderRadius: screenWidth * 0.03,
      elevation: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: screenHeight * 0.002 },
      shadowOpacity: 0.15,
      shadowRadius: screenWidth * 0.01,
    },
    revenueCard: {
      backgroundColor: '#00b894',
    },
    customersCard: {
      backgroundColor: '#0984e3',
    },
    summaryTitle: {
      color: '#fff',
      fontSize: screenWidth * 0.045,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: screenHeight * 0.01,
    },
    summaryValue: {
      color: '#fff',
      fontSize: screenWidth * 0.07,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    chartContainer: {
      width: "100%",
      alignItems: "center",
      marginBottom: screenHeight * 0.02,
      backgroundColor: "#ffffff",
      borderRadius: screenWidth * 0.03,
      paddingVertical: screenHeight * 0.02,
      elevation: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: screenHeight * 0.002 },
      shadowOpacity: 0.15,
      shadowRadius: screenWidth * 0.01,
    },
    revenueText: {
      fontSize: screenWidth * 0.05,
      fontWeight: "bold",
      marginBottom: screenHeight * 0.02,
      color: "#333",
    },
    chart: {
      marginVertical: screenHeight * 0.01,
      borderRadius: screenWidth * 0.04,
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
      paddingHorizontal: screenWidth * 0.05,
      marginBottom: screenHeight * 0.02,
    },
    navButton: {
      padding: screenWidth * 0.03,
      backgroundColor: "#ddd",
      borderRadius: screenWidth * 0.02,
      elevation: 2,
    },
    navButtonText: {
      fontSize: screenWidth * 0.05,
      fontWeight: "bold",
      color: "#0984e3",
    },
    paginationContainer: {
      flexDirection: "row",
    },
    paginationDot: {
      width: screenWidth * 0.02,
      height: screenWidth * 0.02,
      borderRadius: screenWidth * 0.01,
      backgroundColor: "#ccc",
      marginHorizontal: screenWidth * 0.01,
    },
    paginationDotActive: {
      backgroundColor: "#0984e3",
    },
    calendarWrapper: {
      width: "100%",
      padding: screenWidth * 0.03,
    },
    calendarInnerContainer: {
      backgroundColor: "#fff",
      borderRadius: screenWidth * 0.03,
      padding: screenWidth * 0.04,
      elevation: 3,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: screenHeight * 0.002 },
      shadowOpacity: 0.1,
      shadowRadius: screenWidth * 0.01,
    },
    calendarHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: screenHeight * 0.02,
    },
    calendarNavButton: {
      padding: screenWidth * 0.02,
    },
    calendarNavButtonText: {
      fontSize: screenWidth * 0.06,
      fontWeight: "bold",
      color: "#333",
    },
    calendarTitle: {
      fontSize: screenWidth * 0.045,
      fontWeight: "bold",
      color: "#333",
    },
    calendarDaysHeader: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: screenHeight * 0.01,
    },
    calendarDayHeaderText: {
      fontWeight: "bold",
      width: `${100 / 7}%`,
      textAlign: "center",
      color: "#555",
      fontSize: screenWidth * 0.035,
    },
    calendarGrid: {
      width: "100%",
    },
    calendarRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: screenHeight * 0.002,
    },
    calendarCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 0.5,
      borderColor: "#eee",
      borderRadius: screenWidth * 0.01,
    },
    calendarEmptyCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
    },
    calendarDayText: {
      fontSize: screenWidth * 0.035,
      fontWeight: "bold",
      color: "#333",
    },
    calendarDayCount: {
      fontSize: screenWidth * 0.025,
      color: "#666",
    },
    calendarLegend: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginTop: screenHeight * 0.02,
      flexWrap: "wrap",
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: screenWidth * 0.01,
      marginBottom: screenHeight * 0.005,
    },
    legendColor: {
      width: screenWidth * 0.04,
      height: screenWidth * 0.04,
      borderRadius: screenWidth * 0.01,
      marginRight: screenWidth * 0.01,
      borderWidth: 0.5,
      borderColor: "#ccc",
    },
    legendText: {
      fontSize: screenWidth * 0.03,
      color: "#555",
    },
    transactionCard: {
      backgroundColor: "#f9f9f9",
      borderRadius: screenWidth * 0.02,
      padding: screenWidth * 0.04,
      marginBottom: screenHeight * 0.01,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: screenHeight * 0.001 },
      shadowOpacity: 0.1,
      shadowRadius: screenWidth * 0.008,
    },
    transactionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: screenHeight * 0.005,
    },
    barberName: {
      fontSize: screenWidth * 0.04,
      fontWeight: "bold",
      color: "#333",
    },
    transactionAmount: {
      fontSize: screenWidth * 0.04,
      fontWeight: "bold",
      color: "#00b894",
    },
    servicesList: {
      fontSize: screenWidth * 0.035,
      color: "#555",
      marginBottom: screenHeight * 0.005,
    },
    transactionDate: {
      fontSize: screenWidth * 0.03,
      color: "#777",
      textAlign: "right",
    },
    noTransactionsText: {
      textAlign: 'center',
      marginTop: screenHeight * 0.02,
      fontSize: screenWidth * 0.04,
      color: '#666',
    },
    noChartDataText: {
      textAlign: 'center',
      marginTop: screenHeight * 0.05,
      fontSize: screenWidth * 0.04,
      color: '#666',
      paddingHorizontal: screenWidth * 0.05,
    },
    xyz: {
      height: screenHeight * 0.5
    }
  });

export default History;