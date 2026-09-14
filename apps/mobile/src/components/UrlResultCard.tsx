import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import type { UrlValidationResult } from "@isthisvalid/core/url-validator";

import { Colors, withAlpha } from "@/constants/colors";

/**
 * Result card for the URL checker — ported 1:1 from the web app's
 * UrlResultCard.tsx: a big score ring + verdict block, a Safe-Browisng
 * degraded warning, a 14-row (max) check grid, a redirect notice, and a
 * flags-detected pill list. Sentiment thresholds are stricter than the
 * other tools' (URL ≥80 = Safe, ≥50 = Suspicious), and the check rows use a
 * neutral bg (only the ✓/✗ glyph is colored) — both match web exactly.
 */
export interface UrlResultCardProps {
  result: UrlValidationResult;
}

interface SentimentMeta {
  label: string;
  badgeText: string;
  badgeBg: string;
  ring: string;
  cardBorder: string;
  cardBg: string;
}

function getSentiment(score: number): SentimentMeta {
  if (score >= 80) {
    return {
      label: "Safe",
      badgeText: Colors.lime400,
      badgeBg: withAlpha(Colors.lime400, 0.15),
      ring: Colors.lime400,
      cardBorder: Colors.limeBorder,
      cardBg: Colors.lime950,
    };
  }
  if (score >= 50) {
    return {
      label: "Suspicious",
      badgeText: Colors.yellow400,
      badgeBg: withAlpha(Colors.yellow400, 0.15),
      ring: Colors.yellow400,
      cardBorder: Colors.yellowBorder,
      cardBg: Colors.yellow950,
    };
  }
  return {
    label: "Dangerous",
    badgeText: Colors.rose400,
    badgeBg: withAlpha(Colors.rose500, 0.15),
    ring: Colors.rose500,
    cardBorder: Colors.roseBorder,
    cardBg: Colors.rose950,
  };
}

function CheckRow({
  label,
  pass,
  wide,
}: {
  label: string;
  pass: boolean | null | undefined;
  wide?: boolean;
}) {
  if (pass === null || pass === undefined) return null;
  return (
    <View style={[styles.checkRow, wide && styles.checkRowWide]}>
      <Text style={{ color: pass ? Colors.lime400 : Colors.rose400 }}>
        {pass ? "✓" : "✗"}
      </Text>
      <Text style={styles.checkLabel}>{label}</Text>
    </View>
  );
}

