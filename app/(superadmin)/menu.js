import React from 'react';
import { ScrollView, View, Text, StyleSheet, Dimensions } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { LineChart, BarChart } from 'react-native-chart-kit';
import * as Animatable from 'react-native-animatable'; // Import Animatable

const MenuScreen = () => {
  // Dummy data
  const employeeData = [
    { name: 'John', customers: 15, revenue: 1200, avgTime: '30 mins', rating: 4.5 },
    { name: 'Jane', customers: 12, revenue: 1000, avgTime: '35 mins', rating: 4.7 },
    { name: 'Mike', customers: 10, revenue: 900, avgTime: '40 mins', rating: 4.2 },
  ];

  const serviceData = {
    labels: ['Haircut', 'Shave', 'Beard Trim', 'Styling'],
    datasets: [
      {
        data: [40, 30, 20, 10], // Popularity percentages
      },
    ],
  };

  const revenueData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [500, 700, 600, 800, 900, 1200, 1100],
      },
    ],
  };

  const barData = {
    labels: ['John', 'Jane', 'Mike'],
    datasets: [
      {
        data: [15, 12, 10],
      },
    ],
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <ScrollView style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.cardRow}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Total Customers</Title>
            <Paragraph>120 👥</Paragraph>
          </Card.Content>
        </Card>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Total Revenue</Title>
            <Paragraph>$2,500 💰</Paragraph>
          </Card.Content>
        </Card>
      </View>
      <View style={styles.cardRow}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Popular Service</Title>
            <Paragraph>Haircut ✂️</Paragraph>
          </Card.Content>
        </Card>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Top Employee</Title>
            <Paragraph>John 🏆</Paragraph>
          </Card.Content>
        </Card>
      </View>

      {/* Charts */}
      <Card style={styles.chartCard}>
        <Card.Content>
          <Title>Customers Served</Title>
          <BarChart
            data={barData}
            width={screenWidth - 32}
            height={220}
            yAxisLabel=""
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(10, 38, 71, ${opacity})`,
            }}
          />
        </Card.Content>
      </Card>

      <Card style={styles.chartCard}>
        <Card.Content>
          <Title>Revenue Trends</Title>
          <LineChart
            data={revenueData}
            width={screenWidth - 32}
            height={220}
            yAxisLabel="$"
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 215, 0, ${opacity})`,
            }}
          />
        </Card.Content>
      </Card>

      {/* Bar Chart for Service Popularity */}
      <Card style={styles.chartCard}>
        <Card.Content>
          <Title>Service Popularity</Title>
          <BarChart
            data={serviceData}
            width={screenWidth - 32}
            height={220}
            yAxisLabel=""
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`, // Red color for bars
            }}
          />
        </Card.Content>
      </Card>

      {/* Employee Performance Table */}
      <Card style={styles.tableCard}>
        <Card.Content>
          <Title>Employee Performance</Title>
          {employeeData.map((emp, index) => (
            <View key={index} style={styles.tableRow}>
              <Text>{emp.name}</Text>
              <Text>{emp.customers}</Text>
              <Text>${emp.revenue}</Text>
              <Text>{emp.avgTime}</Text>
              <Text>{emp.rating} ⭐️</Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Recent Transactions */}
      <Card style={styles.transactionCard}>
        <Card.Content>
          <Title>Recent Transactions</Title>
          <Text>Customer Name | Services | Amount | Payment Method</Text>
          <Text>John Doe | Haircut | $50 | 💳</Text>
          <Text>Jane Smith | Shave | $30 | 💵</Text>
        </Card.Content>
      </Card>

      {/* Animatable Animation */}
      <Animatable.View
        animation="bounceIn" // Animation type
        iterationCount="infinite" // Loop the animation
        style={styles.animatable}
      >
        <Text style={styles.animatableText}>🎉</Text>
      </Animatable.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    elevation: 4,
  },
  chartCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  tableCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  transactionCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  animatable: {
    alignSelf: 'center',
    marginTop: 20,
  },
  animatableText: {
    fontSize: 50,
  },
});

export default MenuScreen;
