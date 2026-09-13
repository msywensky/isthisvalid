/*
 * SectionHeader component
 * Displays a header for a section within the app — icon + tool name,
 * headline, and description. Mirrors the web app's CheckShell hero
 * (icon/label/headline/sub, center-aligned), minus the back-nav bar: Expo
 * Router's Stack already provides native back navigation, so there's
 * nothing to port there.
 */

import type { ReactNode } from "react";
import { Text, View, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

type SectionHeaderProps = {
  icon: string;
  smallTitle: string;
  /** ReactNode (not string) so callers can colour/bold a span — see CheckShell. */
  largeTitle: ReactNode;
  description: string;
};

export default function SectionHeader({
  icon,
  smallTitle,
  largeTitle,
  description,
}: SectionHeaderProps) {
  return (
    <View>
      <View style={styles.smallheaderRow}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.smallheader}>{smallTitle}</Text>
      </View>
      <Text style={styles.largeheader}>{largeTitle}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  smallheaderRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginVertical: 8,
  },
  icon: { fontSize: 16 },
  smallheader: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    // Brand orange — shared across every tool screen, not a per-tool
    // accent. Each screen's own headline/description supplies its accent
    // color separately (see email.tsx's headlineAccent).
    color: Colors.orange400,
  },
  largeheader: {
    // Matches CheckShell's h1: text-4xl (the mobile-first size — sm:text-5xl
    // only applies at >=640px, irrelevant on a phone) font-extrabold tracking-tight.
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.5,
    fontWeight: "800",
    color: Colors.white,
    marginVertical: 8,
    textAlign: "center",
  },
  description: {
    // Matches CheckShell's sub <p>: text-base (mobile-first; sm:text-lg is 18px only >=640px).
    fontSize: 16,
    lineHeight: 24,
    color: Colors.zinc300,
    marginVertical: 4,
    textAlign: "center",
  },
});
