import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase";
import { registerForPushNotifications } from "../lib/notifications";

export const AuthScreen = ({ navigation }: NativeStackScreenProps<any>) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Unified access</Text>
        <Text style={styles.title}>Customer and merchant sign in share the same entry.</Text>
        <View style={styles.switchRow}>
          {(["login", "signup"] as const).map((item) => (
            <Pressable key={item} onPress={() => setMode(item)} style={[styles.switchButton, mode === item && styles.switchButtonActive]}>
              <Text style={[styles.switchLabel, mode === item && styles.switchLabelActive]}>{item === "login" ? "Sign in" : "Sign up"}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
        <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />

        <Pressable
          style={styles.primaryButton}
          onPress={async () => {
            if (mode === "signup") {
              await supabase.auth.signUp({ email, password });
            } else {
              await supabase.auth.signInWithPassword({ email, password });
            }

            await registerForPushNotifications();
            navigation.replace("MainTabs");
          }}
        >
          <Text style={styles.primaryLabel}>{mode === "login" ? "Continue" : "Create account"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f4fbff"
  },
  panel: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.82)"
  },
  eyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 3,
    color: "#6d7e90"
  },
  title: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: "700",
    color: "#132238"
  },
  switchRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
    marginBottom: 20
  },
  switchButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#ffffff"
  },
  switchButtonActive: {
    backgroundColor: "#ff5ea8"
  },
  switchLabel: {
    textAlign: "center",
    color: "#132238"
  },
  switchLabelActive: {
    color: "#ffffff",
    fontWeight: "700"
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: "#ffffff"
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: "#132238"
  },
  primaryLabel: {
    textAlign: "center",
    color: "#ffffff",
    fontWeight: "700"
  }
});
