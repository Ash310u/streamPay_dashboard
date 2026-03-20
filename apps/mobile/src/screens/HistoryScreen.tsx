import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";

const items = [
  { id: "1", venue: "Workbay Central", amount: "₹132.00", date: "20 Mar" },
  { id: "2", venue: "Volt Charge 9", amount: "₹76.80", date: "19 Mar" }
];

export const HistoryScreen = () => (
  <SafeAreaView style={styles.container}>
    <Text style={styles.title}>History</Text>
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ gap: 12, paddingTop: 12 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.venue}>{item.venue}</Text>
          <Text style={styles.meta}>{item.date}</Text>
          <Text style={styles.amount}>{item.amount}</Text>
        </View>
      )}
    />
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4fbff", padding: 16 },
  title: { fontSize: 28, fontWeight: "700", color: "#132238" },
  card: { borderRadius: 24, padding: 18, backgroundColor: "rgba(255,255,255,0.82)" },
  venue: { fontSize: 18, fontWeight: "700", color: "#132238" },
  meta: { marginTop: 6, color: "#6d7e90" },
  amount: { marginTop: 8, fontSize: 20, fontWeight: "700", color: "#ff5ea8" }
});

