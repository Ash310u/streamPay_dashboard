import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { mobileApiFetch } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

type Wallet = {
  id: string;
  balance_crypto: string;
  balance_inr_equivalent: string;
  currency_code: string;
};

type Transaction = {
  id: string;
  type: string;
  inr_amount: number;
  created_at: string;
  status: string;
};

export const WalletScreen = () => {
  const { wallet, walletTransactions, setWallet, setTransactions } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const [w, txns] = await Promise.all([
        mobileApiFetch<Wallet>("/wallet/balance"),
        mobileApiFetch<Transaction[]>("/wallet/transactions")
      ]);
      setWallet(w);
      setTransactions(txns);
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchWallet(); }, []);

  const handleTopUp = async () => {
    setTopupLoading(true);
    try {
      const order = await mobileApiFetch<{
        orderId: string;
        amount: number;
        keyId: string;
        currency: string;
        mode: "live" | "demo";
      }>("/wallet/topup/order", { method: "POST", body: JSON.stringify({ amountInr: 500, currency: "INR" }) });

      let paymentId = `demo_${Date.now()}`;

      if (order.mode === "live" && order.keyId) {
        const RazorpayCheckout = (await import("react-native-razorpay")).default;
        const result = await RazorpayCheckout.open({
          key: order.keyId,
          order_id: order.orderId,
          name: "Detrix",
          description: "Wallet top-up",
          amount: String(order.amount),
          currency: order.currency,
          prefill: {}
        });
        paymentId = result?.razorpay_payment_id ?? paymentId;
      }

      await mobileApiFetch("/wallet/topup/verify", {
        method: "POST",
        body: JSON.stringify({ amountInr: 500, paymentId })
      });

      Alert.alert("Top-up successful!", "Your wallet has been credited.");
      void fetchWallet();
    } catch (err: unknown) {
      // Razorpay throws {code, description} on cancel
      const razErr = err as { description?: string } | null;
      if (razErr?.description !== "Payment cancelled by user.") {
        Alert.alert("Top-up failed", razErr?.description ?? String(err));
      }
    } finally {
      setTopupLoading(false);
    }
  };

  const formatType = (type: string) => ({
    top_up: "Top-up",
    session_debit: "Session",
    refund: "Refund",
    adjustment: "Adjustment"
  }[type] ?? type);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Wallet</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 32 }} />
        ) : (
          <>
            {/* Balance card */}
            <View style={styles.card}>
              <Text style={styles.label}>Available balance</Text>
              <Text style={styles.balanceLarge}>
                ₹{Number(wallet?.balance_inr_equivalent ?? 0).toFixed(2)}
              </Text>
              <Text style={styles.subBalance}>
                {Number(wallet?.balance_crypto ?? 0).toFixed(6)} {wallet?.currency_code ?? "USDC"}
              </Text>
            </View>

            {/* Top-up */}
            <TouchableOpacity
              style={[styles.btn, topupLoading && styles.btnDisabled]}
              onPress={handleTopUp}
              disabled={topupLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>{topupLoading ? "Opening checkout…" : "⚡ Top-Up Wallet"}</Text>
            </TouchableOpacity>

            {/* Transaction history */}
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {(walletTransactions ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No transactions yet</Text>
            ) : (
              walletTransactions?.map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txType}>{formatType(tx.type)}</Text>
                    <Text style={styles.txDate}>
                      {new Date(tx.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, tx.type === "session_debit" && styles.debit]}>
                    {tx.type === "session_debit" ? "−" : "+"}₹{Math.abs(tx.inr_amount).toFixed(2)}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4fbff" },
  scroll: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontWeight: "700", color: "#132238", marginBottom: 4 },
  card: { borderRadius: 24, padding: 22, backgroundColor: "rgba(255,255,255,0.82)", shadowColor: "#7c3aed", shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  label: { fontSize: 13, color: "#5d6d7e" },
  balanceLarge: { marginTop: 8, fontSize: 36, fontWeight: "700", color: "#132238" },
  subBalance: { marginTop: 4, fontSize: 13, color: "#7c3aed" },
  btn: { borderRadius: 100, backgroundColor: "#ff5ea8", paddingVertical: 16, alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#132238", marginTop: 8 },
  emptyText: { color: "#5d6d7e", fontSize: 14 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  txType: { fontWeight: "600", color: "#132238", fontSize: 14 },
  txDate: { color: "#5d6d7e", fontSize: 12, marginTop: 2 },
  txAmount: { fontWeight: "700", fontSize: 16, color: "#22c55e" },
  debit: { color: "#ef4444" }
});
