import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  validateEmailLocal,
  type EmailValidationResult,
} from "@isthisvalid/core/email-validator";

import { ApiError, postJson } from "@/lib/api-client";
import { Colors } from "@/constants/colors";

type Sentiment = "valid" | "warn" | "invalid";

function getSentiment(result: EmailValidationResult): Sentiment {
  if (result.valid && result.score >= 70) return "valid";
  if (!result.checks.syntax || result.score < 30) return "invalid";
  return "warn";
}

const sentimentStyles: Record<
  Sentiment,
  { border: string; bg: string; badge: string }
> = {
  valid: {
    border: Colors.limeBorder,
    bg: Colors.lime950,
    badge: Colors.lime600,
  },
  warn: {
    border: Colors.yellowBorder,
    bg: Colors.yellow950,
    badge: Colors.yellow600,
  },
  invalid: {
    border: Colors.roseBorder,
    bg: Colors.rose950,
    badge: Colors.rose600,
  },
};

function ResultCard({
  result,
  label,
}: {
  result: EmailValidationResult;
  label: string;
}) {
  const s = sentimentStyles[getSentiment(result)];
  return (
    <View
      style={[styles.card, { borderColor: s.border, backgroundColor: s.bg }]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{label}</Text>
        <View style={[styles.scoreBadge, { backgroundColor: s.badge }]}>
          <Text style={styles.scoreBadgeText}>{result.score}/100</Text>
        </View>
      </View>
      <Text style={styles.message}>{result.message}</Text>
      {result.suggestion && (
        <Text style={styles.suggestion}>Did you mean {result.suggestion}?</Text>
      )}
      <Text style={styles.source}>source: {result.source}</Text>
    </View>
  );
}

export default function EmailScreen() {
  const [email, setEmail] = useState("");
  const [localResult, setLocalResult] = useState<EmailValidationResult | null>(
    null,
  );
  const [apiResult, setApiResult] = useState<EmailValidationResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onChangeText(text: string) {
    setEmail(text);
    setApiResult(null);
    setError(null);
    // Instant local-phase feedback — same progressive-enrichment pattern as
    // the web app: cheap on-device checks first, network call second.
    setLocalResult(text.trim() ? validateEmailLocal(text) : null);
  }

  async function onSubmit() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await postJson<EmailValidationResult>("/api/validate", {
        email,
      });
      setApiResult(result);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not reach the server.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Enter an email address to check its syntax, domain, and deliverability.
      </Text>

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
          <ActivityIndicator color={Colors.zinc950} />
        ) : (
          <Text style={styles.buttonText}>Validate email</Text>
        )}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {localResult && (
        <ResultCard result={localResult} label="Instant local check" />
      )}
      {apiResult && (
        <ResultCard result={apiResult} label="Full server result" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.zinc950 },
  content: { padding: 16, gap: 16 },
  intro: { color: Colors.zinc400 },
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
  buttonText: { color: Colors.zinc950, fontWeight: "600" },
  error: { color: Colors.rose400 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLabel: { color: Colors.white, fontWeight: "600" },
  scoreBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  scoreBadgeText: { color: Colors.white, fontSize: 12, fontWeight: "700" },
  message: { color: Colors.zinc300 },
  suggestion: { color: Colors.amber500, fontSize: 13 },
  source: { color: Colors.zinc500, fontSize: 11 },
});
