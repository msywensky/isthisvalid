import { useRef, useState } from "react";
import {
  PixelRatio,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

import {
  buildImageStrip,
  buildShareText,
  type ShareInput,
} from "@isthisvalid/core/share-text";

import { Colors } from "@/constants/colors";
import ShareImageCard from "@/components/ShareImageCard";

/**
 * "Share result" for every tool screen. Text tools open the native share sheet
 * with a plain-text summary (RN's built-in Share). The image tool, when given
 * the picked image, screenshots an off-screen ShareImageCard and shares that
 * JPEG via expo-sharing — falling back to the text summary on any failure.
 */
export interface ShareButtonProps {
  input: ShareInput;
  /** Image tool only: the picked image's uri and height / width. */
  imageUri?: string;
  imageAspect?: number;
}

/** Output width of the shared image, in physical pixels. */
const SHARE_IMAGE_PX = 1080;

export default function ShareButton({
  input,
  imageUri,
  imageAspect = 1,
}: ShareButtonProps) {
  const [capturing, setCapturing] = useState(false);
  const cardRef = useRef<View>(null);
  // Android can fire Image onLoad more than once; capture only once per tap.
  const captureStarted = useRef(false);

  async function shareText() {
    try {
      // Only `message` (with the link inside it): Android ignores `url`, and
      // iOS shows the link twice if both are passed.
      await Share.share({ message: buildShareText(input) });
    } catch {
      // A dismissed sheet resolves rather than throws; nothing to do here.
    }
  }

  function onPress() {
    if (input.kind === "image" && imageUri) {
      captureStarted.current = false;
      setCapturing(true); // mounts ShareImageCard; capture runs in onCardReady
    } else {
      void shareText();
    }
  }

  async function onCardReady() {
    if (captureStarted.current) return;
    captureStarted.current = true;
    try {
      // view-shot's width is in points and gets multiplied by the device
      // pixel ratio, so divide it out to get ~1080px on every device.
      const uri = await captureRef(cardRef, {
        format: "jpg",
        quality: 0.9,
        width: SHARE_IMAGE_PX / PixelRatio.get(),
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/jpeg",
          UTI: "public.jpeg",
          dialogTitle: "Share result",
        });
      } else {
        await shareText();
      }
    } catch {
      await shareText(); // single fallback path for any capture/share failure
    } finally {
      setCapturing(false); // unmounts the card and frees the decoded bitmap
    }
  }

  async function onCardError() {
    await shareText();
    setCapturing(false);
  }

  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={capturing}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          capturing && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {capturing ? "Preparing…" : "📤 Share result"}
        </Text>
      </Pressable>
      {capturing && input.kind === "image" && imageUri && (
        <ShareImageCard
          ref={cardRef}
          uri={imageUri}
          aspect={imageAspect}
          strip={buildImageStrip(input.result)}
          onReady={onCardReady}
          onError={onCardError}
        />
      )}
    </>
  );
}

// Matches image.tsx's pickButtonSecondary.
const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.zinc700,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonPressed: { backgroundColor: Colors.zinc800 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Colors.zinc300, fontWeight: "600", fontSize: 14 },
});
