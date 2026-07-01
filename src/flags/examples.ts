// Hand-written example flags for the dev `#flags` QA route. They exercise every
// layer kind so the renderer can be eyeballed before any editor exists. Adding an
// example is trivial — append to FLAG_EXAMPLES and the QA route renders it.

import type { FlagDesign } from "./types";

export interface FlagExample {
  title: string;
  note: string;
  design: FlagDesign;
}

export const FLAG_EXAMPLES: FlagExample[] = [
  {
    title: "Plain solid",
    note: "A single solid field — the simplest possible flag.",
    design: {
      aspect: 1.5,
      layers: [{ kind: "field", fill: { kind: "solid", color: "#c1121f" } }],
    },
  },
  {
    title: "Horizontal tricolor",
    note: "A field under three horizontal stripe bands.",
    design: {
      aspect: 1.5,
      layers: [
        { kind: "field", fill: { kind: "solid", color: "#ffffff" } },
        {
          kind: "stripes",
          orientation: "horizontal",
          count: 3,
          colors: ["#000000", "#c1121f", "#ffd60a"],
        },
      ],
    },
  },
  {
    title: "Quartered field",
    note: "A quarterly division — four colored quarters.",
    design: {
      aspect: 1.5,
      layers: [
        {
          kind: "field",
          fill: {
            kind: "division",
            division: "quarterly",
            colors: ["#003049", "#fefee3", "#fefee3", "#003049"],
          },
        },
      ],
    },
  },
  {
    title: "Field + charge (lion)",
    note: "A solid field with a single centered charge.",
    design: {
      aspect: 1.5,
      layers: [
        { kind: "field", fill: { kind: "solid", color: "#8d0801" } },
        {
          kind: "charge",
          symbolId: "lion",
          x: 0.5,
          y: 0.5,
          scale: 0.8,
          color: "#ffd60a",
        },
      ],
    },
  },
  {
    title: "Busy (division + stripes + charges)",
    note: "Every layer kind: a per-bend division, diagonal stripes, and three charges.",
    design: {
      aspect: 1.5,
      layers: [
        {
          kind: "field",
          fill: {
            kind: "division",
            division: "perBend",
            colors: ["#14213d", "#a4161a"],
          },
        },
        {
          kind: "stripes",
          orientation: "diagonal",
          count: 6,
          colors: ["#14213d", "#a4161a"],
        },
        {
          kind: "charge",
          symbolId: "crown",
          x: 0.5,
          y: 0.28,
          scale: 0.35,
          color: "#ffd60a",
        },
        {
          kind: "charge",
          symbolId: "fleurDeLis",
          x: 0.28,
          y: 0.68,
          scale: 0.3,
          color: "#ffffff",
        },
        {
          kind: "charge",
          symbolId: "star",
          x: 0.72,
          y: 0.68,
          scale: 0.3,
          color: "#ffffff",
          rotation: 20,
        },
      ],
    },
  },
];
