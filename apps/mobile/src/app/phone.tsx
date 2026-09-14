import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { PhoneValidationResult } from "@isthisvalid/core/phone-validator";
import { PHONE_FAQ_DATA } from "@isthisvalid/core/phone-faq-data";

import { ApiError, postJson } from "@/lib/api-client";
import { Colors } from "@/constants/colors";
import SectionHeader from "@/components/SectionHeader";
import FAQ from "@/components/FAQ";
import PhoneResultCard from "@/components/PhoneResultCard";

// Mirrors web's check/phone/page.tsx "How it works" <ol>.
const HOW_IT_WORKS: [string, string][] = [
  [
    "Format parsing",
    "Accepts E.164, national, and international formats from any country.",
  ],
  [
    "Numbering plan check",
    "Validates digit count and prefix against ITU-T rules for the identified country (via Google's libphonenumber).",
  ],
  [
    "Line type detection",
    "Identifies mobile, landline, VoIP, toll-free, and premium-rate numbers. Premium-rate and VoIP are the primary phone scam vectors.",
  ],
  [
    "Country & location",
    "Resolves the country from the calling code. US numbers are further mapped to state/region via area code.",
  ],
  [
    "Caribbean NANP warning",
    "+1 numbers registered outside the US, Canada, and territories are flagged for the one-ring scam (809, 876, 473, and others).",
  ],
  [
    "Carrier lookup (optional)",
    "AbstractAPI or NumVerify confirms the carrier name, active-line status, and refines the line type.",
  ],
];

export default function PhoneScreen() {
  // Prefilled when navigated here from the home screen's quick-check input.
  const { value: prefill } = useLocalSearchParams<{ value?: string }>();
  const [phone, setPhone] = useState(prefill ?? "");
  const [result, setResult] = useState<PhoneValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onChangeText(text: string) {
    setPhone(text);
    setResult(null);
    setError(null);
  }

  async function onSubmit() {
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const validated = await postJson<PhoneValidationResult>(
        "/api/validate-phone",
        { phone },
      );
      setResult(validated);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not reach the server.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Arriving here from the home screen's quick-check input should validate
  // immediately, not leave the user to press the button on a prefilled form.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (prefill && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void onSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
      <SectionHeader
        icon="📞"
        smallTitle="Phone Validator"
        largeTitle={
          <>
            Is this <Text style={styles.headlineAccent}>legit</Text>?
          </>
        }
        description="Paste any phone number and we'll identify the country, carrier, and line type — flagging VoIP and premium-rate numbers commonly used in phone scams."
      />

      <TextInput
        value={phone}
        onChangeText={onChangeText}
        placeholder="4155552671 or +44 7400 123456"
        placeholderTextColor={Colors.zinc500}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <Pressable
        onPress={onSubmit}
        disabled={loading || !phone.trim()}
        style={({ pressed }) => [
          styles.button,
          (loading || !phone.trim()) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.buttonText}>Is it valid? →</Text>
        )}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {result && <PhoneResultCard result={result} />}

      <View style={styles.howItWorks}>
        <Text style={styles.howItWorksHeading}>How it works</Text>
        {HOW_IT_WORKS.map(([title, detail], i) => (
          <View key={title} style={styles.howItWorksRow}>
            <Text style={styles.howItWorksNumber}>{i + 1}.</Text>
            <Text style={styles.howItWorksText}>
              <Text style={styles.howItWorksTitle}>{title}</Text> — {detail}
            </Text>
          </View>
        ))}
      </View>

      <FAQ
        data={PHONE_FAQ_DATA.map((item) => ({
          q: item.question,
          a: item.answer,
        }))}
        accentColor={Colors.teal400}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.zinc950 },
  content: { padding: 16, gap: 16 },
  headlineAccent: { color: Colors.teal400 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.zinc800,
    backgroundColor: Colors.zinc900,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.white,
  },
  button: {
    borderRadius: 12,
    backgroundColor: Colors.teal600,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonPressed: { backgroundColor: Colors.teal700 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: Colors.white, fontWeight: "600" },
  error: { color: Colors.rose400 },
  howItWorks: { gap: 10 },
  howItWorksHeading: { color: Colors.zinc300, fontWeight: "600", fontSize: 15 },
  howItWorksRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  howItWorksNumber: { color: Colors.zinc500, fontSize: 13, lineHeight: 19 },
  howItWorksText: {
    flex: 1,
    color: Colors.zinc400,
    fontSize: 13,
    lineHeight: 19,
  },
  howItWorksTitle: { color: Colors.zinc200, fontWeight: "700" },
});
