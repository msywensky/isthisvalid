import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

export default function EmailScreen() {
  const [email, setEmail] = useState("");
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
          <ActivityIndicator color={Colors.zinc950} />
        ) : (
          <Text style={styles.buttonText}>Validate email</Text>
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
  buttonText: { color: Colors.zinc950, fontWeight: "600" },
  error: { color: Colors.rose400 },
});
