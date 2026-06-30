#!/usr/bin/env node
// ---------------------------------------------------------------------------
// e2e "no canvas pixels" guard (CLAUDE.md: e2e tests "Assert on DOM and
// app/store state — NEVER on the 3D WebGL canvas pixels").
//
// This guard fails CI if any spec under e2e/** reaches into canvas/WebGL pixel
// data instead of asserting through the ?e2e=1 store accessor or the DOM. It
// flags:
//
//   • getContext(        — grabbing a 2D/WebGL drawing context to read pixels
//   • toDataURL(         — serializing canvas pixels to a data URL
//   • readPixels(        — WebGL pixel read-back
//   • .screenshot(       — capturing rendered pixels (Playwright)
//   • toMatchSnapshot(   — pixel/image snapshot assertions
//
// Locating the canvas element for DOM interaction (page.locator("canvas"),
// .click(), .waitFor()) is allowed — that is DOM, not pixels.
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const E2E = join(ROOT, "e2e");

const FORBIDDEN = [
  { pattern: /\bgetContext\s*\(/, why: "reads a canvas drawing/WebGL context" },
  { pattern: /\btoDataURL\s*\(/, why: "serializes canvas pixels to a data URL" },
  { pattern: /\breadPixels\s*\(/, why: "reads WebGL framebuffer pixels" },
  { pattern: /\.screenshot\s*\(/, why: "captures rendered pixels (Playwright)" },
  { pattern: /\btoMatchSnapshot\s*\(/, why: "pixel/image snapshot assertion" },
];

function collect(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // no e2e dir → nothing to check
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(collect(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const findings = [];
for (const file of collect(E2E)) {
  const relPath = relative(ROOT, file).split("\\").join("/");
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const { pattern, why } of FORBIDDEN) {
      if (pattern.test(line)) {
        findings.push({ relPath, lineNo: i + 1, line: line.trim(), why });
      }
    }
  });
}

if (findings.length > 0) {
  console.error(
    "\n✗ e2e canvas-pixels guard: forbidden pixel/canvas access in e2e specs.\n" +
      "  Assert on store state via the ?e2e=1 accessor or on the DOM instead.\n",
  );
  for (const f of findings) {
    console.error(`  ${f.relPath}:${f.lineNo}  (${f.why})`);
    console.error(`      ${f.line}`);
  }
  console.error("");
  process.exit(1);
}

console.log("✓ e2e canvas-pixels guard: no WebGL/canvas pixel reads in e2e specs.");
