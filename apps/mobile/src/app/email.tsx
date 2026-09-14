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

import type { EmailValidationResult } from "@isthisvalid/core/email-validator";
import { FAQ_DATA } from "@isthisvalid/core/faq-data";

import { ApiError, postJson } from "@/lib/api-client";
import { Colors } from "@/constants/colors";
import {
  ResultCard,
  type CheckItem,
  type Sentiment,
} from "@/components/ResultCard";
import SectionHeader from "@/components/SectionHeader";
import FAQ from "@/components/FAQ";

// Email-specific: derives the shared card's props from an
// EmailValidationResult. URL/Phone screens will define their own versions of
// these against their own result shape when they're wired up.
function getSentiment(result: EmailValidationResult): Sentiment {
  if (result.valid && result.score >= 70) return "valid";
  if (!result.checks.syntax || result.score < 30) return "invalid";
  return "warn";
}

function getCheckItems(result: EmailValidationResult): CheckItem[] {
  const items: CheckItem[] = [
    { label: "Syntax", pass: result.checks.syntax },
    { label: "Valid TLD", pass: result.checks.validTld },
    { label: "Not Disposable", pass: result.checks.notDisposable },
    { label: "Not Role-based", pass: result.checks.notRole },
  ];
  if (result.checks.hasMx !== null) {
    items.push({
      label: "Mail server (MX)",
      pass: result.checks.hasMx,
      wide: true,
    });
  }
  if (result.checks.apiDeliverable !== null) {
    items.push({
      label: "Mailbox reachable",
      pass: result.checks.apiDeliverable,
      wide: true,
    });
  }
  return items;
}

function getSourceLabel(result: EmailValidationResult): string {
  if (result.source === "zerobounce") return "ZeroBounce + local checks";
  if (result.source === "emailable") return "Emailable API + local checks";
  return "local checks";
}

// Mirrors web's check/email/page.tsx "How it works" <ol>.
const HOW_IT_WORKS: [string, string][] = [
  ["Syntax check", "RFC 5322 regex validates structure."],
  ["TLD check", "ensures the domain has a real top-level extension."],
  ["Disposable-domain check", "flags 57,000+ known throwaway providers."],
  [
    "MX record check",
    "looks up the domain's DNS mail records to confirm it can actually receive email.",
  ],
  [
    "Mailbox verification (optional)",
    "ZeroBounce or Emailable confirms whether the specific mailbox exists and accepts mail.",
  ],
];

export default function EmailScreen() {
  // Prefilled when navigated here from the home screen's quick-check input.
  const { value: prefill } = useLocalSearchParams<{ value?: string }>();
  const [email, setEmail] = useState(prefill ?? "");
  const [result, setResult] = useState<EmailValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onChangeText(text: string) {
    setEmail(text);
    // Editing after a result invalidates it — no stale card left showing
    // while the user is mid-edit.
    setResult(null);
    setError(null);
  }

  async function onSubmit() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const validated = await postJson<EmailValidationResult>("/api/validate", {
        email,
      });
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
  // The ref guards against StrictMode's double-invoked mount effect firing
  // two requests.
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
        icon="📧"
        smallTitle="Email Validator"
        largeTitle={
          <>
            Is this <Text style={styles.headlineAccent}>valid</Text>?
          </>
        }
        description="Paste any email address and we'll tell you if it's real, sketchy, or straight-up fake. No signup required."
      />

      <TextInput
        value={email}
        onChangeText={onChangeText}
        placeholder="name@example.com"
        placeholderTextColor={Colors.zinc500}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={styles.input}
      />

      <Pressable
        onPress={onSubmit}
        disabled={loading || !email.trim()}
        style={({ pressed }) => [
          styles.button,
          (loading || !email.trim()) && styles.buttonDisabled,
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

      {result && (
        <ResultCard
          score={result.score}
          sentiment={getSentiment(result)}
          message={result.message}
          detail={
            result.suggestion ? `Did you mean ${result.suggestion}?` : undefined
          }
          checks={getCheckItems(result)}
          source={getSourceLabel(result)}
        />
      )}

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

      <FAQ data={FAQ_DATA} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.zinc950 },
  content: { padding: 16, gap: 16 },
  headlineAccent: { color: Colors.amber400 },
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
    backgroundColor: Colors.amber500,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.8 },
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
