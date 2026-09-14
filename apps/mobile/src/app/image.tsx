import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  isAcceptedMimeType,
  MAX_IMAGE_BYTES,
  type ImageDebunkResult,
} from "@isthisvalid/core/image-debunker";
import { IMAGE_FAQ_DATA } from "@isthisvalid/core/image-faq-data";

import { ApiError, postFormData } from "@/lib/api-client";
import { Colors } from "@/constants/colors";
import SectionHeader from "@/components/SectionHeader";
import FAQ from "@/components/FAQ";
import ImageResultCard from "@/components/ImageResultCard";

type Phase = "idle" | "preview" | "loading" | "result" | "error";

const MAX_MB = MAX_IMAGE_BYTES / (1024 * 1024);

const DETECTS: [string, string, string][] = [
  ["🤖", "AI-Generated Images", "Photos created entirely by AI models"],
  ["😶‍🌫️", "Deepfakes", "Face-swaps and digital impersonation"],
  ["✂️", "Manipulated Content", "Splicing, cloning, and object removal"],
  ["📸", "Edited Documents", "Altered receipts, screenshots, and statements"],
];

export default function ImageScreen() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [result, setResult] = useState<ImageDebunkResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function selectAsset(picked: ImagePicker.ImagePickerAsset) {
    if (picked.mimeType && !isAcceptedMimeType(picked.mimeType)) {
      setErrorMsg(
        "Unsupported file type. Please pick a JPEG, PNG, WebP, or GIF.",
      );
      setPhase("error");
      return;
    }
    if (picked.fileSize && picked.fileSize > MAX_IMAGE_BYTES) {
      setErrorMsg(`File too large. Maximum size is ${MAX_MB} MB.`);
      setPhase("error");
      return;
    }
    setAsset(picked);
    setErrorMsg("");
    setPhase("preview");
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg("Permission to access your photos is required.");
      setPhase("error");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (!picked.canceled && picked.assets[0]) selectAsset(picked.assets[0]);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg("Permission to access your camera is required.");
      setPhase("error");
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!picked.canceled && picked.assets[0]) selectAsset(picked.assets[0]);
  }

  async function handleSubmit() {
    if (!asset || phase === "loading") return;
    setPhase("loading");
    setResult(null);
    setErrorMsg("");
    try {
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "upload.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);
      const data = await postFormData<ImageDebunkResult>(
        "/api/debunk/image",
        form,
      );
      setResult(data);
      setPhase("result");
    } catch (e) {
      setErrorMsg(
        e instanceof ApiError
          ? e.message
          : "Network error. Please check your connection and try again.",
      );
      setPhase("error");
    }
  }

  function handleReset() {
    setAsset(null);
    setResult(null);
    setErrorMsg("");
    setPhase("idle");
  }

  const showDetects = phase === "idle";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
      <SectionHeader
        icon="🖼️"
        smallTitle="Image Checker"
        largeTitle={
          <>
            Real or <Text style={styles.headlineAccent}>faked</Text>?
          </>
        }
        description="Upload an image to detect deepfakes, AI generation, and digital manipulation. No signup required."
      />

      {phase === "idle" && (
        <View style={styles.pickBox}>
          <Text style={styles.pickIcon}>🖼️</Text>
          <Text style={styles.pickTitle}>Pick an image to check</Text>
          <Text style={styles.pickHint}>
            JPEG, PNG, WebP, GIF · max {MAX_MB} MB
          </Text>
          <View style={styles.pickButtons}>
            <Pressable
              onPress={pickFromLibrary}
              style={({ pressed }) => [
                styles.pickButton,
                pressed && styles.pickButtonPressed,
              ]}
            >
              <Text style={styles.pickButtonText}>🖼️ Choose from Library</Text>
            </Pressable>
            <Pressable
              onPress={takePhoto}
              style={({ pressed }) => [
                styles.pickButtonSecondary,
                pressed && styles.pickButtonSecondaryPressed,
              ]}
            >
              <Text style={styles.pickButtonSecondaryText}>📷 Take Photo</Text>
            </Pressable>
          </View>
        </View>
      )}

      {phase === "preview" && asset && (
        <View style={styles.previewBlock}>
          <View style={styles.previewCard}>
            <Image source={{ uri: asset.uri }} style={styles.previewImage} />
            <View style={styles.previewRow}>
              <View style={styles.previewMeta}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {asset.fileName ?? "Selected image"}
                </Text>
                {asset.fileSize && (
                  <Text style={styles.previewSize}>
                    {(asset.fileSize / (1024 * 1024)).toFixed(2)} MB
                  </Text>
                )}
              </View>
              <Pressable onPress={handleReset} hitSlop={8}>
                <Text style={styles.replaceLink}>Replace</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
            ]}
          >
            <Text style={styles.submitButtonText}>Analyze image →</Text>
          </Pressable>
        </View>
      )}

      {phase === "loading" && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={Colors.zinc400} size="small" />
          <Text style={styles.loadingText}>Analyzing image…</Text>
        </View>
      )}

      {phase === "result" && result && (
        <View style={styles.resultBlock}>
          <ImageResultCard result={result} />
          <Pressable onPress={handleReset} hitSlop={8}>
            <Text style={styles.resetLink}>← Check another image</Text>
          </Pressable>
        </View>
      )}

      {phase === "error" && (
        <View style={styles.resultBlock}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
          <Pressable onPress={handleReset} hitSlop={8}>
            <Text style={styles.resetLink}>← Try again</Text>
          </Pressable>
        </View>
      )}

      {showDetects && (
        <View style={styles.detects}>
          <Text style={styles.detectsHeading}>What AI will detect</Text>
          {DETECTS.map(([icon, name, detail]) => (
            <View key={name} style={styles.detectRow}>
              <Text style={styles.detectIcon}>{icon}</Text>
              <Text style={styles.detectText}>
                <Text style={styles.detectName}>{name}</Text> — {detail}
              </Text>
            </View>
          ))}
        </View>
      )}

      <FAQ
        data={IMAGE_FAQ_DATA.map((item) => ({
          q: item.question,
          a: item.answer,
        }))}
        accentColor={Colors.emerald400}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.zinc950 },
  content: { padding: 16, gap: 16 },
  headlineAccent: { color: Colors.emerald400 },
  pickBox: {
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.zinc700,
    backgroundColor: Colors.zinc900,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  pickIcon: { fontSize: 34 },
  pickTitle: { color: Colors.zinc200, fontSize: 14, fontWeight: "600" },
  pickHint: { color: Colors.zinc500, fontSize: 12 },
  pickButtons: { width: "100%", gap: 10, marginTop: 14 },
  pickButton: {
    borderRadius: 12,
    backgroundColor: Colors.emerald500,
    paddingVertical: 12,
    alignItems: "center",
  },
  pickButtonPressed: { backgroundColor: Colors.emerald600 },
  pickButtonText: { color: Colors.white, fontWeight: "600", fontSize: 14 },
  pickButtonSecondary: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.zinc700,
    paddingVertical: 12,
    alignItems: "center",
  },
  pickButtonSecondaryPressed: { backgroundColor: Colors.zinc800 },
  pickButtonSecondaryText: {
    color: Colors.zinc300,
    fontWeight: "600",
    fontSize: 14,
  },
  previewBlock: { gap: 12 },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.zinc800,
    backgroundColor: Colors.zinc900,
    padding: 12,
    gap: 10,
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: Colors.zinc950,
    resizeMode: "contain",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  previewMeta: { flex: 1, minWidth: 0 },
  previewName: { color: Colors.zinc300, fontSize: 13, fontWeight: "500" },
  previewSize: { color: Colors.zinc500, fontSize: 11 },
  replaceLink: {
    fontSize: 12,
    color: Colors.zinc400,
    textDecorationLine: "underline",
  },
  submitButton: {
    borderRadius: 12,
    backgroundColor: Colors.emerald500,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitButtonPressed: { backgroundColor: Colors.emerald600 },
  submitButtonText: { color: Colors.white, fontWeight: "600", fontSize: 15 },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 24,
  },
  loadingText: { color: Colors.zinc400, fontSize: 13 },
  resultBlock: { gap: 12 },
  resetLink: {
    fontSize: 14,
    color: Colors.emerald400,
    textDecorationLine: "underline",
  },
  errorBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.roseBorder,
    backgroundColor: Colors.rose950,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  errorText: { color: Colors.rose400, fontWeight: "600", fontSize: 14 },
  detects: { gap: 10 },
  detectsHeading: { color: Colors.zinc300, fontWeight: "600", fontSize: 15 },
  detectRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detectIcon: { fontSize: 14 },
  detectText: { flex: 1, color: Colors.zinc400, fontSize: 13, lineHeight: 19 },
  detectName: { color: Colors.zinc200, fontWeight: "700" },
});
