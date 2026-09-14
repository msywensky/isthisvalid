import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text } from "react-native";

import { Colors } from "@/constants/colors";

// Index's header is otherwise hidden (see below) — this is the only chrome
// on the home screen, so it's rendered as a headerRight rather than inline
// in index.tsx's scroll content, to keep the hero exactly as designed.
function SettingsButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/settings")}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      style={styles.settingsButton}
    >
      <Text style={styles.settingsIcon}>⚙️</Text>
    </Pressable>
  );
}

// Always-dark design, matching the web app (CLAUDE.md: "never introduce
// light-mode conditionals") — zinc-950 everywhere, no system-theme branching.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.zinc950 },
          headerTintColor: Colors.white,
          headerTitleStyle: { color: Colors.white },
          contentStyle: { backgroundColor: Colors.zinc950 },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            // No title text — headerShown stays on only so the settings
            // icon has somewhere to live; headerStyle matches the screen
            // background, so the bar itself is invisible.
            headerTitle: "",
            headerRight: () => <SettingsButton />,
          }}
        />
        <Stack.Screen name="email" options={{ title: "Email" }} />
        <Stack.Screen name="url" options={{ title: "URL" }} />
        <Stack.Screen name="phone" options={{ title: "Phone" }} />
        <Stack.Screen name="text" options={{ title: "Text" }} />
        <Stack.Screen name="image" options={{ title: "Image" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  settingsButton: { padding: 4 },
  settingsIcon: { fontSize: 20 },
});
