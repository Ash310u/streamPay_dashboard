import { useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mobileApiFetch } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

export const QrScannerScreen = ({ navigation }: NativeStackScreenProps<Record<string, object | undefined>>) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState("Point the camera at the venue entry QR code.");
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const setLiveCharge = useAppStore((s) => s.setLiveCharge);

  if (!permission?.granted) {
    void requestPermission();
  }

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      // Support both JSON payload and deeplink URL
      let venueId: string;
      let pricingPlanId: string | undefined;
      let nonce: string;
      let isExit = false;

      if (data.startsWith("detrix://")) {
        // Parse deeplink: detrix://venue/<venueId>?plan=<planId>&nonce=<nonce>
        const url = new URL(data.replace("detrix://", "https://detrix.app/"));
        const parts = url.pathname.split("/").filter(Boolean);
        venueId = parts[1] ?? "";
        pricingPlanId = url.searchParams.get("plan") ?? undefined;
        nonce = url.searchParams.get("nonce") ?? String(Date.now());
        isExit = url.searchParams.get("action") === "exit";
      } else {
        const parsed = JSON.parse(data) as {
          venueId: string;
          pricingPlanId?: string;
          action?: "exit";
          nonce: string;
          expiresAt: string;
          signature: string;
        };
        venueId = parsed.venueId;
        pricingPlanId = parsed.pricingPlanId;
        nonce = parsed.nonce;
        isExit = parsed.action === "exit";
      }

      if (!venueId) throw new Error("Invalid QR — could not parse venue ID");

      if (isExit) {
        await mobileApiFetch("/sessions/qr-stop", {
          method: "POST",
          body: JSON.stringify({ venueId, nonce, idempotencyKey: `qr_stop_${nonce}` })
        });
        setActiveSession(null);
        setLiveCharge(0);
        setMessage("Session closed. Charges have been settled.");
        setTimeout(() => navigation.navigate("MainTabs" as never), 1500);
      } else {
        const session = await mobileApiFetch<{ id: string; inr_equivalent?: string }>("/sessions/qr-start", {
          method: "POST",
          body: JSON.stringify({ venueId, pricingPlanId, nonce, idempotencyKey: `qr_start_${nonce}` })
        });
        setActiveSession(session.id);
        setLiveCharge(Number(session.inr_equivalent ?? 0));
        setMessage("✅ Session started! Billing is now running.");
        // Navigate to ActiveSession tab
        setTimeout(() => {
          (navigation as unknown as { navigate: (screen: string, params?: unknown) => void }).navigate(
            "MainTabs",
            { screen: "ActiveSession" }
          );
        }, 800);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "QR scan failed";
      // Handle specific API errors
      if (msg.includes("Insufficient")) {
        Alert.alert(
          "Insufficient Balance",
          "Your wallet balance is below the venue minimum. Please top up to continue.",
          [
            { text: "Top Up", onPress: () => navigation.navigate("MainTabs" as never) },
            { text: "Cancel", style: "cancel" }
          ]
        );
      } else if (msg.includes("already exists")) {
        Alert.alert("Session Already Active", "You already have an active session.", [
          { text: "View Session", onPress: () => navigation.navigate("MainTabs" as never) }
        ]);
      } else {
        Alert.alert("Error", msg, [{ text: "Try Again", onPress: () => setScanned(false) }]);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Scan QR</Text>

      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : (e) => { void handleScan(e); }}
          />
        ) : (
          <View style={styles.noPerm}>
            <Text style={styles.noPermText}>Camera permission required</Text>
          </View>
        )}

        {/* Viewfinder overlay */}
        <View style={styles.overlay}>
          <View style={styles.frame} />
        </View>
      </View>

      <Text style={[styles.message, message.startsWith("✅") && styles.messageSuccess]}>
        {message}
      </Text>

      <Text style={styles.link} onPress={() => navigation.goBack()}>← Back</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0a0a1a" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 16 },
  cameraWrap: { height: 380, borderRadius: 28, overflow: "hidden", backgroundColor: "#1a1a2e", position: "relative" },
  noPerm: { flex: 1, justifyContent: "center", alignItems: "center" },
  noPermText: { color: "#fff", fontSize: 15 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  frame: { width: 220, height: 220, borderWidth: 2, borderColor: "#ff5ea8", borderRadius: 16, backgroundColor: "transparent" },
  message: { marginTop: 20, color: "#a0aec0", fontSize: 14, textAlign: "center", lineHeight: 22 },
  messageSuccess: { color: "#22c55e", fontWeight: "600" },
  link: { marginTop: 12, color: "#ff5ea8", fontWeight: "700", textAlign: "center" }
});
