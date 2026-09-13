import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import {
  validateEmailLocal,
  type EmailValidationResult,
} from "@isthisvalid/core/email-validator";

import { ApiError, postJson } from "@/lib/api-client";
import { Colors } from "@/constants/colors";
import { ResultCard, type Sentiment } from "@/components/ResultCard";

// Email-specific: derives the shared card's Sentiment from an
// EmailValidationResult. URL/Phone screens will define their own version of
// this against their own result shape when they're wired up.
function getSentiment(result: EmailValidationResult): Sentiment {
  if (result.valid && result.score >= 70) return "valid";
  if (!result.checks.syntax || result.score < 30) return "invalid";
  return "warn";
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
        <ResultCard
          label="Instant local check"
          score={localResult.score}
          sentiment={getSentiment(localResult)}
          message={localResult.message}
          detail={
            localResult.suggestion
              ? `Did you mean ${localResult.suggestion}?`
              : undefined
          }
          source={localResult.source}
        />
      )}
      {apiResult && (
        <ResultCard
          label="Full server result"
          score={apiResult.score}
          sentiment={getSentiment(apiResult)}
          message={apiResult.message}
          detail={
            apiResult.suggestion
              ? `Did you mean ${apiResult.suggestion}?`
              : undefined
          }
          source={apiResult.source}
        />
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
});
