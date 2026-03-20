import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mobileApiFetch } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

export const QrScannerScreen = ({ navigation }: NativeStackScreenProps<any>) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState("Point the camera at the entry or exit QR.");
  const setActiveSession = useAppStore((state) => state.setActiveSession);

  if (!permission?.granted) {
    void requestPermission();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Scan QR</Text>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"]
          }}
          onBarcodeScanned={async ({ data }) => {
            try {
              const parsed = JSON.parse(data) as {
                venueId: string;
                pricingPlanId?: string;
                action?: "exit";
                nonce: string;
                expiresAt: string;
                signature: string;
              };

              if (parsed.action === "exit") {
                await mobileApiFetch("/sessions/qr-stop", {
                  method: "POST",
                  body: JSON.stringify({
                    token: parsed,
                    idempotencyKey: `qr_stop_${Date.now()}`
                  })
                });
                setActiveSession(null);
                setMessage("Exit QR accepted. Session closed.");
              } else {
                const session = await mobileApiFetch<{ id: string }>("/sessions/qr-start", {
                  method: "POST",
                  body: JSON.stringify({
                    token: parsed,
                    idempotencyKey: `qr_start_${Date.now()}`
                  })
                });
                setActiveSession(session.id);
                setMessage("Entry QR accepted. Session started.");
              }
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "QR scan failed");
            }
          }}
        />
      </View>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.link} onPress={() => navigation.goBack()}>
        Back
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f4fbff"
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#132238"
  },
  cameraWrap: {
    marginTop: 16,
    height: 420,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#dfeaf5"
  },
  message: {
    marginTop: 16,
    color: "#546577"
  },
  link: {
    marginTop: 16,
    color: "#ff5ea8",
    fontWeight: "700"
  }
});
