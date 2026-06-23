/**
 * Unit tests for src/lib/image-debunker.ts
 *
 * Pure functions — no mocks required.
 * SightEngine genai model returns a single ai_generated score (0–1).
 */

import {
  normalizeProviderResponse,
  coerceImageRiskScore,
  SAFE_RISK_THRESHOLD,
  type SightengineRawResponse,
} from "@/lib/image-debunker";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRaw(aiGenerated: number): SightengineRawResponse {
  return {
    status: "success",
    request: { id: "req_test", timestamp: 1746000000, operations: 1 },
    type: { ai_generated: aiGenerated },
    media: { id: "med_test", uri: "https://example.com/img.jpg" },
  };
}

// ── SAFE_RISK_THRESHOLD ────────────────────────────────────────────────────────

describe("SAFE_RISK_THRESHOLD", () => {
  test("is 50", () => {
    expect(SAFE_RISK_THRESHOLD).toBe(50);
  });
});

// ── coerceImageRiskScore ───────────────────────────────────────────────────────

describe("coerceImageRiskScore", () => {
  test("ai-generated with low riskScore is floored to 60", () => {
    expect(coerceImageRiskScore("ai-generated", 30)).toBe(60);
  });

  test("ai-generated with riskScore already ≥ 60 is unchanged", () => {
    expect(coerceImageRiskScore("ai-generated", 75)).toBe(75);
  });

  test("authentic with high riskScore is capped to 40", () => {
    expect(coerceImageRiskScore("authentic", 70)).toBe(40);
  });

  test("authentic with riskScore already ≤ 40 is unchanged", () => {
    expect(coerceImageRiskScore("authentic", 20)).toBe(20);
  });

  test("uncertain below 40 is raised to 40", () => {
    expect(coerceImageRiskScore("uncertain", 10)).toBe(40);
  });

  test("uncertain above 70 is capped to 70", () => {
    expect(coerceImageRiskScore("uncertain", 90)).toBe(70);
  });

  test("uncertain within [40, 70] is unchanged", () => {
    expect(coerceImageRiskScore("uncertain", 55)).toBe(55);
  });
});

// ── Classification thresholds ─────────────────────────────────────────────────

describe("normalizeProviderResponse — classification thresholds", () => {
  test("ai_generated=0.9 → ai-generated", () => {
    const r = normalizeProviderResponse(makeRaw(0.9));
    expect(r.classification).toBe("ai-generated");
  });

  test("ai_generated=0.7 → ai-generated (boundary inclusive)", () => {
    const r = normalizeProviderResponse(makeRaw(0.7));
    expect(r.classification).toBe("ai-generated");
  });

  test("ai_generated=0.69 → uncertain (just below ai-generated boundary)", () => {
    const r = normalizeProviderResponse(makeRaw(0.69));
    expect(r.classification).toBe("uncertain");
  });

  test("ai_generated=0.5 → uncertain", () => {
    const r = normalizeProviderResponse(makeRaw(0.5));
    expect(r.classification).toBe("uncertain");
  });

  test("ai_generated=0.4 → uncertain (boundary inclusive)", () => {
    const r = normalizeProviderResponse(makeRaw(0.4));
    expect(r.classification).toBe("uncertain");
  });

  test("ai_generated=0.39 → authentic (just below uncertain boundary)", () => {
    const r = normalizeProviderResponse(makeRaw(0.39));
    expect(r.classification).toBe("authentic");
  });

  test("ai_generated=0.001 → authentic (very low AI probability)", () => {
    const r = normalizeProviderResponse(makeRaw(0.001));
    expect(r.classification).toBe("authentic");
  });

  test("ai_generated=0.0 → authentic", () => {
    const r = normalizeProviderResponse(makeRaw(0.0));
    expect(r.classification).toBe("authentic");
  });
});

// ── riskScore ─────────────────────────────────────────────────────────────────

describe("normalizeProviderResponse — riskScore", () => {
  test("ai_generated=0.85 → riskScore=max(85,60)=85 for ai-generated", () => {
    const r = normalizeProviderResponse(makeRaw(0.85));
    expect(r.riskScore).toBe(85);
    expect(r.classification).toBe("ai-generated");
  });

  test("ai_generated=0.7 → riskScore=max(70,60)=70 for ai-generated", () => {
    const r = normalizeProviderResponse(makeRaw(0.7));
    expect(r.riskScore).toBe(70);
  });

  test("ai_generated=0.001 → riskScore=min(0,40)=0 for authentic", () => {
    const r = normalizeProviderResponse(makeRaw(0.001));
    expect(r.riskScore).toBe(0);
  });

  test("ai_generated=0.3 → riskScore=min(30,40)=30 for authentic", () => {
    const r = normalizeProviderResponse(makeRaw(0.3));
    expect(r.riskScore).toBe(30);
  });

  test("ai_generated=0.5 → riskScore=clamp(50,40,70)=50 for uncertain", () => {
    const r = normalizeProviderResponse(makeRaw(0.5));
    expect(r.riskScore).toBe(50);
  });

  test("ai_generated=0.45 → riskScore=clamp(45,40,70)=45 for uncertain", () => {
    const r = normalizeProviderResponse(makeRaw(0.45));
    expect(r.riskScore).toBe(45);
  });

  test("ai_generated=0.65 (uncertain) → riskScore=clamp(65,40,70)=65", () => {
    const r = normalizeProviderResponse(makeRaw(0.65));
    expect(r.riskScore).toBe(65);
  });
});

// ── safe boundary ─────────────────────────────────────────────────────────────

