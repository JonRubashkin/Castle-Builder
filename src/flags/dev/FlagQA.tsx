// Dev-only QA screen for the flag renderer, reachable at the URL hash `#flags`
// (analogous to the prior project's `#catalog`). It renders the hardcoded
// FLAG_EXAMPLES plus every symbol in the library on a solid field, so the whole
// layer-stack + charge pipeline can be eyeballed before any editor exists. NOT
// wired into the main app UI — it is a developer aid only.

import { FLAG_EXAMPLES } from "../examples";
import { allSymbols } from "../symbols";
import { FlagCanvas } from "./FlagCanvas";
import type { FlagDesign } from "../types";

const chargeShowcase = (symbolId: string): FlagDesign => ({
  aspect: 1.5,
  layers: [
    { kind: "field", fill: { kind: "solid", color: "#1d3557" } },
    {
      kind: "charge",
      symbolId: symbolId as never,
      x: 0.5,
      y: 0.5,
      scale: 0.85,
      color: "#f1faee",
    },
  ],
});

export function FlagQA() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111417",
        color: "#e8e8e8",
        font: "14px/1.5 system-ui, sans-serif",
        padding: "32px 40px",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ margin: "0 0 4px" }}>Flag renderer — QA</h1>
      <p style={{ margin: "0 0 28px", color: "#9aa4ad" }}>
        Dev-only route (<code>#flags</code>). Renders the example flags and the full
        symbol library. Not part of the main app.
      </p>

      <section>
        <h2 style={{ borderBottom: "1px solid #2a2f34", paddingBottom: 6 }}>
          Example flags
        </h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 28,
            marginTop: 20,
          }}
        >
          {FLAG_EXAMPLES.map((ex) => (
            <figure key={ex.title} style={{ margin: 0, maxWidth: 320 }}>
              <FlagCanvas design={ex.design} height={200} />
              <figcaption style={{ marginTop: 8 }}>
                <strong>{ex.title}</strong>
                <div style={{ color: "#9aa4ad" }}>{ex.note}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 44 }}>
        <h2 style={{ borderBottom: "1px solid #2a2f34", paddingBottom: 6 }}>
          Symbol library
        </h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            marginTop: 20,
          }}
        >
          {allSymbols().map((sym) => (
            <figure key={sym.id} style={{ margin: 0 }}>
              <FlagCanvas design={chargeShowcase(sym.id)} height={130} />
              <figcaption style={{ marginTop: 6, textAlign: "center" }}>
                {sym.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
