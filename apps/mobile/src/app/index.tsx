import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

interface Tool {
  href: "/email" | "/url" | "/phone" | "/text" | "/image";
  icon: string;
  name: string;
  tagline: string;
  /** Only "email" is wired to the real API in this scaffolding pass. */
  ready: boolean;
}

const TOOLS: Tool[] = [
  {
    href: "/email",
    icon: "📧",
    name: "Email",
    tagline: "Is this address real?",
    ready: true,
  },
  {
    href: "/url",
    icon: "🔗",
    name: "URL",
    tagline: "Safe to click?",
    ready: false,
  },
  {
    href: "/phone",
    icon: "📞",
    name: "Phone",
    tagline: "Scam call?",
    ready: false,
  },
  {
    href: "/text",
    icon: "💬",
    name: "Text / SMS",
    tagline: "Scam or legit?",
    ready: false,
  },
  {
    href: "/image",
    icon: "🖼️",
    name: "Image",
    tagline: "Real or faked?",
    ready: false,
  },
];

export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>IsThisValid</Text>
      <Text style={styles.subtitle}>
        Free, no-signup verification — pick a tool.
      </Text>

      {TOOLS.map((tool) => (
        <Link key={tool.href} href={tool.href} asChild>
          <Pressable
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.icon}>{tool.icon}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{tool.name}</Text>
              <Text style={styles.cardTagline}>{tool.tagline}</Text>
            </View>
            {!tool.ready && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Coming soon</Text>
              </View>
            )}
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.zinc950 },
  content: { padding: 16, gap: 12 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.white,
    marginBottom: 2,
  },
  subtitle: { color: Colors.zinc400, marginBottom: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.zinc800,
    backgroundColor: Colors.zinc900,
    padding: 16,
  },
  cardPressed: { opacity: 0.7 },
  icon: { fontSize: 28 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "600", color: Colors.white },
  cardTagline: { fontSize: 13, color: Colors.zinc400 },
  badge: {
    borderRadius: 999,
    backgroundColor: Colors.zinc800,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, color: Colors.zinc400 },
});
