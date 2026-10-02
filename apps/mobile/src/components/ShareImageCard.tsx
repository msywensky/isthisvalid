import type { Ref } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import type { Sentiment } from "@isthisvalid/core/result-verdict";
import type { ImageStrip } from "@isthisvalid/core/share-text";

import { Colors } from "@/constants/colors";

/**
 * The view ShareButton screenshots (react-native-view-shot) to build the image
 * tool's share image: the checked image with the verdict strip *below* it —
 * mobile's equivalent of web's lib/share-image.ts. The screenshot is a new
 * JPEG, so the original photo's EXIF (GPS etc.) is never shared.
 *
 * Only mounted while a share is in progress, positioned off-screen.
 */
export interface ShareImageCardProps {
  ref: Ref<View>;
  uri: string;
  /** height / width of the source image. */
  aspect: number;
  strip: ImageStrip;
  /** Fired once the image has loaded — capturing earlier gives a blank image. */
  onReady: () => void;
  onError: () => void;
}

/**
 * Layout width in points. ShareButton asks view-shot for a fixed output width,
 * so this only sets the strip's proportions — don't lay it out at 1080, or a
 * 3× device renders a 3240px image.
 */
export const CARD_WIDTH = 360;

/** Same hex values as web's SENTIMENT_HEX. */
const SENTIMENT_COLOR: Record<Sentiment, string> = {
  safe: Colors.lime500,
  warn: Colors.yellow500,
  danger: Colors.rose400,
};

export default function ShareImageCard({
  ref,
  uri,
  aspect,
  strip,
  onReady,
  onError,
}: ShareImageCardProps) {
  return (
    // collapsable={false} is REQUIRED on Android — otherwise the native view
    // can be optimised away and the capture fails or comes out blank.
    <View ref={ref} collapsable={false} style={styles.offscreen}>
      <Image
        source={{ uri }}
        style={{ width: CARD_WIDTH, height: CARD_WIDTH * aspect }}
        onLoad={onReady}
        onError={onError}
      />
      <View style={styles.strip}>
        <View
          style={[
            styles.accentBar,
            { backgroundColor: SENTIMENT_COLOR[strip.sentiment] },
          ]}
        />
        <View style={styles.stripText}>
          <Text style={styles.headline}>{strip.headline}</Text>
          <Text style={styles.detail}>{strip.detail}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Off-screen, not hidden: opacity 0 / display none capture as blank.
  offscreen: {
    position: "absolute",
    left: -10000,
    top: 0,
    width: CARD_WIDTH,
    backgroundColor: Colors.zinc950,
  },
  strip: {
    flexDirection: "row",
    minHeight: 64,
    backgroundColor: Colors.zinc950,
  },
  accentBar: { width: 4 },
  stripText: { flex: 1, justifyContent: "center", gap: 3, padding: 12 },
  headline: { color: Colors.white, fontWeight: "700", fontSize: 14 },
  detail: { color: Colors.zinc400, fontSize: 10 },
});