const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function UrlResultCard({ result }: UrlResultCardProps) {
  const s = getSentiment(result.score);
  const checks = result.checks;

  const hasFlags = result.flags.length > 0;
  const hasSafeBrowsing = checks.safeBrowsing !== null;
  const hasResolves = checks.resolves !== null;
  const hasRdap = checks.notNewlyRegistered !== null;
  const safeBrowsingFailed = result.safeBrowsingError === true;

  const sourceText = hasSafeBrowsing
    ? "Safe Browsing + RDAP + local checks"
    : hasRdap
      ? "RDAP + local checks"
      : "local checks";

  const offset = RING_CIRCUMFERENCE - (result.score / 100) * RING_CIRCUMFERENCE;

  return (
    <View
      style={[
        styles.card,
        { borderColor: s.cardBorder, backgroundColor: s.cardBg },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.ringWrap}>
          <Svg
            width={100}
            height={100}
            viewBox="0 0 100 100"
            style={styles.ringSvg}
          >
            <Circle
              cx={50}
              cy={50}
              r={RING_RADIUS}
              fill="none"
              stroke={Colors.zinc700}
              strokeWidth={10}
            />
            <Circle
              cx={50}
              cy={50}
              r={RING_RADIUS}
              fill="none"
              stroke={s.ring}
              strokeWidth={10}
              strokeDasharray={`${RING_CIRCUMFERENCE.toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`}
              strokeDashoffset={offset.toFixed(2)}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.ringScore}>{result.score}</Text>
        </View>

        <View style={styles.verdictBlock}>
          <View style={[styles.badge, { backgroundColor: s.badgeBg }]}>
            <Text style={[styles.badgeText, { color: s.badgeText }]}>
              {s.label}
            </Text>
          </View>
          <Text style={styles.message}>{result.message}</Text>
          <Text style={styles.sourceText}>
            Checked via{" "}
            <Text style={styles.sourceTextItalic}>{sourceText}</Text>
          </Text>
        </View>
      </View>

      {safeBrowsingFailed && (
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠</Text>
          <Text style={styles.warningText}>
            Google Safe Browsing check could not be completed. This result is
            based on local checks only — exercise extra caution before visiting
            this URL.
          </Text>
        </View>
      )}

      <View style={styles.checksGrid}>
        <CheckRow label="Parseable URL" pass={checks.parseable} />
        <CheckRow label="Valid scheme (https/http)" pass={checks.validScheme} />
        <CheckRow label="Not an IP address" pass={checks.notIpAddress} />
        <CheckRow label="No embedded credentials" pass={checks.noUserInfo} />
        <CheckRow label="Not a link shortener" pass={checks.notShortener} />
        <CheckRow
          label="No suspicious keywords"
          pass={checks.noSuspiciousKeywords}
        />
        <CheckRow label="No punycode encoding" pass={checks.notPunycode} />
        <CheckRow label="Valid TLD" pass={checks.validTld} />
        <CheckRow label="No brand impersonation" pass={checks.noBrandSquat} />
        <CheckRow
          label="Normal subdomain depth"
          pass={checks.notExcessiveSubdomains}
        />
        <CheckRow label="Low-risk TLD" pass={checks.notSuspiciousTld} />
        <CheckRow label="No typosquatting" pass={checks.notTyposquat} />
        <CheckRow
          label="Normal domain structure"
          pass={checks.notHighEntropy}
        />
        <CheckRow
          label="Normal hyphen usage"
          pass={checks.notExcessiveHyphens}
        />
        {hasRdap && (
          <CheckRow
            label="Established domain (≥30 days)"
            pass={checks.notNewlyRegistered}
          />
        )}
        {hasResolves && (
          <CheckRow
            label="URL resolves (live server)"
            pass={checks.resolves}
            wide
          />
        )}
        {hasSafeBrowsing && (
          <CheckRow
            label="Google Safe Browsing: clean"
            pass={checks.safeBrowsing}
            wide
          />
        )}
      </View>

      {result.redirectedTo && (
        <View style={styles.redirectBox}>
          <Text style={styles.redirectLabel}>Redirects to: </Text>
          <Text style={styles.redirectValue}>{result.redirectedTo}</Text>
        </View>
      )}

      {hasFlags && (
        <View style={styles.flagsSection}>
          <Text style={styles.flagsHeading}>Issues detected</Text>
          <View style={styles.flagsList}>
            {result.flags.map((flag) => (
              <View key={flag} style={styles.flagPill}>
                <Text style={styles.flagPillText}>{flag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 2, padding: 20, gap: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  },
  ringWrap: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: { transform: [{ rotate: "-90deg" }] },
  ringScore: {
    position: "absolute",
    color: Colors.white,
    fontSize: 24,
    fontWeight: "800",
  },
  verdictBlock: { flex: 1, minWidth: 160, gap: 6 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 13, fontWeight: "600" },
  message: { color: Colors.zinc300, fontSize: 13, lineHeight: 18 },
  sourceText: { color: Colors.zinc500, fontSize: 11 },
  sourceTextItalic: { fontStyle: "italic" },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.yellowBorder,
    backgroundColor: withAlpha(Colors.yellow500, 0.1),
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  warningIcon: { color: Colors.yellow400, fontWeight: "700" },
  warningText: {
    flex: 1,
    color: Colors.yellow400,
    fontSize: 13,
    lineHeight: 18,
  },
  checksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: "47%",
    flexGrow: 1,
  },
  checkRowWide: { minWidth: "100%" },
  checkLabel: { color: Colors.zinc300, fontSize: 13 },
  redirectBox: {
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  redirectLabel: { color: Colors.zinc400, fontSize: 12 },
  redirectValue: { color: Colors.zinc300, fontSize: 12 },
  flagsSection: { gap: 8 },
  flagsHeading: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.zinc500,
  },
  flagsList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flagPill: {
    borderRadius: 999,
    backgroundColor: withAlpha(Colors.rose500, 0.15),
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  flagPillText: { color: Colors.rose300, fontSize: 11 },
});
