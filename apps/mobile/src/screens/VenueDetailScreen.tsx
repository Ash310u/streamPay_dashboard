import { useState, useEffect } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mobileApiFetch } from "../lib/api";

type VenueDetail = {
  id: string;
  name: string;
  address: string;
  city: string;
  category: string;
  operating_hours: string | null;
  contact_phone: string | null;
  description: string | null;
  merchant_id: string;
};

type PricingPlan = {
  id: string;
  name: string;
  billing_unit: string;
  rate_inr_equivalent: string;
  minimum_charge_inr: string;
  maximum_cap_inr: string | null;
  base_fee_inr: string;
  grace_period_seconds: number;
};

type Geofence = {
  type: "circle" | "polygon";
  center_lat?: string;
  center_lng?: string;
  radius_meters?: number;
};

export const VenueDetailScreen = ({ route, navigation }: NativeStackScreenProps<any>) => {
  const venueId = (route.params as { venueId: string })?.venueId;
  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [geofence, setGeofence] = useState<Geofence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [v, p, g] = await Promise.all([
          mobileApiFetch<VenueDetail>(`/venues/${venueId}`),
          mobileApiFetch<PricingPlan[]>(`/venues/${venueId}/pricing`),
          mobileApiFetch<Geofence | null>(`/venues/${venueId}/geofence`)
        ]);
        setVenue(v);
        setPlans(p);
        setGeofence(g);
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [venueId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#7c3aed" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!venue) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>Venue not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>← Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{venue.name}</Text>
        <Text style={styles.subtitle}>{venue.address} · {venue.city}</Text>

        {venue.category && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{venue.category}</Text>
          </View>
        )}

        {venue.description && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>About</Text>
            <Text style={styles.cardText}>{venue.description}</Text>
          </View>
        )}

        {venue.operating_hours && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Operating Hours</Text>
            <Text style={styles.cardText}>{venue.operating_hours}</Text>
          </View>
        )}

        {venue.contact_phone && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Contact</Text>
            <Text style={styles.cardText}>{venue.contact_phone}</Text>
          </View>
        )}

        {geofence && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Coverage</Text>
            <Text style={styles.cardText}>
              {geofence.type === "circle"
                ? `${geofence.radius_meters}m radius from center`
                : "Custom polygon area"}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Pricing Plans</Text>
        {plans.length === 0 ? (
          <Text style={styles.muted}>No pricing plans available.</Text>
        ) : (
          plans.map((plan) => (
            <View key={plan.id} style={styles.planCard}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planRate}>
                ₹{plan.rate_inr_equivalent} / {plan.billing_unit.replace("per_", "")}
              </Text>
              <Text style={styles.planDetail}>
                Min ₹{plan.minimum_charge_inr} · Base ₹{plan.base_fee_inr} · Grace {plan.grace_period_seconds}s
                {plan.maximum_cap_inr ? ` · Cap ₹${plan.maximum_cap_inr}` : ""}
              </Text>
              <TouchableOpacity
                style={styles.entryBtn}
                onPress={() => navigation.navigate("QrScanner", { venueId, planId: plan.id })}
                activeOpacity={0.8}
              >
                <Text style={styles.entryBtnText}>📷 Scan QR to Enter</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a1a" },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  link: { color: "#ff5ea8", fontWeight: "700", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 14, color: "#a0aec0", marginTop: 4 },
  badge: { alignSelf: "flex-start", borderRadius: 100, backgroundColor: "rgba(124,58,237,0.2)", paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  badgeText: { color: "#7c3aed", fontWeight: "600", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  card: { borderRadius: 20, padding: 16, backgroundColor: "rgba(255,255,255,0.06)" },
  cardLabel: { fontSize: 11, color: "#7c3aed", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  cardText: { color: "#cbd5e1", fontSize: 14, lineHeight: 22 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginTop: 8 },
  muted: { color: "#64748b", fontSize: 14 },
  planCard: { borderRadius: 20, padding: 16, backgroundColor: "rgba(255,255,255,0.06)", gap: 6 },
  planName: { fontWeight: "700", color: "#fff", fontSize: 16 },
  planRate: { fontSize: 22, fontWeight: "700", color: "#ff5ea8" },
  planDetail: { fontSize: 12, color: "#94a3b8" },
  entryBtn: { marginTop: 8, borderRadius: 100, backgroundColor: "#7c3aed", padding: 14, alignItems: "center" },
  entryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  error: { color: "#ef4444", fontSize: 16, textAlign: "center", marginTop: 40 }
});
