/**
 * Verifies that browser bundles (UMD) don't depend on Node.js Buffer.
 * Run after `npm run build` to catch regressions.
 *
 * Usage: node scripts/verify-no-buffer.mjs
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ethereum-provider is excluded because it bundles @reown/appkit-* which uses
// its own guarded Buffer patterns (e.g. `globalThis.Buffer ? ... : fallback`),
// causing false positives here.
const UMD_BUNDLES = [
  "packages/utils/dist/index.umd.js",
  "packages/core/dist/index.umd.js",
  "packages/sign-client/dist/index.umd.js",
  "providers/universal-provider/dist/index.umd.js",
];

let hasFailure = false;

for (const bundle of UMD_BUNDLES) {
  const fullPath = join(ROOT, bundle);
  if (!existsSync(fullPath)) {
    console.log(`⚠  SKIP ${bundle} (not built)`);
    continue;
  }

  const code = readFileSync(fullPath, "utf-8");

  // Strip safe guarded patterns (check Buffer existence before use)
  const stripped = code
    .replace(/globalThis\.Buffer\s*!=\s*null/g, "__GUARDED__")
    .replace(/globalThis\.Buffer\s*\?\s*Buffer\./g, "__GUARDED__?__GUARDED__.")
    .replace(/globalThis\.Buffer\./g, "__GUARDED__.");

  const bufferPatterns = [
    /(?<![A-Za-z.])Buffer\.from\b/,
    /(?<![A-Za-z.])Buffer\.concat\b/,
    /(?<![A-Za-z.])Buffer\.alloc\b/,
    /\bnew Buffer\b/,
  ];

  const matches = [];
  for (const pattern of bufferPatterns) {
    if (pattern.test(stripped)) {
      matches.push(pattern.source);
    }
  }

  if (matches.length > 0) {
    console.log(`✗  FAIL ${bundle}`);
    console.log(`   Found Buffer usage patterns: ${matches.join(", ")}`);
    hasFailure = true;
  } else {
    console.log(`✓  PASS ${bundle}`);
  }
}

if (hasFailure) {
  console.log("\n✗  Browser bundles contain Node.js Buffer references!");
  console.log("   Replace with uint8arrays, TextEncoder/TextDecoder, or manual byte operations.");
  process.exit(1);
} else {
  console.log("\n✓  All browser bundles are Buffer-free.");
}
