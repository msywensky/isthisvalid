import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

/** Shared placeholder body for tool screens not yet wired to their API route. */
export function ComingSoon({
  icon,
  name,
  tagline,
}: {
  icon: string;
  name: string;
  tagline: string;
}) {
  return (
    <View style={styles.screen}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.tagline}>{tagline}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.zinc950,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  icon: { fontSize: 48 },
  name: { fontSize: 20, fontWeight: "600", color: Colors.white },
  tagline: { color: Colors.zinc400, textAlign: "center" },
  badge: {
    borderRadius: 999,
    backgroundColor: Colors.zinc800,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  badgeText: { color: Colors.zinc400, fontSize: 12 },
});