describe("normalizeProviderResponse — safe boundary", () => {
  test("riskScore=45 (uncertain, 0.45) → safe=true", () => {
    const r = normalizeProviderResponse(makeRaw(0.45));
    expect(r.safe).toBe(true);
  });

  test("riskScore=50 (uncertain, 0.5) → safe=false (not < 50)", () => {
    const r = normalizeProviderResponse(makeRaw(0.5));
    expect(r.safe).toBe(false);
  });

  test("ai-generated → safe=false regardless (dangerous classification)", () => {
    const r = normalizeProviderResponse(makeRaw(0.7));
    expect(r.safe).toBe(false);
  });

  test("authentic → safe=true (riskScore ≤ 40 after coercion, not dangerous)", () => {
    const r = normalizeProviderResponse(makeRaw(0.1));
    expect(r.safe).toBe(true);
  });
});

// ── confidence ────────────────────────────────────────────────────────────────

describe("normalizeProviderResponse — confidence", () => {
  test("ai_generated=0.0 → confidence=100 (certain authentic)", () => {
    const r = normalizeProviderResponse(makeRaw(0.0));
    expect(r.confidence).toBe(100);
  });

  test("ai_generated=1.0 → confidence=100 (certain AI)", () => {
    const r = normalizeProviderResponse(makeRaw(1.0));
    expect(r.confidence).toBe(100);
  });

  test("ai_generated=0.5 → confidence=0 (maximum ambiguity)", () => {
    const r = normalizeProviderResponse(makeRaw(0.5));
    expect(r.confidence).toBe(0);
  });

  test("ai_generated=0.75 → confidence=50", () => {
    // |0.75 - 0.5| * 200 = 50
    const r = normalizeProviderResponse(makeRaw(0.75));
    expect(r.confidence).toBe(50);
  });

  test("ai_generated=0.001 (SightEngine docs example) → confidence near 100", () => {
    const r = normalizeProviderResponse(makeRaw(0.001));
    expect(r.confidence).toBeGreaterThan(90);
  });
});

// ── Flags ─────────────────────────────────────────────────────────────────────

describe("normalizeProviderResponse — flags", () => {
  test("ai_generated ≥ 0.7 → 'AI generation probability' flag present", () => {
    const r = normalizeProviderResponse(makeRaw(0.85));
    expect(r.flags.some((f) => /AI generation probability/i.test(f))).toBe(
      true,
    );
  });

  test("ai_generated=0.69 (uncertain) → no 'AI generation probability' flag", () => {
    const r = normalizeProviderResponse(makeRaw(0.69));
    expect(r.flags.some((f) => /AI generation probability/i.test(f))).toBe(
      false,
    );
  });

  test("uncertain classification → 'Inconclusive result' flag present", () => {
    const r = normalizeProviderResponse(makeRaw(0.5));
    expect(r.flags.some((f) => /Inconclusive result/i.test(f))).toBe(true);
  });

  test("authentic with high confidence → no flags", () => {
    const r = normalizeProviderResponse(makeRaw(0.05));
    expect(r.flags).toHaveLength(0);
  });

  test("confidence < 30 (score near 0.5) → 'Low detection confidence' flag", () => {
    // ai=0.48: confidence = |0.48-0.5|*200 = 4 < 30 → flag added
    const r = normalizeProviderResponse(makeRaw(0.48));
    expect(r.flags.some((f) => /low detection confidence/i.test(f))).toBe(true);
  });

  test("confidence ≥ 30 → no 'Low detection confidence' flag", () => {
    // ai=0.65: confidence = |0.65-0.5|*200 = 30, not < 30 → no flag
    const r = normalizeProviderResponse(makeRaw(0.65));
    expect(r.flags.some((f) => /low detection confidence/i.test(f))).toBe(
      false,
    );
  });
});

// ── Explanation ───────────────────────────────────────────────────────────────

describe("normalizeProviderResponse — explanation", () => {
  test("always contains the AI probability percentage", () => {
    const r = normalizeProviderResponse(makeRaw(0.85));
    expect(r.explanation).toContain("85%");
  });

  test("always contains the detection confidence percentage", () => {
    // ai=0.85: confidence = |0.85-0.5|*200 = 70
    const r = normalizeProviderResponse(makeRaw(0.85));
    expect(r.explanation).toContain("70%");
  });

  test("authentic explanation mentions no AI generation detected", () => {
    const r = normalizeProviderResponse(makeRaw(0.05));
    expect(r.explanation).toMatch(/no significant signs/i);
  });

  test("uncertain explanation mentions inconclusive results", () => {
    const r = normalizeProviderResponse(makeRaw(0.5));
    expect(r.explanation).toMatch(/inconclusive/i);
  });
});

// ── Summary messages ──────────────────────────────────────────────────────────

describe("normalizeProviderResponse — summaries", () => {
  test("ai-generated summary mentions AI", () => {
    const r = normalizeProviderResponse(makeRaw(0.9));
    expect(r.summary).toMatch(/AI/i);
  });

  test("authentic summary mentions authentic", () => {
    const r = normalizeProviderResponse(makeRaw(0.1));
    expect(r.summary).toMatch(/authentic/i);
  });

  test("uncertain summary mentions inconclusive or caution", () => {
    const r = normalizeProviderResponse(makeRaw(0.5));
    expect(r.summary).toMatch(/inconclusive|caution/i);
  });
});

// ── source field ──────────────────────────────────────────────────────────────

describe("normalizeProviderResponse — source field", () => {
  test("source is always 'sightengine'", () => {
    const r = normalizeProviderResponse(makeRaw(0.85));
    expect(r.source).toBe("sightengine");
  });
});
