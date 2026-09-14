import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Colors } from "@/constants/colors";

export interface ScoreRingProps {
  score: number;
  ringColor: string;
  /** Defaults to zinc-800. URL's ring uses zinc-700 instead. */
  trackColor?: string;
}

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Shared 0–100 score ring used by every result card (Email, Phone, URL,
 * Text) — a small 56×56 ring, radius 20, rotated -90deg so it starts at 12
 * o'clock. Callers own their own score/sentiment → color mapping and just
 * pass the resolved hex through `ringColor`.
 */
export default function ScoreRing({
  score,
  ringColor,
  trackColor = Colors.zinc800,
}: ScoreRingProps) {
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  return (
    <View style={styles.wrap}>
      <Svg width={56} height={56} viewBox="0 0 56 56" style={styles.svg}>
        <Circle
          cx={28}
          cy={28}
          r={RADIUS}
          fill="none"
          stroke={trackColor}
          strokeWidth={6}
        />
        <Circle
          cx={28}
          cy={28}
          r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={6}
          strokeDasharray={`${CIRCUMFERENCE.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
          strokeDashoffset={offset.toFixed(2)}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.score}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  svg: { transform: [{ rotate: "-90deg" }] },
  score: {
    position: "absolute",
    color: Colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
});
