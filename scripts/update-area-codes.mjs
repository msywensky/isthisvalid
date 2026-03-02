#!/usr/bin/env node
/**
 * scripts/update-area-codes.mjs
 *
 * Fetches the latest NANP area code data and regenerates
 * src/data/us-area-codes.json.
 *
 * Usage:
 *   node scripts/update-area-codes.mjs
 *
 * Data source:
 *   https://github.com/ravisorg/Area-Code-Geolocation-Database
 *   CSV columns: NPA,City,Province,Country,Lat,Lon,Accuracy,Type
 *   - NPA      = 3-digit area code
 *   - Province = 2-letter US state/territory abbreviation
 *   - Country  = "US" | "CA" | ...
 *
 * The script:
 *   1. Fetches the CSV from GitHub raw content
 *   2. Filters to US geographic area codes only (Country === "US", Type === "Geographic")
 *   3. Deduplicates — uses the first record per NPA (they all share the same province)
 *   4. Writes src/data/us-area-codes.json (sorted by area code)
 *
 * If the fetch fails, the existing JSON is left untouched.
 */

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "src", "data", "us-area-codes.json");

const CSV_URL =
  "https://raw.githubusercontent.com/ravisorg/Area-Code-Geolocation-Database/master/us-area-code-geo.csv";

// Full state abbreviation → name map (50 states + DC + territories in NANP).
const STATE_NAMES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "Washington, D.C.",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  VI: "US Virgin Islands",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  GU: "Guam",
  AS: "American Samoa",
  MP: "Northern Mariana Islands",
};

async function fetchCsv(url) {
  console.log(`Fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  }
  return res.text();
}

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"/, "").replace(/"$/, ""));
  return lines.slice(1).map((line) => {
    const values = line
      .split(",")
      .map((v) => v.trim().replace(/^"/, "").replace(/"$/, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

async function main() {
  // Load existing JSON so we can bail out on failure without destroying it.
  const existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));

  let csvText;
  try {
    csvText = await fetchCsv(CSV_URL);
  } catch (err) {
    console.error(
      `\nFetch failed — existing JSON left unchanged.\n${err.message}`,
    );
    process.exit(1);
  }

  const rows = parseCsv(csvText);
  console.log(`Parsed ${rows.length} rows from CSV.`);

  // Build the codes map — US only, geographic type, first record per NPA wins.
  const codes = {};
  let skipped = 0;

  for (const row of rows) {
    const npa = (row["NPA"] || row["Area Code"] || "").trim();
    const country = (row["Country"] || "").trim().toUpperCase();
    const province = (row["Province"] || row["State"] || "")
      .trim()
      .toUpperCase();
    const type = (row["Type"] || "").trim();

    if (!npa || country !== "US") continue;

    // Skip non-geographic types (Toll-Free, Premium-Rate, etc.) — they have no state.
    if (type && type !== "Geographic") {
      skipped++;
      continue;
    }

    if (npa in codes) continue; // already have this area code

    const stateName = STATE_NAMES[province];
    if (!stateName) {
      console.warn(
        `  Unknown province "${province}" for NPA ${npa} — skipping`,
      );
      skipped++;
      continue;
    }

    codes[npa] = stateName;
  }

  const count = Object.keys(codes).length;
  console.log(`Kept ${count} US geographic area codes (skipped ${skipped}).`);

  if (count < 200) {
    console.error(
      `\nUnexpectedly few area codes (${count}). The CSV format may have changed.` +
        `\nExisting JSON left unchanged. Check the source:\n  ${CSV_URL}`,
    );
    process.exit(1);
  }

  // Sort by area code for a stable, readable diff.
  const sortedCodes = Object.fromEntries(
    Object.entries(codes).sort(([a], [b]) => a.localeCompare(b)),
  );

  const today = new Date().toISOString().slice(0, 10);
  const output = {
    _meta: {
      source: "NANPA / ravisorg/Area-Code-Geolocation-Database",
      sourceUrl: CSV_URL,
      updated: today,
      updateScript: "scripts/update-area-codes.mjs",
    },
    codes: sortedCodes,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${count} entries to:\n  ${OUTPUT_PATH}`);

  // Surface any area codes that were in the old file but are missing now.
  const oldCodes = existing.codes ?? {};
  const removed = Object.keys(oldCodes).filter((k) => !(k in sortedCodes));
  const added = Object.keys(sortedCodes).filter((k) => !(k in oldCodes));
  if (removed.length) console.warn(`Removed area codes: ${removed.join(", ")}`);
  if (added.length) console.log(`New area codes: ${added.join(", ")}`);
  if (!removed.length && !added.length)
    console.log("No area code changes from previous version.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
