#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Ground-height-seam guard (CLAUDE.md: "never write the literal ground y-value
// inline anywhere — every 'where is the ground here' question routes through
// groundHeightAt").
//
// This guard fails CI if a Y-POSITION is assigned a bare numeric literal in
// src/**, because that is exactly how a hardcoded ground/seating height sneaks
// in. It is deliberately SCOPED to the vertical (Y) slot of position
// assignments so it does not flood on every `0` in the codebase (rotation: 0,
// array indices, numeric defaults, etc. are ignored):
//
//   • position={[x, <LITERAL>, z]}     (JSX prop)   — Y = element 1
//   • position: [x, <LITERAL>, z]      (object)     — Y = element 1
//   • obj.position.y = <LITERAL>
//   • obj.position.setY(<LITERAL>)
//   • obj.position.set(x, <LITERAL>, z)              — Y = arg 1
//
// Legitimate literal-Y cases (e.g. a light rig's elevation, which is not a
// ground/seating height) are permitted via the small ALLOWLIST below; each
// entry must carry a justification. A noisy guard is worse than none, so the
// scope is intentionally narrow.
//
// How to allowlist: add a { file, y, reason } entry below. `file` is matched as
// a path suffix, `y` is the exact literal text as written.
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");

const ALLOWLIST = [
  {
    file: "src/components/preview/Scene.tsx",
    y: "40",
    reason:
      "Directional-light rig elevation — a lighting position, not a ground/seating Y.",
  },
];

const NUM_LITERAL = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/** Recursively collect .ts/.tsx files under a directory. */
function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collect(full));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Split a comma-separated argument/element list at top nesting depth only. */
function splitTopLevel(inner) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of inner) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts.map((p) => p.trim());
}

function isAllowed(relPath, literal) {
  return ALLOWLIST.some(
    (a) => relPath.endsWith(a.file.replace(/^src\//, "src/")) && a.y === literal,
  );
}

const findings = [];

function flag(relPath, lineNo, lineText, literal, why) {
  if (isAllowed(relPath, literal)) return;
  findings.push({ relPath, lineNo, lineText: lineText.trim(), literal, why });
}

for (const file of collect(SRC)) {
  const relPath = relative(ROOT, file).split("\\").join("/");
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");

  lines.forEach((line, i) => {
    const lineNo = i + 1;

    // 1) position arrays: position={[...]} or position: [...]
    const arr = line.match(/position\s*(?:=\{|:)\s*\[([^\]]*)\]/);
    if (arr) {
      const els = splitTopLevel(arr[1]);
      if (els.length === 3 && NUM_LITERAL.test(els[1])) {
        flag(relPath, lineNo, line, els[1], "position array Y is a literal");
      }
    }

    // 2) .position.y = <literal>
    const setY = line.match(/\.position\.y\s*=\s*([+-]?[\d.]+)\b/);
    if (setY && NUM_LITERAL.test(setY[1])) {
      flag(relPath, lineNo, line, setY[1], ".position.y assigned a literal");
    }

    // 3) .position.setY(<literal>)
    const setYCall = line.match(/\.position\.setY\(\s*([+-]?[\d.]+)\s*\)/);
    if (setYCall && NUM_LITERAL.test(setYCall[1])) {
      flag(relPath, lineNo, line, setYCall[1], ".position.setY(literal)");
    }

    // 4) .position.set(x, <literal>, z)
    const setCall = line.match(/\.position\.set\(([^)]*)\)/);
    if (setCall) {
      const args = splitTopLevel(setCall[1]);
      if (args.length === 3 && NUM_LITERAL.test(args[1])) {
        flag(relPath, lineNo, line, args[1], ".position.set() Y arg is a literal");
      }
    }
  });
}

if (findings.length > 0) {
  console.error(
    "\n✗ Ground-seam guard: literal Y-position assignment(s) found.\n" +
      "  Route vertical placement through groundHeightAt(x, z) / a surface top,\n" +
      "  or add a justified entry to the ALLOWLIST in scripts/check-ground-seam.mjs.\n",
  );
  for (const f of findings) {
    console.error(`  ${f.relPath}:${f.lineNo}  [Y=${f.literal}] ${f.why}`);
    console.error(`      ${f.lineText}`);
  }
  console.error("");
  process.exit(1);
}

console.log("✓ Ground-seam guard: no inline literal Y-position assignments.");
