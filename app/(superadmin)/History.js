import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Switch, ImageBackground } from "react-native";
import { Menu, Provider } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";
import { format, utcToZonedTime } from 'date-fns-tz';
import { registerTranslation } from 'react-native-paper-dates';
import { en } from 'react-native-paper-dates';
import {BarChart, PieChart, LineChart } from "react-native-chart-kit";
import { startOfMonth, endOfMonth, eachDayOfInterval, getDate, getDay } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as Print from 'expo-print';
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
// import * as IntentLauncher from "expo-intent-launcher";
import { StorageAccessFramework } from "expo-file-system";
import { Alert, Platform, PermissionsAndroid } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons"; // Better icon set
import { LinearGradient } from "expo-linear-gradient"; // Optional for modern look

// Register translations
registerTranslation('en', en);

const IST_TIMEZONE = 'Asia/Kolkata';
const screenWidth = Dimensions.get("window").width - 32; // Accounting for padding

const AdminPaymentHistory = () => {
  const [filter, setFilter] = useState("All");
  const [barberFilter, setBarberFilter] = useState("All");
  const [allPayments, setAllPayments] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [barberMenuVisible, setBarberMenuVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [showVisualizations, setShowVisualizations] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [graphFlag, setGraphFlag] = useState(1); // 1: LineChart, 2: PieChart, 3: Calendar

  const savePdfToDownloads = async () => {
    try {
      // Define the file path in app storage
      const pdfUri = `${FileSystem.documentDirectory}RecentTransactions.pdf`;
  
      if (Platform.OS === "android") {
        // Use Expo Sharing API to allow the user to save the file manually
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(pdfUri, { mimeType: "application/pdf" });
          Alert.alert("Success", "Choose 'Save to Downloads' in the sharing options.");
        } else {
          Alert.alert("Error", "Sharing is not supported on this device.");
        }
      } else {
        // iOS: Save the file to the app's document directory
        Alert.alert("iOS Info", "File is saved in the app's document directory.");
      }
    } catch (error) {
      console.error("Error saving file:", error);
      Alert.alert("Error", "Failed to save the PDF.");
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAllData();
      return () => {
        console.log('Screen unfocused');
      };
    }, [])
  );

  const fetchAllData = async () => {
    try {
      const barbersResponse = await fetch('https://barberqueue-24143206157.us-central1.run.app/barbers');
      const barbersData = await barbersResponse.json();
      setBarbers(barbersData);

      const allHistory = barbersData.reduce((acc, barber) => {
        const barberPayments = barber.history.map(entry => {
          const utcDate = new Date(entry.date);
          const istDate = utcToZonedTime(utcDate, IST_TIMEZONE);
          return {
            ...entry,
            barberName: barber.name,
            date: format(istDate, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE }),
            time: format(istDate, 'HH:mm', { timeZone: IST_TIMEZONE }),
            originalDate: utcDate // Keep original date for filtering
          };
        });
        return [...acc, ...barberPayments];
      }, []);

      setAllPayments(allHistory);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const isSameDayIST = (date1, date2) => {
    return format(date1, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE }) === 
           format(date2, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE });
  };

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
      if (filter === "This Week" && istPaymentDate < oneWeekAgoIST) return false;
      if (filter === "This Month" && istPaymentDate < oneMonthAgoIST) return false;
      if (selectedDate) {
        const selectedIST = utcToZonedTime(new Date(selectedDate), IST_TIMEZONE);
        if (!isSameDayIST(istPaymentDate, selectedIST)) return false;
      }
      if (barberFilter !== "All" && payment.barberName !== barberFilter) return false;
      return true;
    });
  };

  const handleDateSelect = (params) => {
    if (params.date) {
      const selectedIST = utcToZonedTime(params.date, IST_TIMEZONE);
      setSelectedDate(selectedIST.toISOString());
      setFilter("Custom Date");
    }
    setDatePickerVisible(false);
  };

  // Calendar Navigation
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

  // Generate Business Activity Heat Map Data
  const getBusinessActivityData = () => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const dailyTransactions = {};
    
    allPayments.forEach(payment => {
      const paymentDate = payment.date;
      if (dailyTransactions[paymentDate]) {
        dailyTransactions[paymentDate].count += 1;
        dailyTransactions[paymentDate].revenue += payment.totalCost;
      } else {
        dailyTransactions[paymentDate] = { 
          count: 1, 
          revenue: payment.totalCost 
        };
      }
    });
    
    const counts = Object.values(dailyTransactions).map(day => day.count);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
    
    return {
      dailyData: dailyTransactions,
      maxCount: maxCount,
      daysInMonth: daysInMonth,
      monthStart: monthStart
    };
  };

  const getColorIntensity = (count, maxCount) => {
    if (!count) return '#f5f5f5';
    const intensity = Math.max(0.2, Math.min(1, count / maxCount));
    const greenBase = Math.floor(255 * (1 - intensity));
    return `rgb(${greenBase}, ${Math.floor(200 * intensity + 55)}, ${greenBase})`;
  };

  const filteredPayments = getFilteredPayments();
  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.totalCost, 0);
  const totalCustomers = filteredPayments.length;

  // Pie Chart Data
  const getBarberContributionData = () => {
    // Initialize all barbers with 0 revenue
    const revenueData = {};
    barbers.forEach(b => {
      revenueData[b.name] = 0;
    });
    
    // Add revenue from filtered payments (if any)
    filteredPayments.forEach(payment => {
      revenueData[payment.barberName] = (revenueData[payment.barberName] || 0) + payment.totalCost;
    });
  
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
      '#FF9F40', '#8AC926', '#1982C4', '#6A4C93', '#F94144'
    ];
  
    // Return array including every barber, even if revenue is 0
    return Object.entries(revenueData).map(([name, revenue], index) => ({
      name,
      revenue,
      color: colors[index % colors.length],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    }));
  };

  // Line Chart Data
  const getRevenueTimelineData = () => {
    const now = new Date();
    const todayIST = utcToZonedTime(now, IST_TIMEZONE);
    let dateKeys = [];
    
    if (filter === "Today" || filter === "Custom Date") {
      dateKeys = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    } else if (filter === "This Week") {
      dateKeys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    } else if (filter === "This Month" || filter === "All") {
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
      if (filter === "Today" || filter === "Custom Date") {
        dateKey = format(paymentDate, 'HH:00', { timeZone: IST_TIMEZONE });
      } else if (filter === "This Week") {
        dateKey = format(paymentDate, 'EEE', { timeZone: IST_TIMEZONE });
      } else if (filter === "This Month" || filter === "All") {
        dateKey = format(paymentDate, 'dd', { timeZone: IST_TIMEZONE });
      }
      if (dailyRevenue[dateKey] !== undefined) {
        dailyRevenue[dateKey] += payment.totalCost;
      }
    });

    const previousPeriodPayments = allPayments.filter(payment => {
      const istPaymentDate = utcToZonedTime(payment.originalDate, IST_TIMEZONE);
      if (filter === "Today") {
        const yesterdayIST = new Date(todayIST);
        yesterdayIST.setDate(todayIST.getDate() - 1);
        return isSameDayIST(istPaymentDate, yesterdayIST);
      } else if (filter === "This Week") {
        const oneWeekAgoIST = new Date(todayIST);
        oneWeekAgoIST.setDate(todayIST.getDate() - 7);
        const twoWeeksAgoIST = new Date(todayIST);
        twoWeeksAgoIST.setDate(todayIST.getDate() - 14);
        return istPaymentDate >= twoWeeksAgoIST && istPaymentDate < oneWeekAgoIST;
      } else if (filter === "This Month") {
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
      if (filter === "Today" || filter === "Custom Date") {
        dateKey = format(paymentDate, 'HH:00', { timeZone: IST_TIMEZONE });
      } else if (filter === "This Week") {
        dateKey = format(paymentDate, 'EEE', { timeZone: IST_TIMEZONE });
      } else if (filter === "This Month" || filter === "All") {
        dateKey = format(paymentDate, 'dd', { timeZone: IST_TIMEZONE });
      }
      if (dateKey && dailyCompare[dateKey] !== undefined) {
        dailyCompare[dateKey] += payment.totalCost;
      }
    });

    const displayedKeys = dateKeys.filter(key => dailyRevenue[key] > 0);
    if (displayedKeys.length === 0 && dateKeys.length > 0) {
      displayedKeys.push(dateKeys[0]);
      dailyRevenue[dateKeys[0]] = 0;
    }

    return {
      labels: displayedKeys,
      datasets: [
        {
          data: displayedKeys.map(key => dailyRevenue[key]),
          color: (opacity = 1) => `rgba(0, 184, 148, ${opacity})`,
          strokeWidth: 2
        },
        {
          data: displayedKeys.map(key => dailyCompare[key] || 0),
          color: (opacity = 1) => `rgba(9, 132, 227, ${opacity})`,
          strokeWidth: 2,
          strokeDashArray: [5, 5]
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
                      setSelectedDate(day.toISOString());
                      setFilter("Custom Date");
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

  return (
    <ImageBackground source={require("../image/bglogin.png")}
    style={styles.backgroundImage}>
      <View style={styles.overlay}/>
      <Provider>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>STATISTICS</Text>
        <View style={styles.outerContainer}>
  <View style={styles.filterGroup}>
    <Menu
      visible={filterMenuVisible}
      onDismiss={() => setFilterMenuVisible(false)}
      anchor={
        <TouchableOpacity onPress={() => setFilterMenuVisible(true)} style={styles.filterButton}>
          <Text style={styles.filterButtonText}>📅 {filter}</Text>
        </TouchableOpacity>
      }
    >
      {["All", "Today", "This Week", "This Month", "Custom Date"].map(f => (
        <Menu.Item key={f} onPress={() => {
          setFilter(f);
          setFilterMenuVisible(false);
          if (f === "Custom Date") setDatePickerVisible(true);
        }} title={f} />
      ))}
    </Menu>
    <Menu
      visible={barberMenuVisible}
      onDismiss={() => setBarberMenuVisible(false)}
      anchor={
        <TouchableOpacity onPress={() => setBarberMenuVisible(true)} style={styles.filterButton}>
          <Text style={styles.filterButtonText}>💈 {barberFilter}</Text>
        </TouchableOpacity>
      }
    >
      {["All", ...barbers.map(b => b.name)].map(barber => (
        <Menu.Item key={barber} onPress={() => {
          setBarberFilter(barber);
          setBarberMenuVisible(false);
        }} title={barber} />
      ))}
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
          mode="single"
          visible={datePickerVisible}
          onDismiss={() => setDatePickerVisible(false)}
          date={selectedDate ? new Date(selectedDate) : undefined}
          onConfirm={handleDateSelect}
        />

        {/* Summary Cards */}
      

        {/* Visualizations */}
        {showVisualizations && (
          <View>
            <View style={styles.chartContainer}>
              {graphFlag === 1 && filteredPayments.length > 0 && (<>
                <Text style={styles.revenueText}>Revenue</Text>
                <LineChart
                data={revenueTimelineData}
                width={screenWidth * 0.9}
                height={300}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: {
                    r: "5",
                    strokeWidth: "2",
                    stroke: "#ffa726"
                  },
                  propsForLabels: { fontSize: 10 },
                }}
                bezier
                style={[styles.chart, { marginLeft: -10 }]}  // Shift the chart 10 pixels to the left
                fromZero
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
                      datasets: [
                        {
                          data: barberContributionData.map(item => item.revenue)
                        }
                      ]
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
                      color: (opacity = 1) => `rgba(34, 128, 176, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(34, 34, 34, ${opacity})`,
                      style: { borderRadius: 16 },
                    }}
                    style={styles.chart}
                  />
                </View>
              </>
            )}
              {graphFlag === 3 && (
                <View style={styles.calendarWrapper}>
                  {renderCalendar()}
                </View>
              )}
            </View>

            {/* Navigation Buttons with Dots Indicator */}
            <View style={styles.navigationContainer}>
              <TouchableOpacity onPress={handleLeft} style={styles.navButton}>
                <Text style={styles.navButtonText}>{"<"}</Text>
              </TouchableOpacity>
              <View style={styles.paginationContainer}>
                {[1, 2, 3].map((value, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      graphFlag === value && styles.paginationDotActive
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity onPress={handleRight} style={styles.navButton}>
                <Text style={styles.navButtonText}>{">"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* Recent Transactions */}
        <View style={styles.controlsContainer}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity style={styles.buttonContainer} onPress={savePdfToDownloads} activeOpacity={0.7}>
            <LinearGradient colors={["#e63946", "#d62828"]} style={styles.pdfButton}>
              <MaterialCommunityIcons name="file-export" size={25} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <View style={styles.recentTransactionsContainer}>
          <ScrollView style={styles.recentTransactionsScroll} nestedScrollEnabled={true}>
            {filteredPayments.map((payment, index) => (
              <View key={index} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.barberName}>{payment.barberName}</Text>
                  <Text style={styles.transactionAmount}>₹{payment.totalCost}</Text>
                </View>
                <Text style={styles.servicesList}>{payment.services.join(", ")}</Text>
                <Text style={styles.transactionDate}>
                  {payment.date} • {payment.time} IST
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </Provider>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({

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

  recentTransactionsContainer: {
    maxHeight: 550,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 10,
    elevation: 2,
    marginBottom: 20,
  },
  recentTransactionsScroll: {
    maxHeight: 450,
  },
  container: {
    padding: 16,
  },
  header: {
    fontSize: 30,
    fontWeight: '900',
    // marginBottom: 20,
    // color: '#2d3436',
    textAlign: 'center'
  },
  controlsContainer: {
    flexDirection: "row",  // Arrange items in a row
    justifyContent: "space-between", // Space between title & button
    alignItems: "center",  // Center vertically
    paddingHorizontal: 15, // Add padding for spacing
    marginBottom: 10, // Adjust spacing below the section
  },
  sectionTitle: {
    fontSize: 20, 
    fontWeight: "bold",
    color: "#333", // Darker text for better visibility
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterButton: {
    padding: 12,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    alignItems: "center",
    elevation: 2,
    marginRight: 8, // Optional, to add a little space between the filter buttons
  },
  filterButtonText: {
    color: "#2d3436",
    fontWeight: "500",
  },
  outerContainer: {
    flexDirection: "row",
    justifyContent: "space-between", // This creates the gap between the two groups
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  filterGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  visualizeGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleContainer: {
    flexDirection: "row",  // Align items in a row
    alignItems: "center",  // Align vertically

    padding: 5,
    borderRadius: 8,
    elevation: 0,
    minWidth: 10, // Optional: Adjust width based on content
  },
  toggleLabel: {
    // color: "#2d3436",
    fontWeight: "900",
    marginRight: 8,
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    elevation: 2
  },
  revenueCard: {
    backgroundColor: '#00b894'
  },
  customersCard: {
    backgroundColor: '#0984e3'
  },
  summaryTitle: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 8
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold'
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    height: 430, // Fixed height for consistency across all cards
    justifyContent: 'center'
  },
  chart: {
    borderRadius: 20,
  },
  calendarWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  navButton: {
    padding: 10,
    backgroundColor: '#f7f7f7',
    borderRadius: 4,
    flex: 0.2,
    alignItems: 'center',
  },
  navButtonText: {
    color: '#0984e3',
    fontSize: 20,
    fontWeight: '600',
  },
  paginationContainer: {
    flexDirection: 'row',
    flex: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#0984e3',
  },
  calendarInnerContainer: {
    flex: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  calendarNavButton: {
    padding: 8,
    backgroundColor: '#f7f7f7',
    borderRadius: 4,
  },
  calendarNavButtonText: {
    fontSize: 16,
    color: '#0984e3',
  },
  calendarDaysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarDayHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: '#636e72',
    fontWeight: '500',
    fontSize: 12,
  },
  calendarGrid: {
    marginBottom: 12,
  },
  calendarRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarCell: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    margin: 2,
  },
  calendarEmptyCell: {
    flex: 1,
    height: 36,
    margin: 2,
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2d3436',
  },
  calendarDayCount: {
    fontSize: 10,
    color: '#2d3436',
    fontWeight: 'bold',
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  // legendItem: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   marginHorizontal: 8,
  //   marginVertical: 4,
  // },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 14,
    color: '#444',
  },
  // sectionTitle: {
  //   fontSize: 18,
  //   fontWeight: '600',
  //   color: '#2d3436',
  //   // marginBottom: 12,
  // },
  transactionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  barberName: {
    color: '#2d3436',
    fontWeight: '500',
  },
  transactionAmount: {
    color: 'green',
    fontWeight: 'bold',
  },
  servicesList: {
    color: '#636e72',
    marginBottom: 4,
    fontSize: 14,
  },
  transactionDate: {
    color: '#b2bec3',
    fontSize: 12,
  },
  centeredChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dataContainer: {
    // maxHeight: 50,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 2,
  },
  revenueText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
    textAlign: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 14,
    color: '#636e72',
  },
});

export default AdminPaymentHistory;
