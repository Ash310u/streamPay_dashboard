import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { mobileApiFetch } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

type Session = {
  id: string;
  status: string;
  venue_id: string;
  inr_equivalent: string;
  entry_time: string;
};

type Venue = {
  id: string;
  name: string;
  city: string;
  address: string;
};

export const HomeScreen = () => {
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();
  const { activeSessionId, setActiveSession, setLiveCharge } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [activeSession, setLocalSession] = useState<Session | null>(null);
  const [nearbyVenues, setNearbyVenues] = useState<Venue[]>([]);

  const checkActiveSession = async () => {
    try {
      const session = await mobileApiFetch<Session | null>("/sessions/active");
      if (session?.id) {
        setLocalSession(session);
        setActiveSession(session.id);
        setLiveCharge(Number(session.inr_equivalent ?? 0));
      } else {
        setLocalSession(null);
        setActiveSession(null);
      }
    } catch {
      // No active session
    }
  };

  const fetchVenues = async () => {
    try {
      const venues = await mobileApiFetch<Venue[]>("/venues");
      setNearbyVenues(venues.slice(0, 5));
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    void Promise.all([checkActiveSession(), fetchVenues()]).finally(() => setLoading(false));
  }, []);

  const handleResumeSession = () => {
    if (activeSession) {
      navigation.navigate("ActiveSession");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#7c3aed" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Welcome back</Text>

        {/* Active session banner */}
        {activeSession && (
          <TouchableOpacity style={styles.activeCard} onPress={handleResumeSession} activeOpacity={0.85}>
            <Text style={styles.activePill}>🟢 ACTIVE SESSION</Text>
            <Text style={styles.activeCharge}>₹{Number(activeSession.inr_equivalent).toFixed(2)} so far</Text>
            <Text style={styles.activeHint}>Tap to view details and end session →</Text>
          </TouchableOpacity>
        )}

        {/* Resume banner for exit_detected */}
        {activeSession?.status === "exit_detected" && (
          <View style={[styles.activeCard, { backgroundColor: "rgba(252,211,77,0.18)" }]}>
            <Text style={styles.activePill}>⚠️ EXIT DETECTED</Text>
            <Text style={styles.activeCharge}>Session pending closure</Text>
            <TouchableOpacity
              style={styles.resumeBtn}
              onPress={() => navigation.navigate("ActiveSession")}
              activeOpacity={0.8}
            >
              <Text style={styles.resumeBtnText}>Resume / Close Session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("QrScanner")} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={styles.actionLabel}>Scan QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Wallet")} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>👛</Text>
            <Text style={styles.actionLabel}>Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("History")} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Nearby venues */}
        <Text style={styles.sectionTitle}>Nearby Venues</Text>
        {nearbyVenues.map((venue) => (
          <View key={venue.id} style={styles.venueCard}>
            <Text style={styles.venueName}>{venue.name}</Text>
            <Text style={styles.venueAddr}>{venue.address} · {venue.city}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4fbff" },
  scroll: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontWeight: "700", color: "#132238", marginBottom: 4 },
  activeCard: { borderRadius: 24, padding: 20, backgroundColor: "rgba(124,58,237,0.1)", borderWidth: 1.5, borderColor: "#7c3aed" },
  activePill: { fontSize: 11, fontWeight: "700", color: "#7c3aed", letterSpacing: 1, textTransform: "uppercase" },
  activeCharge: { fontSize: 26, fontWeight: "700", color: "#132238", marginTop: 6 },
  activeHint: { fontSize: 13, color: "#546577", marginTop: 6 },
  resumeBtn: { marginTop: 12, borderRadius: 100, backgroundColor: "#f59e0b", paddingVertical: 10, alignItems: "center" },
  resumeBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  actionsRow: { flexDirection: "row", gap: 12 },
  actionBtn: { flex: 1, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.82)", padding: 16, alignItems: "center", shadowColor: "#7c3aed", shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  actionIcon: { fontSize: 28 },
  actionLabel: { marginTop: 8, fontSize: 13, fontWeight: "600", color: "#132238" },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#132238", marginTop: 4 },
  venueCard: { borderRadius: 20, padding: 16, backgroundColor: "rgba(255,255,255,0.82)", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  venueName: { fontWeight: "700", color: "#132238", fontSize: 15 },
  venueAddr: { color: "#5d6d7e", fontSize: 13, marginTop: 4 }
});
