import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export const NotificationsScreen = () => (
  <SafeAreaView style={styles.container}>
    <Text style={styles.title}>Notifications</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>Session started</Text>
      <Text style={styles.body}>Billing has started for Workbay Central. Low-balance warnings will appear here too.</Text>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4fbff", padding: 16 },
  title: { fontSize: 28, fontWeight: "700", color: "#132238" },
  card: { marginTop: 16, borderRadius: 24, padding: 18, backgroundColor: "rgba(255,255,255,0.82)" },
  heading: { fontSize: 18, fontWeight: "700", color: "#132238" },
  body: { marginTop: 8, color: "#546577" }
});

