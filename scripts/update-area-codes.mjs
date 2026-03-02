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
 *   File: us-area-code-cities.csv
 *   Columns (no header row): NPA,City,"State",Country,Lat,Lon
 *   - NPA     = 3-digit area code
 *   - State   = full US state name (quoted)
 *   - Country = "US" | "CA" | ...
 *
 * The script:
 *   1. Fetches the CSV from GitHub raw content
 *   2. Filters to US rows only (column 3 === "US")
 *   3. Deduplicates — uses the first record per NPA (all rows for a given NPA share the same state)
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
  "https://raw.githubusercontent.com/ravisorg/Area-Code-Geolocation-Database/master/us-area-code-cities.csv";

async function fetchCsv(url) {
  console.log(`Fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  }
  return res.text();
}

/**
 * Parse a CSV line that may contain quoted fields (e.g. "New Jersey").
 * Returns an array of unquoted field strings.
 */
function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
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

  // File has NO header row. Columns (0-based):
  //   0: NPA  1: City  2: State (full name)  3: Country  4: Lat  5: Lon
  const lines = csvText.trim().split("\n");
  console.log(`Parsed ${lines.length} rows from CSV.`);

  // Build the codes map — US only, first record per NPA wins.
  const codes = {};
  let skipped = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    const npa = fields[0];
    const state = fields[2]; // full state name, already unquoted
    const country = (fields[3] || "").toUpperCase();

    if (!npa || country !== "US") {
      skipped++;
      continue;
    }
    if (npa in codes) continue; // already have this area code
    if (!state) {
      console.warn(`  Empty state for NPA ${npa} — skipping`);
      skipped++;
      continue;
    }

    // Normalise DC name — the CSV uses "District of Columbia"
    codes[npa] = state === "District of Columbia" ? "Washington, D.C." : state;
  }

  // The source CSV marks US territories (Puerto Rico, VI, Guam, etc.) with their
  // own country codes rather than "US". Hard-code NANP territory area codes here
  // so they're always present regardless of how the upstream CSV categorises them.
  const TERRITORY_CODES = {
    340: "US Virgin Islands",
    671: "Guam",
    684: "American Samoa",
    787: "Puerto Rico",
    939: "Puerto Rico",
  };
  for (const [npa, name] of Object.entries(TERRITORY_CODES)) {
    if (!(npa in codes)) codes[npa] = name;
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
