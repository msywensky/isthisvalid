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

import type { TextDebunkResult } from "@isthisvalid/core/text-debunker";
import { TEXT_FAQ_DATA } from "@isthisvalid/core/text-faq-data";

import { ApiError, postJson } from "@/lib/api-client";
import { Colors } from "@/constants/colors";
import SectionHeader from "@/components/SectionHeader";
import FAQ from "@/components/FAQ";
import TextResultCard from "@/components/TextResultCard";

type Phase = "idle" | "loading" | "result" | "error";

const EXAMPLE =
  "URGENT: Your bank account has been suspended. Click here to verify your identity immediately: http://secure-bank-verify.xyz";

/** Pre-baked result for the example — never calls the API. Mirrors web's TextCheckPage. */
const EXAMPLE_RESULT: TextDebunkResult = {
  classification: "smishing",
  confidence: 97,
  riskScore: 95,
  safe: false,
  summary:
    "This is a classic smishing (SMS phishing) message designed to create panic and steal banking credentials.",
  flags: [
    "Extreme urgency: 'URGENT' and 'immediately' pressure tactics",
    "Threat of account suspension to force action",
    "Suspicious domain: 'secure-bank-verify.xyz' is not a real bank domain",
    "Generic greeting — no personalisation typical of real banks",
    "Requests you follow an external link rather than use the bank's official app",
  ],
  explanation:
    "Legitimate banks never suspend accounts via SMS and never send links to third-party domains like '.xyz'. The combination of ALL-CAPS urgency, account-suspension threats, and a non-bank URL are textbook smishing hallmarks. Do not click the link. If you are worried about your account, call the number on the back of your card directly.",
  source: "claude",
};

const DETECTS: [string, string, string][] = [
  ["🎣", "Smishing", "Fake delivery, banking, and prize texts"],
  ["🎭", "Impersonation", "Messages pretending to be HMRC, banks, or couriers"],
  [
    "⏰",
    "Urgency tricks",
    '"Act now" / "Your account will be closed" pressure',
  ],
  ["🔗", "Suspicious links", "Shortened or typosquatted URLs embedded in text"],
  [
    "💸",
    "Advance-fee scams",
    "Requests for gift cards, wire transfers, or crypto",
  ],
];

export default function TextScreen() {
  // Prefilled when navigated here from the home screen's quick-check input.
  const { value: prefill } = useLocalSearchParams<{ value?: string }>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [value, setValue] = useState(prefill ?? "");
  const [result, setResult] = useState<TextDebunkResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit() {
    if (!value.trim() || phase === "loading") return;
    setPhase("loading");
    setResult(null);
    setErrorMsg("");
    try {
      const data = await postJson<TextDebunkResult>("/api/debunk/text", {
        message: value.trim(),
      });
      setResult(data);
      setPhase("result");
    } catch (e) {
      setErrorMsg(
        e instanceof ApiError
          ? e.message
          : "Network error. Please check your connection and try again.",
      );
      setPhase("error");
    }
  }

  function handleReset() {
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
    setValue("");
  }

  function handleTryExample() {
    setValue(EXAMPLE);
    setResult(EXAMPLE_RESULT);
    setPhase("result");
  }

  // Arriving here from the home screen's quick-check input should validate
  // immediately, not leave the user to press the button on a prefilled form.
  // The ref guards against StrictMode's double-invoked mount effect firing
  // two requests.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (prefill && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const showForm = phase === "idle" || phase === "loading";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
      <SectionHeader
        icon="💬"
        smallTitle="Text / SMS Checker"
        largeTitle={
          <>
            Scam or <Text style={styles.headlineAccent}>legit</Text>?
          </>
        }
        description="Paste a suspicious text or email message. AI flags smishing, impersonation, urgency tricks, and classic scam patterns."
      />

      {showForm && (
        <View style={styles.form}>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Paste the suspicious message here…"
            placeholderTextColor={Colors.zinc500}
            editable={phase !== "loading"}
            multiline
            numberOfLines={6}
            style={styles.textarea}
          />
          {value.length > 0 && (
            <Text style={styles.charCount}>
              {value.length} character{value.length !== 1 ? "s" : ""}
            </Text>
          )}
          <View style={styles.formRow}>
            <Pressable onPress={handleTryExample} hitSlop={8}>
              <Text style={styles.exampleLink}>Try an example</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={phase === "loading" || !value.trim()}
              style={({ pressed }) => [
                styles.submitButton,
                (phase === "loading" || !value.trim()) &&
                  styles.submitButtonDisabled,
                pressed && styles.submitButtonPressed,
              ]}
            >
              {phase === "loading" ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.white} size="small" />
                  <Text style={styles.submitButtonText}>Analysing…</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>Analyse →</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {phase === "result" && result && (
        <View style={styles.resultBlock}>
          <TextResultCard result={result} />
          <Pressable onPress={handleReset} hitSlop={8}>
            <Text style={styles.resetLink}>← Check another message</Text>
          </Pressable>
        </View>
      )}

      {phase === "error" && (
        <View style={styles.resultBlock}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
          <Pressable onPress={handleReset} hitSlop={8}>
            <Text style={styles.resetLink}>← Try again</Text>
          </Pressable>
        </View>
      )}

      {showForm && (
        <View style={styles.detects}>
          <Text style={styles.detectsHeading}>What AI will detect</Text>
          {DETECTS.map(([icon, name, detail]) => (
            <View key={name} style={styles.detectRow}>
              <Text style={styles.detectIcon}>{icon}</Text>
              <Text style={styles.detectText}>
                <Text style={styles.detectName}>{name}</Text> — {detail}
              </Text>
            </View>
          ))}
        </View>
      )}

      <FAQ
        data={TEXT_FAQ_DATA.map((item) => ({
          q: item.question,
          a: item.answer,
        }))}
        accentColor={Colors.violet400}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.zinc950 },
  content: { padding: 16, gap: 16 },
  headlineAccent: { color: Colors.violet400 },
  form: { gap: 10 },
  textarea: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.zinc700,
    backgroundColor: Colors.zinc900,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.white,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 130,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: Colors.zinc400,
    textAlign: "right",
    marginTop: -4,
  },
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  exampleLink: {
    fontSize: 12,
    color: Colors.zinc400,
    textDecorationLine: "underline",
  },
  submitButton: {
    borderRadius: 12,
    backgroundColor: Colors.violet500,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonPressed: { backgroundColor: Colors.violet600 },
  submitButtonText: { color: Colors.white, fontWeight: "600", fontSize: 14 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultBlock: { gap: 12 },
  resetLink: {
    fontSize: 14,
    color: Colors.violet400,
    textDecorationLine: "underline",
  },
  errorBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.roseBorder,
    backgroundColor: Colors.rose950,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  errorText: { color: Colors.rose400, fontWeight: "600", fontSize: 14 },
  detects: { gap: 10 },
  detectsHeading: { color: Colors.zinc300, fontWeight: "600", fontSize: 15 },
  detectRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detectIcon: { fontSize: 14 },
  detectText: { flex: 1, color: Colors.zinc400, fontSize: 13, lineHeight: 19 },
  detectName: { color: Colors.zinc200, fontWeight: "700" },
});
