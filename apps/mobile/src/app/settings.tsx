import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

// Single source of truth is app.json's expo.version — read at runtime
// instead of hardcoding a copy here that would drift on the next release.
const APP_VERSION = Constants.expoConfig?.version ?? null;

// Legal/info pages are static, long-form copy that changes independently of
// app releases — opened in-app via expo-web-browser rather than ported to
// native screens, so there's one source of truth and no risk of the RN copy
// drifting from the Privacy Policy / Terms actually in effect on the site.
const SITE_URL = "https://isthisvalid.com";

interface LinkRow {
  label: string;
  description: string;
  path: string;
}

const LINKS: LinkRow[] = [
  {
    label: "About",
    description: "What IsThisValid is and how it works",
    path: "/about",
  },
  {
    label: "Privacy Policy",
    description: "How we handle your data",
    path: "/privacy",
  },
  {
    label: "Terms of Service",
    description: "Terms for using this app",
    path: "/terms",
  },
];

export default function SettingsScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
      <Text style={styles.sectionLabel}>About &amp; Legal</Text>
      <View style={styles.list}>
        {LINKS.map((link, i) => (
          <Pressable
            key={link.path}
            onPress={() =>
              WebBrowser.openBrowserAsync(`${SITE_URL}${link.path}`)
            }
            style={({ pressed }) => [
              styles.row,
              i !== 0 && styles.rowBorder,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{link.label}</Text>
              <Text style={styles.rowDescription}>{link.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      {APP_VERSION && <Text style={styles.version}>Version {APP_VERSION}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.zinc950 },
  content: { padding: 16, gap: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.zinc500,
    marginBottom: 2,
    marginLeft: 4,
  },
  list: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.zinc800,
    backgroundColor: Colors.zinc900,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.zinc800 },
  rowPressed: { backgroundColor: Colors.zinc800 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: Colors.white, fontSize: 15, fontWeight: "500" },
  rowDescription: { color: Colors.zinc500, fontSize: 12 },
  chevron: { color: Colors.zinc500, fontSize: 20 },
  version: {
    color: Colors.zinc500,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});
