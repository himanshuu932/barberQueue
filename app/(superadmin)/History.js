import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Menu, Divider, Provider } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";


const PaymentHistory = () => {
  const [filter, setFilter] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [payments, setPayments] = useState([]);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [employeeMenuVisible, setEmployeeMenuVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = () => {
    const mockPayments = [
      { id: 1, name: "Alex", employee: "John", services: ["Haircut", "Shave"], cost: [20, 10], total: 30, rating: 4, date: "2025-02-26", time: "14:30" },
      { id: 2, name: "Ben", employee: "Mike", services: ["Coloring"], cost: [50], total: 50, rating: 5, date: "2025-02-25", time: "16:00" },
      { id: 3, name: "Chris", employee: "Sarah", services: ["Haircut"], cost: [20], total: 20, rating: 3, date: "2025-02-19", time: "10:00" },
    ];
    setPayments(mockPayments);
  };

  const getFilteredPayments = () => {
    const today = new Date().toISOString().split("T")[0];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return payments.filter((payment) => {
      const paymentDate = new Date(payment.date);
      if (filter === "Today" && payment.date !== today) return false;
      if (filter === "This Week" && paymentDate < oneWeekAgo) return false;
      if (filter === "This Month" && paymentDate < oneMonthAgo) return false;
      if (selectedDate && payment.date !== selectedDate) return false;
      if (employeeFilter !== "All" && payment.employee !== employeeFilter) return false;
      return true;
    });
  };

  const totalEarnings = getFilteredPayments().reduce((sum, p) => sum + p.total, 0);
  const serviceCounts = getFilteredPayments().reduce((counts, p) => {
    p.services.forEach((service) => {
      counts[service] = (counts[service] || 0) + 1;
    });
    return counts;
  }, {});
  const handleDateSelect = (params) => {
    if (params.date) {
      setSelectedDate(params.date.toISOString().split("T")[0]);
      setFilter("Custom Date");
    }
    setDatePickerVisible(false);
  };
  return (
    <Provider>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Payment History</Text>

        {/* Filter Menu */}
        <View style={styles.menuContainer}>
          <Menu
            visible={filterMenuVisible}
            onDismiss={() => setFilterMenuVisible(false)}
            anchor={
              <TouchableOpacity onPress={() => setFilterMenuVisible(true)} style={styles.menuButton}>
                <Text style={styles.menuButtonText}>⏳ {filter}</Text>
              </TouchableOpacity>
            }
          >
            {["All", "Today", "This Week", "This Month", "Custom Date"].map((f) => (
              <Menu.Item
                key={f}
                onPress={() => {
                  setFilter(f);
                  setFilterMenuVisible(false);
                  if (f === "Custom Date") setDatePickerVisible(true);
                }}
                title={f}
              />
            ))}
          </Menu>

          {/* Employee Menu */}
          <Menu
            visible={employeeMenuVisible}
            onDismiss={() => setEmployeeMenuVisible(false)}
            anchor={
              <TouchableOpacity onPress={() => setEmployeeMenuVisible(true)} style={styles.menuButton}>
                <Text style={styles.menuButtonText}>👤 {employeeFilter}</Text>
              </TouchableOpacity>
            }
          >
            {["All", "John", "Mike", "Sarah"].map((emp) => (
              <Menu.Item
                key={emp}
                onPress={() => {
                  setEmployeeFilter(emp);
                  setEmployeeMenuVisible(false);
                }}
                title={emp}
              />
            ))}
          </Menu>
        </View>
        <DatePickerModal
          locale="en"
          mode="single"
          visible={datePickerVisible}
          onDismiss={() => setDatePickerVisible(false)}
          date={selectedDate ? new Date(selectedDate) : undefined}
          onConfirm={handleDateSelect}
        />

        <View style={styles.cardContainer}>
          <View style={[styles.card, styles.earningsCard]}>
            <Text style={styles.cardTitle}>Total Earnings</Text>
            <Text style={styles.cardValue}>${totalEarnings}</Text>
          </View>
          <View style={[styles.card, styles.servicesCard]}>
            <Text style={styles.cardTitle}>Popular Services</Text>
            {Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).map(([service, count], index) => (
              <Text key={index} style={styles.serviceText}>{service}: {count} times</Text>
            ))}
          </View>
        </View>

        {getFilteredPayments().map((p) => (
          <View key={p.id} style={styles.paymentCard}>
            <Text style={styles.paymentName}>{p.name}</Text>
            <Text style={styles.paymentDetail}>Employee: {p.employee}</Text>
            <Text style={styles.paymentDetail}>Services: {p.services.join(", ")}</Text>
            <Text style={styles.paymentDetail}>Cost: {p.cost.map((c, i) => `${p.services[i]}: $${c}`).join(", ")}</Text>
            <Text style={styles.paymentDetail}>Total Cost: ${p.total}</Text>
            <Text style={styles.paymentDetail}>Rating: {"⭐".repeat(p.rating)}</Text>
            <Text style={styles.paymentDate}>{p.date} at {p.time}</Text>
          </View>
        ))}
      </ScrollView>
    </Provider>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#f8f9fa" },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 20, color: "#2c3e50", textAlign: "center" },
  menuContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  menuButton: { padding: 10, backgroundColor: "#ecf0f1", borderRadius: 20, flex: 1, marginHorizontal: 5, alignItems: "center" },
  menuButtonText: { color: "#2c3e50", fontWeight: "500" },
  cardContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  card: { padding: 20, borderRadius: 15, flex: 1, marginHorizontal: 5 },
  earningsCard: { backgroundColor: "#3498db" },
  servicesCard: { backgroundColor: "#2ecc71" },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: "#fff", marginBottom: 10 },
  cardValue: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  serviceText: { color: "#fff", marginBottom: 5 },
  paymentCard: { padding: 20, backgroundColor: "#fff", borderRadius: 15, marginBottom: 15, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  paymentName: { fontSize: 18, fontWeight: "bold", color: "#2c3e50", marginBottom: 10 },
  paymentDetail: { fontSize: 14, color: "#34495e", marginBottom: 5 },
  paymentDate: { fontSize: 12, color: "#7f8c8d", marginTop: 10 }
});

export default PaymentHistory;