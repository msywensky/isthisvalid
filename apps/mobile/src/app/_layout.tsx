import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { Colors } from "@/constants/colors";

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
          options={{ title: "All Tools", headerShown: false }}
        />
        <Stack.Screen name="email" options={{ title: "Email" }} />
        <Stack.Screen name="url" options={{ title: "URL" }} />
        <Stack.Screen name="phone" options={{ title: "Phone" }} />
        <Stack.Screen name="text" options={{ title: "Text" }} />
        <Stack.Screen name="image" options={{ title: "Image" }} />
      </Stack>
    </>
  );
}
