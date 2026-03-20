import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export const ProfileScreen = () => (
  <SafeAreaView style={styles.container}>
    <Text style={styles.title}>Profile</Text>
    <View style={styles.card}>
      <Text style={styles.label}>KYC status</Text>
      <Text style={styles.value}>Pending</Text>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4fbff", padding: 16 },
  title: { fontSize: 28, fontWeight: "700", color: "#132238" },
  card: { marginTop: 16, borderRadius: 24, padding: 18, backgroundColor: "rgba(255,255,255,0.82)" },
  label: { color: "#6d7e90" },
  value: { marginTop: 8, fontSize: 24, fontWeight: "700", color: "#132238" }
});
