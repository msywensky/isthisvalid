import { useState } from "react";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  detectInputKind,
  type DetectedKind,
} from "@isthisvalid/core/input-router";

import { Colors, withAlpha } from "@/constants/colors";
import SiteLogo from "@/components/SiteLogo";
import SectionHeader from "@/components/SectionHeader";

// Mirrors web's SmartInput.tsx — detection runs locally purely to show a
// hint as the user types.
const HINT: Record<DetectedKind, string> = {
  email: "Looks like an email address",
  url: "Looks like a link",
  phone: "Looks like a phone number",
  text: "Looks like a message",
};

interface Tool {
  href: "/email" | "/url" | "/phone" | "/text" | "/image";
  icon: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  cta: string;
  /** All five tools are wired to their real APIs. */
  ready: boolean;
}

// Order and copy mirror the web app's tool grid (src/app/page.tsx), minus QR
// (no shared code path for camera scanning on mobile — see CLAUDE.md §9).
const TOOLS: Tool[] = [
  {
    href: "/phone",
    icon: "📞",
    name: "Phone",
    tagline: "Scam call?",
    description:
      "Identify country, line type, and flag premium-rate or VoIP numbers used in callback scams.",
    accent: Colors.teal400,
    cta: "Check number",
    ready: true,
  },
  {
    href: "/text",
    icon: "💬",
    name: "Text / SMS",
    tagline: "Scam or legit?",
    description:
      "Paste a suspicious message — AI flags smishing, impersonation, and urgency tricks.",
    accent: Colors.violet400,
    cta: "Analyse text",
    ready: true,
  },
  {
    href: "/email",
    icon: "📧",
    name: "Email",
    tagline: "Is this address real?",
    description:
      "Validate syntax, check TLD, flag disposable providers, and verify mailbox delivery.",
    accent: Colors.amber400,
    cta: "Validate email",
    ready: true,
  },
  {
    href: "/url",
    icon: "🔗",
    name: "URL",
    tagline: "Safe to click?",
    description:
      "Spot phishing links, malware domains, and suspicious redirects before you click.",
    accent: Colors.sky400,
    cta: "Check URL",
    ready: true,
  },
  {
    href: "/image",
    icon: "🖼️",
    name: "Image",
    tagline: "Real or faked?",
    description:
      "AI vision checks for deepfakes, manipulated screenshots, and out-of-context photos.",
    accent: Colors.emerald400,
    cta: "Check image",
    ready: true,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [quickValue, setQuickValue] = useState("");

  const trimmed = quickValue.trim();
  const hint = trimmed === "" ? null : HINT[detectInputKind(trimmed).kind];

  function onQuickCheck() {
    if (trimmed === "") return;
    const detected = detectInputKind(trimmed);
    router.push({
      pathname: `/${detected.kind}`,
      params: { value: detected.value },
    });
    setQuickValue("");
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
      <View style={styles.hero}>
        <SiteLogo />
        <SectionHeader
          icon="🔍"
          smallTitle="Free verification tools"
          largeTitle={
            <>
              Is this <Text style={styles.headlineAccent}>real</Text>?
            </>
          }
          description="Pick something suspicious. We'll tell you if it's genuine, sketchy, or straight-up fake. No signup. No nonsense."
        />
      </View>
      <View style={styles.quickCheck}>
        <TextInput
          value={quickValue}
          onChangeText={setQuickValue}
          placeholder="Paste a link, email, phone number, or the whole text message…"
          placeholderTextColor={Colors.zinc500}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          numberOfLines={3}
          style={styles.quickCheckInput}
        />
        <View style={styles.quickCheckRow}>
          <Pressable
            onPress={onQuickCheck}
            disabled={trimmed === ""}
            style={({ pressed }) => [
              styles.quickCheckButton,
              trimmed === "" && styles.quickCheckButtonDisabled,
              pressed && trimmed !== "" && styles.quickCheckButtonPressed,
            ]}
          >
            <Text style={styles.quickCheckButtonText}>Check it →</Text>
          </Pressable>
          <Text style={styles.quickCheckHint}>
            {hint ?? "Not sure which tool you need? Start here."}
          </Text>
        </View>
      </View>

      <Text style={styles.pickToolLabel}>…or pick a specific tool:</Text>

      {TOOLS.map((tool) => (
        <Pressable
          key={tool.href}
          onPress={() => router.push(tool.href)}
          accessibilityRole="link"
          style={({ pressed }) => [
            styles.card,
            pressed && {
              borderColor: withAlpha(tool.accent, 0.7),
              backgroundColor: Colors.zinc800,
            },
            !tool.ready && styles.cardComingSoon,
          ]}
        >
          {!tool.ready && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Coming soon</Text>
            </View>
          )}

          <View style={styles.headerRow}>
            <Text style={styles.icon}>{tool.icon}</Text>
            <Text style={styles.name}>{tool.name}</Text>
          </View>
          <Text style={styles.tagline}>{tool.tagline}</Text>
          <Text style={styles.description}>{tool.description}</Text>
          <View style={styles.ctaRow}>
            <Text style={styles.ctaText}>{tool.cta}</Text>
            <Text style={styles.ctaArrow}>→</Text>
          </View>
        </Pressable>
      ))}

      <Text style={styles.trustLine}>
        Free to use · No account required · No personal data stored
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.zinc950 },
  content: { padding: 16, gap: 12 },
  hero: { alignItems: "center", paddingBottom: 4, gap: 4 },
  headlineAccent: { color: Colors.orange400 },
  quickCheck: { gap: 12, marginTop: 4 },
  quickCheckInput: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.zinc700,
    backgroundColor: Colors.zinc900,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.white,
    fontSize: 16,
    minHeight: 88,
    textAlignVertical: "top",
  },
  quickCheckRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  quickCheckButton: {
    borderRadius: 12,
    backgroundColor: Colors.orange500,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  quickCheckButtonDisabled: { opacity: 0.5 },
  quickCheckButtonPressed: { backgroundColor: Colors.orange600 },
  quickCheckButtonText: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: 15,
  },
  quickCheckHint: { flex: 1, fontSize: 13, color: Colors.zinc400 },
  pickToolLabel: { fontSize: 13, color: Colors.zinc400, marginTop: 4 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.zinc800,
    backgroundColor: Colors.zinc900,
    padding: 20,
    gap: 8,
  },
  cardComingSoon: { opacity: 0.5 },
  badge: {
    position: "absolute",
    top: 16,
    right: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.zinc800,
    backgroundColor: Colors.zinc800,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.zinc500,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { fontSize: 24 },
  name: { fontSize: 16, fontWeight: "600", color: Colors.zinc200 },
  tagline: { fontSize: 14, fontWeight: "500", color: Colors.zinc300 },
  description: { fontSize: 13, lineHeight: 18, color: Colors.zinc500 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  ctaText: { fontSize: 14, fontWeight: "500", color: Colors.zinc400 },
  ctaArrow: { fontSize: 14, color: Colors.zinc400 },
  trustLine: {
    fontSize: 12,
    color: Colors.zinc500,
    textAlign: "center",
    marginTop: 8,
  },
});
