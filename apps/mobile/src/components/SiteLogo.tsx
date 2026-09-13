import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import { Colors } from "@/constants/colors";

/**
 * SiteLogo — split-diamond wordmark badge for IsThisValid.com. Ports the
 * web app's SiteLogo.tsx (src/components/SiteLogo.tsx) "md" size 1:1 via
 * react-native-svg — same paths/colors, just JSX-flavor swapped.
 *
 * Left  half (dark)   — orange checkmark (valid)
 * Right half (orange) — white  X mark    (invalid)
 */
export default function SiteLogo() {
  return (
    <View style={styles.row}>
      <Svg width={46} height={46} viewBox="0 0 46 46">
        <Path
          d="M23 7 L7 23 L23 39 L39 23 Z"
          stroke="#52525b"
          strokeWidth={1}
          strokeLinejoin="round"
          fill="none"
        />
        <Path d="M23 7 L7 23 L23 39 Z" fill="#27272a" />
        <Path d="M23 7 L39 23 L23 39 Z" fill="#f97316" />
        <Line
          x1={23}
          y1={7}
          x2={23}
          y2={39}
          stroke="#09090b"
          strokeWidth={1.25}
        />
        <Path
          d="M13 23 L16.5 26.5 L22 18.5"
          stroke="#f97316"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M26.5 19.5 L32 25.5 M26.5 25.5 L32 19.5"
          stroke="white"
          strokeWidth={1.75}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.wordmark}>
        <Text style={styles.wordmarkWhite}>IsThisValid</Text>
        <Text style={styles.wordmarkAccent}>.com</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  wordmarkWhite: { color: Colors.white },
  wordmarkAccent: { color: Colors.orange400 },
});
