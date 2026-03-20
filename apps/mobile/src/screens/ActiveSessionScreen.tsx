import { useEffect, useRef, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { createMobileRealtime } from "../lib/realtime";
import { mobileApiFetch } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

export const ActiveSessionScreen = () => {
  const navigation = useNavigation();
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const liveChargeInr = useAppStore((s) => s.liveChargeInr);
  const setLiveCharge = useAppStore((s) => s.setLiveCharge);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [closingSession, setClosingSession] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live billing tick
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // WebSocket + polling fallback
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    void (async () => {
      const socket = await createMobileRealtime();

      socket.on("billing:charge_update", (payload: { chargeInr?: number }) => {
        if (typeof payload.chargeInr === "number") {
          setLiveCharge(payload.chargeInr);
        }
      });

      socket.on("session:closed", () => {
        setLiveCharge(0);
        setActiveSession(null);
        navigation.goBack();
      });

      cleanup = () => socket.disconnect();
    })();

    // Polling fallback — every 10 s refresh charge from server
    pollRef.current = setInterval(async () => {
      if (!activeSessionId) return;
      try {
        const session = await mobileApiFetch<{ inr_equivalent?: string }>(`/sessions/${activeSessionId}`);
        if (session.inr_equivalent) {
          setLiveCharge(Number(session.inr_equivalent));
        }
      } catch {
        // ignore — WS will recover
      }
    }, 10_000);

    return () => {
      cleanup?.();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeSessionId, setLiveCharge, setActiveSession, navigation]);

  const handleEndSession = () => {
    Alert.alert(
      "End Session",
      "Are you sure you want to end this session and settle charges?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Session",
          style: "destructive",
          onPress: async () => {
            if (!activeSessionId) return;
            setClosingSession(true);
            try {
              await mobileApiFetch(`/sessions/${activeSessionId}/close`, {
                method: "POST",
                body: JSON.stringify({ triggerMode: "self_checkout" })
              });
              setLiveCharge(0);
              setActiveSession(null);
              navigation.goBack();
            } catch (err) {
              Alert.alert("Error", String(err));
            } finally {
              setClosingSession(false);
            }
          }
        }
      ]
    );
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}h ${m}m ${sec}s`
      : m > 0
      ? `${m}m ${sec}s`
      : `${sec}s`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Active Session</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Duration</Text>
        <Text style={styles.duration}>{formatDuration(elapsedSeconds)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Running charge</Text>
        <Text style={styles.charge}>₹{liveChargeInr.toFixed(2)}</Text>
        <Text style={styles.helper}>Live · updates every second via WebSocket (polling every 10 s as fallback)</Text>
      </View>

      <TouchableOpacity
        style={[styles.endBtn, closingSession && styles.btnDisabled]}
        onPress={handleEndSession}
        disabled={closingSession}
        activeOpacity={0.8}
      >
        <Text style={styles.endBtnText}>{closingSession ? "Closing…" : "⏹ End Session & Pay"}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4fbff", padding: 20, gap: 16 },
  title: { fontSize: 28, fontWeight: "700", color: "#132238" },
  card: { borderRadius: 24, padding: 20, backgroundColor: "rgba(255,255,255,0.82)", shadowColor: "#7c3aed", shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
  label: { fontSize: 13, color: "#5d6d7e" },
  duration: { marginTop: 6, fontSize: 28, fontWeight: "700", color: "#132238" },
  charge: { marginTop: 6, fontSize: 36, fontWeight: "700", color: "#ff5ea8" },
  helper: { marginTop: 10, color: "#546577", fontSize: 12, lineHeight: 18 },
  endBtn: { borderRadius: 100, backgroundColor: "#ef4444", paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  endBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
