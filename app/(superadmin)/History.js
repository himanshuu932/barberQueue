import React, { useState, useEffect,useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Switch } from "react-native";
import { Menu, Provider } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";
import { format, utcToZonedTime } from 'date-fns-tz';
import { registerTranslation } from 'react-native-paper-dates';
import { en } from 'react-native-paper-dates';
import { PieChart, LineChart } from "react-native-chart-kit";
import { startOfMonth, endOfMonth, eachDayOfInterval, parseISO, getDate, getDay } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';

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
  
  useFocusEffect(
    useCallback(() => {
      // This will run every time the screen is focused
      fetchAllData();

      // Optional: Cleanup function
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

  const getFilteredPayments = () => {
    const now = new Date();
    const todayIST = utcToZonedTime(now, IST_TIMEZONE);
    const oneWeekAgoIST = new Date(todayIST);
    oneWeekAgoIST.setDate(todayIST.getDate() - 7);
    const oneMonthAgoIST = new Date(todayIST);
    oneMonthAgoIST.setMonth(todayIST.getMonth() - 1);

    return allPayments.filter(payment => {
      const paymentDate = payment.originalDate;
      const istPaymentDate = utcToZonedTime(paymentDate, IST_TIMEZONE);

      if (filter === "Today" && 
          !isSameDayIST(istPaymentDate, todayIST)) return false;
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

  const isSameDayIST = (date1, date2) => {
    return format(date1, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE }) === 
           format(date2, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE });
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
    // Get all days in current month
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Count transactions per day
    const dailyTransactions = {};
    
    allPayments.forEach(payment => {
      const paymentDate = payment.date; // Using the YYYY-MM-DD format
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
    
    // Find the maximum transactions in a day for scaling
    const counts = Object.values(dailyTransactions).map(day => day.count);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
    
    return {
      dailyData: dailyTransactions,
      maxCount: maxCount,
      daysInMonth: daysInMonth,
      monthStart: monthStart
    };
  };

  // Get color intensity based on activity level
  const getColorIntensity = (count, maxCount) => {
    if (!count) return '#f5f5f5'; // No activity
    
    const intensity = Math.max(0.2, Math.min(1, count / maxCount));
    
    // Generate a shade of green from light to dark
    const greenBase = Math.floor(255 * (1 - intensity));
    return `rgb(${greenBase}, ${Math.floor(200 * intensity + 55)}, ${greenBase})`;
  };

  const filteredPayments = getFilteredPayments();
  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.totalCost, 0);
  const totalCustomers = filteredPayments.length;

  const serviceCounts = filteredPayments.reduce((counts, p) => {
    p.services.forEach(service => {
      counts[service] = (counts[service] || 0) + 1;
    });
    return counts;
  }, {});

  // Generate data for barber contribution pie chart
  const getBarberContributionData = () => {
    const barberRevenue = {};
    filteredPayments.forEach(payment => {
      barberRevenue[payment.barberName] = (barberRevenue[payment.barberName] || 0) + payment.totalCost;
    });

    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
      '#FF9F40', '#8AC926', '#1982C4', '#6A4C93', '#F94144'
    ];

    return Object.entries(barberRevenue).map(([name, revenue], index) => ({
      name: name,
      revenue,
      color: colors[index % colors.length],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12
    }));
  };

  // Generate daily revenue data for line chart
  const getRevenueTimelineData = () => {
    const now = new Date();
    const todayIST = utcToZonedTime(now, IST_TIMEZONE);
    
    let dateKeys = [];
    let dateFormat;
    
    if (filter === "Today") {
      // For today, use hourly breakdown
      dateFormat = 'HH:00';
      // Generate all hours of the day
      dateKeys = Array.from({ length: 24 }, (_, i) => 
        `${String(i).padStart(2, '0')}:00`
      );
    } else if (filter === "This Week") {
      // For week, use day names
      dateFormat = 'EEE';
      // Generate days of week (starting from Sunday)
      dateKeys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    } else if (filter === "This Month" || filter === "All") {
      // For month, use day numbers
      dateFormat = 'dd';
      // Get days in current month
      const daysInMonth = new Date(
        todayIST.getFullYear(), 
        todayIST.getMonth() + 1, 
        0
      ).getDate();
      dateKeys = Array.from({ length: daysInMonth }, (_, i) => 
        String(i + 1).padStart(2, '0')
      );
    } else if (filter === "Custom Date") {
      // For custom date, use hourly breakdown
      dateFormat = 'HH:00';
      dateKeys = Array.from({ length: 24 }, (_, i) => 
        `${String(i).padStart(2, '0')}:00`
      );
    }

    // Initialize all time periods with zero revenue
    const dailyRevenue = {};
    const dailyCompare = {};

    dateKeys.forEach(key => {
      dailyRevenue[key] = 0;
      dailyCompare[key] = 0;
    });

    // Sum up revenue for each time period
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

    // Get revenue from previous comparable period for comparison
    const previousPeriodPayments = allPayments.filter(payment => {
      const paymentDate = payment.originalDate;
      const istPaymentDate = utcToZonedTime(paymentDate, IST_TIMEZONE);
      
      if (filter === "Today") {
        // Compare with yesterday
        const yesterdayIST = new Date(todayIST);
        yesterdayIST.setDate(todayIST.getDate() - 1);
        return isSameDayIST(istPaymentDate, yesterdayIST);
      } else if (filter === "This Week") {
        // Compare with previous week
        const oneWeekAgoIST = new Date(todayIST);
        oneWeekAgoIST.setDate(todayIST.getDate() - 7);
        const twoWeeksAgoIST = new Date(todayIST);
        twoWeeksAgoIST.setDate(todayIST.getDate() - 14);
        return istPaymentDate >= twoWeeksAgoIST && istPaymentDate < oneWeekAgoIST;
      } else if (filter === "This Month") {
        // Compare with previous month
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
        // Map yesterday's hours to today's hours
        dateKey = format(paymentDate, 'HH:00', { timeZone: IST_TIMEZONE });
      } else if (filter === "This Week") {
        // Map last week's days to this week's days
        dateKey = format(paymentDate, 'EEE', { timeZone: IST_TIMEZONE });
      } else if (filter === "This Month" || filter === "All") {
        // Map last month's days to this month's days (approximately)
        dateKey = format(paymentDate, 'dd', { timeZone: IST_TIMEZONE });
      }
      
      if (dateKey && dailyCompare[dateKey] !== undefined) {
        dailyCompare[dateKey] += payment.totalCost;
      }
    });

    // Filter out empty days for cleaner chart
    const displayedKeys = dateKeys.filter(key => dailyRevenue[key] > 0);
    
    // If all days are empty, show at least something
    if (displayedKeys.length === 0 && dateKeys.length > 0) {
      displayedKeys.push(dateKeys[0]);
      dailyRevenue[dateKeys[0]] = 0;
    }

    // Create data for the LineChart
    return {
      labels: displayedKeys,
      datasets: [
        {
          data: displayedKeys.map(key => dailyRevenue[key]),
          color: (opacity = 1) => `rgba(0, 184, 148, ${opacity})`, // Primary color
          strokeWidth: 2
        },
        {
          data: displayedKeys.map(key => dailyCompare[key] || 0),
          color: (opacity = 1) => `rgba(9, 132, 227, ${opacity})`, // Secondary color
          strokeWidth: 2,
          strokeDashArray: [5, 5] // Dashed line for comparison
        }
      ],
      legend: ["Current Period", "Previous Period"]
    };
  };

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

  // Calendar days of week headers
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Render calendar
  const renderCalendar = () => {
    const { dailyData, maxCount, daysInMonth, monthStart } = businessActivityData;
    
    // Calculate starting day offset (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfMonth = getDay(monthStart);
    
    // Create placeholder for empty cells at the beginning
    const emptyStartCells = Array(firstDayOfMonth).fill(null);
    
    // Combine empty cells and days
    const allCells = [...emptyStartCells, ...daysInMonth];
    
    // Create weeks (rows of 7 days)
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
    <Provider>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Admin Payment Dashboard</Text>

        {/* Filters and Visualization Toggle */}
        <View style={styles.controlsContainer}>
          <View style={styles.filterRow}>
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

          {/* Toggle Visualizations */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Show Visualizations</Text>
            <Switch
              value={showVisualizations}
              onValueChange={setShowVisualizations}
              trackColor={{ false: "#d3d3d3", true: "#0984e3" }}
              thumbColor={showVisualizations ? "#ffffff" : "#f4f3f4"}
            />
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

        {/* Visualizations (conditionally rendered) */}
        {showVisualizations && (
          <View>
            <View style={styles.chartContainer}>
              {graphFlag === 1 && filteredPayments.length > 0 && (<>
                <Text style={styles.revenueText}>Revenue</Text>
                <LineChart
                  data={revenueTimelineData}
                  width={screenWidth}
                  height={220}
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
                  style={styles.chart}
                  fromZero
                  yAxisLabel="₹"
                  yAxisInterval={1}
                  verticalLabelRotation={30}
                  segments={5}
                />
              </>
              )}
              {graphFlag === 2 && barberContributionData.length > 0 && (<>
                <Text style={styles.revenueText}>Barber Contribution</Text>
                <PieChart
                  data={barberContributionData}
                  width={screenWidth}
                  height={220}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  }}
                  accessor="revenue"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                  style={styles.chart}
                />
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
        {/* Detailed Transactions */}
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
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
  );
};

// Enhanced styles with additional calendar-related styles
const styles = StyleSheet.create({

  revenueText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3436',
    textAlign: 'center',
  },

  recentTransactionsContainer: {
    maxHeight: 450,
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
    backgroundColor: '#f5f5f5'
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2d3436',
    textAlign: 'center'
  },
  controlsContainer: {
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10
  },
  filterButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2
  },
  filterButtonText: {
    color: '#2d3436',
    fontWeight: '500'
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    elevation: 2
  },
  toggleLabel: {
    color: '#2d3436',
    fontWeight: '500'
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
    height: 440, // Fixed height for consistency across all cards
    justifyContent: 'center'
  },
  chart: {
    marginVertical: 8,
    borderRadius: 8,
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
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4
  },
  legendText: {
    fontSize: 12,
    color: '#636e72'
  },
  peakDaysContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    elevation: 2
  },
  peakDayCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8
  },
  peakDayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3436',
    marginBottom: 8
  },
  peakDayDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  peakDayMetric: {
    flex: 1
  },
  peakDayMetricLabel: {
    fontSize: 12,
    color: '#636e72'
  },
  peakDayMetricValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2d3436'
  },
  serviceContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3436',
    marginBottom: 12
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dfe6e9'
  },
  serviceName: {
    color: '#636e72'
  },
  serviceCount: {
    color: '#2d3436',
    fontWeight: '500'
  },
  transactionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    elevation: 2
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  barberName: {
    color: '#2d3436',
    fontWeight: '500'
  },
  transactionAmount: {
    color: '#00b894',
    fontWeight: 'bold'
  },
  servicesList: {
    color: '#636e72',
    marginBottom: 4,
    fontSize: 14
  },
  transactionDate: {
    color: '#b2bec3',
    fontSize: 12
  },// Calendar styles to add
  calendarContainer: {
    marginTop: 10,
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
 // Replace the calendarCell and calendarEmptyCell styles with these:
calendarCell: {
  flex: 1,
  height: 36, // Fixed height instead of aspectRatio
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 4,
  margin: 2,
},
calendarEmptyCell: {
  flex: 1,
  height: 36, // Same fixed height
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
  }
});

export default AdminPaymentHistory;