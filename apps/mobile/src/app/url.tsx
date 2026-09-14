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

import type { UrlValidationResult } from "@isthisvalid/core/url-validator";
import { URL_FAQ_DATA } from "@isthisvalid/core/url-faq-data";

import { ApiError, postJson } from "@/lib/api-client";
import { Colors } from "@/constants/colors";
import SectionHeader from "@/components/SectionHeader";
import FAQ from "@/components/FAQ";
import UrlResultCard from "@/components/UrlResultCard";

// Mirrors web's check/url/page.tsx "How it works" <ol>.
const HOW_IT_WORKS: [string, string][] = [
  [
    "Parse & validate",
    "structural URL check, TLD verification, and brand-squatting detection across 52 known brands.",
  ],
  [
    "Live reachability",
    "sends a HEAD request to confirm the server is actually up.",
  ],
  [
    "Google Safe Browsing",
    "cross-references Google's malware and phishing database (when configured).",
  ],
  [
    "Phishing pattern analysis",
    "detects shorteners, Punycode homographs, embedded credentials, and suspicious path keywords.",
  ],
];

export default function UrlScreen() {
  // Prefilled when navigated here from the home screen's quick-check input.
  const { value: prefill } = useLocalSearchParams<{ value?: string }>();
  const [url, setUrl] = useState(prefill ?? "");
  const [result, setResult] = useState<UrlValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onChangeText(text: string) {
    setUrl(text);
    setResult(null);
    setError(null);
  }

  async function onSubmit() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const validated = await postJson<UrlValidationResult>(
        "/api/validate-url",
        { url: url.trim() },
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
        icon="🔗"
        smallTitle="URL Checker"
        largeTitle={
          <>
            Safe to <Text style={styles.headlineAccent}>click</Text>?
          </>
        }
        description="Paste a URL and we'll check whether it's a phishing link, malware domain, or just plain sketchy."
      />

      <TextInput
        value={url}
        onChangeText={onChangeText}
        placeholder="https://suspicious-link.example.com"
        placeholderTextColor={Colors.zinc500}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
      />

      <Pressable
        onPress={onSubmit}
        disabled={loading || !url.trim()}
        style={({ pressed }) => [
          styles.button,
          (loading || !url.trim()) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.buttonText}>Is it safe? →</Text>
        )}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {result && <UrlResultCard result={result} />}

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

      <FAQ data={URL_FAQ_DATA} accentColor={Colors.sky400} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.zinc950 },
  content: { padding: 16, gap: 16 },
  headlineAccent: { color: Colors.sky400 },
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
    backgroundColor: Colors.sky500,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonPressed: { backgroundColor: Colors.sky600 },
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
