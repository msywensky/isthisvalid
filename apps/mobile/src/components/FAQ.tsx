import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

/**
 * Reusable FAQ accordion for every /check/* tool screen — mirrors the web
 * app's FAQ.tsx: a collapsed-by-default section that expands to reveal a
 * list of independently-expandable Q&A items (not a single-open accordion —
 * any number of items can be open at once, matching web's nested <details>).
 *
 * Web has separate per-tool FAQ components (FAQ.tsx, TextFAQ.tsx,
 * UrlFAQ.tsx, PhoneFAQ.tsx, ...) that share this exact structure and differ
 * only by data + accent color — this one component covers all of them via
 * the `data`/`accentColor` props rather than needing a copy per tool.
 */
export interface FAQItem {
  q: string;
  a: string;
}

interface FAQProps {
  data: FAQItem[];
  title?: string;
  /** Border tint when a section/item is open — defaults to the email tool's amber. */
  accentColor?: string;
}

export default function FAQ({
  data,
  title = "Frequently Asked Questions",
  accentColor = Colors.amber500,
}: FAQProps) {
  const [sectionOpen, setSectionOpen] = useState(false);

  return (
    <View
      style={[
        styles.section,
        sectionOpen && { borderColor: withAlpha(accentColor, 0.2) },
      ]}
    >
      <Pressable
        onPress={() => setSectionOpen((open) => !open)}
        style={styles.sectionHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: sectionOpen }}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Chevron open={sectionOpen} />
      </Pressable>

      {sectionOpen && (
        <View style={styles.list}>
          {data.map((item) => (
            <FAQRow key={item.q} item={item} accentColor={accentColor} />
          ))}
        </View>
      )}
    </View>
  );
}

function FAQRow({ item, accentColor }: { item: FAQItem; accentColor: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View
      style={[
        styles.item,
        open && {
          borderColor: withAlpha(accentColor, 0.3),
          backgroundColor: Colors.zinc900,
        },
      ]}
    >
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.itemHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.itemQuestion}>{item.q}</Text>
        <Chevron open={open} />
      </Pressable>
      {open && <Text style={styles.itemAnswer}>{item.a}</Text>}
    </View>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <Text
      style={[styles.chevron, open && styles.chevronOpen]}
      accessibilityElementsHidden
    >
      ▾
    </Text>
  );
}

/** Turns a "#rrggbb" token into an "rgba(r, g, b, alpha)" string. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.zinc800,
    backgroundColor: "rgba(24, 24, 27, 0.5)", // zinc-900/50
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: { color: Colors.zinc300, fontWeight: "600", fontSize: 16 },
  list: { gap: 8, paddingHorizontal: 8, paddingBottom: 12, paddingTop: 4 },
  item: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.zinc800,
    backgroundColor: "rgba(24, 24, 27, 0.5)", // zinc-900/50
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemQuestion: {
    flex: 1,
    color: Colors.zinc300,
    fontSize: 14,
    fontWeight: "500",
  },
  itemAnswer: {
    color: Colors.zinc400,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  chevron: { color: Colors.zinc500, fontSize: 14 },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
});
