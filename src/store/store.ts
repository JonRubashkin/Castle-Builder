import { create } from "zustand";
import {
  createEmptyDesign,
  DEFAULT_GATE_HEIGHT,
  DEFAULT_GATE_WIDTH,
  DEFAULT_GATEHOUSE_DEPTH,
  DEFAULT_GATEHOUSE_HEIGHT,
  DEFAULT_GATEHOUSE_WIDTH,
  DEFAULT_MERLON_SIZE,
  DEFAULT_MOAT_INNER_RADIUS,
  DEFAULT_MOAT_OUTER_RADIUS,
  DEFAULT_MOAT_WIDTH,
  DEFAULT_RAMP_WIDTH,
  DEFAULT_STONE_MATERIAL,
  DEFAULT_TIMBER_MATERIAL,
  DEFAULT_TOWER_HEIGHT,
  DEFAULT_TOWER_RADIUS,
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  DEFAULT_WATER_MATERIAL,
  type Design,
  type Gate,
  type Gatehouse,
  type Moat,
  type Piece,
  type Ramp,
  type Tower,
  type Vec2,
  type WallRun,
} from "./schema";
import { resolveSupportAt, type PlacementMode } from "../geometry/support";
import { groundHeightAt } from "../geometry/ground";
import { snapHorizontalVec2 } from "../geometry/grid";
import { loadPlacementMode, savePlacementMode } from "../persistence/storage";

export type { PlacementMode };

export const HISTORY_CAP = 100;

export type Tool =
  | "select"
  | "tower"
  | "gatehouse"
  | "wallRun"
  | "gate"
  | "moat"
  | "ramp";

/** The moat tool's sub-mode: a ring (annulus) or a straight segment. */
export type MoatShape = "ring" | "segment";

/** Which endpoint of a wall run an edit targets. */
export type WallEndpoint = "start" | "end";

/**
 * The moat is OPAQUE water and seats ground-only — it never face-attaches (water
 * on a tower top is nonsensical). Its base still routes through the ground-height
 * rule (groundHeightAt is the single source for "where is the ground"), so raised
 * terrain slots in later: base is the moat underside RELATIVE to ground, always 0.
 */
function groundOnlyBase(anchor: Vec2): number {
  // worldY = groundHeightAt(anchor) + base; for a ground-seated piece base = 0.
  return groundHeightAt(anchor.x, anchor.y) - groundHeightAt(anchor.x, anchor.y);
}

interface History {
  past: Design[];
  future: Design[];
}

export interface StoreState {
  design: Design;
  tool: Tool;
  moatShape: MoatShape;
  // The placement mode for the MOVE/DRAG path — a persisted UI pref (NOT part of
  // the Design, NOT in undo history). The two toggle tabs are mutually exclusive,
  // modeled as one enum: "normal" (both off) / "groundOnly" / "centerOnSupport".
  placementMode: PlacementMode;
  selectedId: string | null;
  history: History;
  // A monotonic boot counter bumped by newDesign(). The editor tree is keyed on
  // it (<Editor key={bootNonce} />) so a "New Castle" reset fully REMOUNTS a clean
  // tree rather than mutating the live one in place — the prior project's hard-won
  // cure for a reset that swaps the doc but leaves dangling component-local
  // transient state (in-progress placement drafts, drag refs) behind.
  bootNonce: number;
  // Snapshot captured at the start of a transient interaction (drag/gizmo). While
  // non-null, piece mutations are previewed live without touching history; the
  // snapshot is what gets pushed to `past` when the interaction commits.
  pendingSnapshot: Design | null;
  // Center-on-support defers its XZ anchor snap to the DROP (commitTransient),
  // not the live drag. During a gizmo drag the mesh's group is driven imperatively
  // by TransformControls from the pointer; moving the anchor mid-drag would fight
  // that (two writers on one object → jitter, the piece never settles on top). So
  // the live move keeps the anchor tracking the pointer (height still resolved) and
  // stashes the target center here; commitTransient applies it when the drag ends.
  pendingCenterSnap: { id: string; position: Vec2; end?: Vec2 } | null;

  // --- tool / selection ---
  setTool: (tool: Tool) => void;
  setMoatShape: (shape: MoatShape) => void;
  // Set the placement mode. Because it is a single enum, setting one value
  // inherently clears the other (the two toggles' mutual exclusivity). Persisted.
  setPlacementMode: (mode: PlacementMode) => void;
  selectPiece: (id: string | null) => void;

  // --- committed mutations (each pushes one history entry) ---
  addTower: (input: { position: Vec2; base: number }) => string;
  addGatehouse: (input: { position: Vec2; base: number }) => string;
  addWallRun: (input: { position: Vec2; end: Vec2; base: number }) => string;
  addGate: (input: { position: Vec2; base: number }) => string;
  // The ramp connects two points: the caller computes position/base/rotation/
  // rise/run (via resolveRampConnection) or falls back to defaults; width/style/
  // material default here and stay editable in the panel.
  addRamp: (input: {
    position: Vec2;
    base: number;
    rotation: number;
    rise: number;
    run: number;
  }) => string;
  // The moat is ground-only; the caller passes just the footprint, and the base
  // is resolved from the ground rule (groundHeightAt), never face-attach.
  addMoatRing: (input: { position: Vec2 }) => string;
  addMoatSegment: (input: { position: Vec2; end: Vec2 }) => string;
  updatePiece: (id: string, patch: Partial<Piece>) => void;
  setWallEndpoint: (id: string, which: WallEndpoint, point: Vec2) => void;
  deletePiece: (id: string) => void;

  // --- transient interaction (drag / gizmo) ---
  beginTransient: () => void;
  setPiecePositionTransient: (id: string, position: Vec2) => void;
  setWallEndpointTransient: (id: string, which: WallEndpoint, point: Vec2) => void;
  commitTransient: () => void;
  cancelTransient: () => void;

  // --- history ---
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // --- persistence / lifecycle ---
  loadDesign: (design: Design) => void;
  // Start a fresh, empty design. ONE shared atomic reset: swaps in a new empty
  // Design AND resets every doc-dependent transient (selection, undo/redo
  // history, the pending-interaction snapshot) so no reference to a now-gone
  // piece can survive, then bumps bootNonce so the editor tree remounts clean.
  newDesign: () => void;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `piece-${Date.now().toString(36)}-${idCounter}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function pushPast(history: History, prevDesign: Design): History {
  const past = [...history.past, clone(prevDesign)];
  if (past.length > HISTORY_CAP) past.shift();
  return { past, future: [] };
}

function selectionStillValid(design: Design, id: string | null): string | null {
  if (id === null) return null;
  return design.pieces.some((p) => p.id === id) ? id : null;
}

export const useStore = create<StoreState>((set, get) => {
  // Commit a mutation: snapshot the current design into history, then apply.
  const commit = (mutate: (design: Design) => Design) => {
    const prev = get().design;
    const next = mutate(clone(prev));
    set((state) => ({
      design: next,
      history: pushPast(state.history, prev),
      selectedId: selectionStillValid(next, state.selectedId),
    }));
  };

  return {
    design: createEmptyDesign(),
    tool: "tower",
    moatShape: "ring",
    placementMode: loadPlacementMode(), // hydrate the persisted pref on boot
    selectedId: null,
    history: { past: [], future: [] },
    pendingSnapshot: null,
    pendingCenterSnap: null,
    bootNonce: 0,

    setTool: (tool) => set({ tool }),
    setMoatShape: (moatShape) => set({ moatShape }),
    setPlacementMode: (placementMode) => {
      savePlacementMode(placementMode); // persist the pref (survives reload)
      set({ placementMode });
    },
    selectPiece: (id) =>
      set((state) => ({ selectedId: selectionStillValid(state.design, id) })),

    addTower: ({ position, base }) => {
      const id = nextId();
      const tower: Tower = {
        id,
        kind: "tower",
        position: { ...position },
        base,
        rotation: 0,
        profile: "round",
        radius: DEFAULT_TOWER_RADIUS,
        height: DEFAULT_TOWER_HEIGHT,
        crenellated: false,
        merlonSize: DEFAULT_MERLON_SIZE,
        material: DEFAULT_STONE_MATERIAL,
      };
      commit((design) => {
        design.pieces.push(tower);
        return design;
      });
      return id;
    },

    addGatehouse: ({ position, base }) => {
      const id = nextId();
      const gatehouse: Gatehouse = {
        id,
        kind: "gatehouse",
        position: { ...position },
        base,
        rotation: 0,
        width: DEFAULT_GATEHOUSE_WIDTH,
        depth: DEFAULT_GATEHOUSE_DEPTH,
        height: DEFAULT_GATEHOUSE_HEIGHT,
        crenellated: false,
        merlonSize: DEFAULT_MERLON_SIZE,
        material: DEFAULT_STONE_MATERIAL,
      };
      commit((design) => {
        design.pieces.push(gatehouse);
        return design;
      });
      return id;
    },

    addWallRun: ({ position, end, base }) => {
      const id = nextId();
      const wall: WallRun = {
        id,
        kind: "wallRun",
        position: { ...position },
        end: { ...end },
        base,
        rotation: 0, // unused for wall runs; the two points define direction
        height: DEFAULT_WALL_HEIGHT,
        thickness: DEFAULT_WALL_THICKNESS,
        crenellated: false,
        merlonSize: DEFAULT_MERLON_SIZE,
        material: DEFAULT_STONE_MATERIAL,
      };
      commit((design) => {
        design.pieces.push(wall);
        return design;
      });
      return id;
    },

    addGate: ({ position, base }) => {
      const id = nextId();
      const gate: Gate = {
        id,
        kind: "gate",
        position: { ...position },
        base,
        rotation: 0,
        width: DEFAULT_GATE_WIDTH,
        height: DEFAULT_GATE_HEIGHT,
        material: DEFAULT_TIMBER_MATERIAL,
      };
      commit((design) => {
        design.pieces.push(gate);
        return design;
      });
      return id;
    },

    addRamp: ({ position, base, rotation, rise, run }) => {
      const id = nextId();
      const ramp: Ramp = {
        id,
        kind: "ramp",
        position: { ...position },
        base,
        rotation,
        rise,
        run,
        width: DEFAULT_RAMP_WIDTH,
        style: "ramp",
        material: DEFAULT_STONE_MATERIAL,
      };
      commit((design) => {
        design.pieces.push(ramp);
        return design;
      });
      return id;
    },

    addMoatRing: ({ position }) => {
      const id = nextId();
      const moat: Moat = {
        id,
        kind: "moat",
        position: { ...position },
        base: groundOnlyBase(position), // ground-only (no face-attach)
        rotation: 0,
        shape: "ring",
        outerRadius: DEFAULT_MOAT_OUTER_RADIUS,
        innerRadius: DEFAULT_MOAT_INNER_RADIUS,
        material: DEFAULT_WATER_MATERIAL,
      };
      commit((design) => {
        design.pieces.push(moat);
        return design;
      });
      return id;
    },

    addMoatSegment: ({ position, end }) => {
      const id = nextId();
      const moat: Moat = {
        id,
        kind: "moat",
        position: { ...position },
        base: groundOnlyBase(position), // ground-only (no face-attach)
        rotation: 0,
        shape: "segment",
        end: { ...end },
        width: DEFAULT_MOAT_WIDTH,
        material: DEFAULT_WATER_MATERIAL,
      };
      commit((design) => {
        design.pieces.push(moat);
        return design;
      });
      return id;
    },

    updatePiece: (id, patch) => {
      commit((design) => {
        const piece = design.pieces.find((p) => p.id === id);
        if (piece) Object.assign(piece, patch);
        return design;
      });
    },

    setWallEndpoint: (id, which, point) => {
      commit((design) => {
        const piece = design.pieces.find((p) => p.id === id);
        if (piece && piece.kind === "wallRun") {
          const snapped = snapHorizontalVec2(point);
          if (which === "start") piece.position = snapped;
          else piece.end = snapped;
          // Re-resolve the base at the START anchor (the wall's support rule),
          // excluding the wall itself so it can't seat on its own footprint.
          const others = design.pieces.filter((p) => p.id !== id);
          piece.base = resolveSupportAt(piece.position, others).base;
        }
        return design;
      });
    },

    deletePiece: (id) => {
      commit((design) => {
        design.pieces = design.pieces.filter((p) => p.id !== id);
        return design;
      });
      set((state) => ({
        selectedId: state.selectedId === id ? null : state.selectedId,
      }));
    },

    beginTransient: () => {
      // Only one interaction at a time; capture the pre-interaction snapshot.
      if (get().pendingSnapshot === null) {
        set({ pendingSnapshot: clone(get().design), pendingCenterSnap: null });
      }
    },

    setPiecePositionTransient: (id, position) => {
      set((state) => {
        const design = clone(state.design);
        const piece = design.pieces.find((p) => p.id === id);
        if (piece) {
          // Two-endpoint pieces (a wall run, or a SEGMENT moat) move as a rigid
          // body: shift BOTH endpoints by the same delta so the piece keeps its
          // shape. `position` is the new START anchor.
          const twoPoint =
            piece.kind === "wallRun" ||
            (piece.kind === "moat" && piece.shape === "segment");
          if (twoPoint && "end" in piece && piece.end) {
            const dx = position.x - piece.position.x;
            const dy = position.y - piece.position.y;
            piece.position = { ...position };
            piece.end = { x: piece.end.x + dx, y: piece.end.y + dy };
          } else {
            piece.position = { ...position };
          }
          // The moat is GROUND-ONLY (no face-attach); its base routes through the
          // ground-height rule, never an existing piece's top. Every other piece
          // resolves its base through the SAME mode-aware support rule the
          // placement path uses (resolveSupportAt): groundHeightAt over open
          // ground, a piece top via face-attach. The piece being moved is excluded
          // so it can't seat on its own footprint. This is the single source of
          // truth — no hardcoded ground-y and no parallel placement logic; the
          // active placement mode is read HERE and passed straight through.
          // (Walls resolve at the start anchor, `position`.)
          let pendingCenterSnap: StoreState["pendingCenterSnap"] = null;
          if (piece.kind === "moat") {
            // A moat is inherently ground-only; the toggles don't change that.
            piece.base = groundOnlyBase(piece.position);
          } else {
            const others = design.pieces.filter((p) => p.id !== id);
            // Pass the moved piece so centerOnSupport can measure footprint
            // overlap (it latches as soon as the piece is >50% over a support or
            // its center aligns, not only when the anchor is over the support).
            const support = resolveSupportAt(piece.position, others, state.placementMode, piece);
            piece.base = support.base;
            // Center-on-support: the anchor must snap onto the supporting piece's
            // center (its own footprint anchor — never a separately computed one),
            // but NOT during the live drag: the mesh's group is driven imperatively
            // by TransformControls from the pointer, so moving the anchor here would
            // fight it (jitter, the piece never lands on top). Instead keep the
            // anchor tracking the pointer (the height/base above already resolved
            // via face-attach) and stash the target center; commitTransient applies
            // it on drop. A two-point piece (a wall run) shifts both endpoints
            // rigidly by the same delta so it keeps its shape.
            if (support.center) {
              const snap: NonNullable<StoreState["pendingCenterSnap"]> = {
                id,
                position: { ...support.center },
              };
              if ("end" in piece && piece.end) {
                const dx = support.center.x - piece.position.x;
                const dy = support.center.y - piece.position.y;
                snap.end = { x: piece.end.x + dx, y: piece.end.y + dy };
              }
              pendingCenterSnap = snap;
            }
          }
          return { design, pendingCenterSnap };
        }
        return { design };
      });
    },

    setWallEndpointTransient: (id, which, point) => {
      set((state) => {
        const design = clone(state.design);
        const piece = design.pieces.find((p) => p.id === id);
        if (piece && piece.kind === "wallRun") {
          // Move ONE endpoint, reshaping the wall live (caller has grid-snapped).
          if (which === "start") piece.position = { ...point };
          else piece.end = { ...point };
          // Base re-resolves at the START anchor (the wall's support rule).
          const others = design.pieces.filter((p) => p.id !== id);
          piece.base = resolveSupportAt(piece.position, others).base;
        }
        return { design };
      });
    },

    commitTransient: () => {
      const snapshot = get().pendingSnapshot;
      if (snapshot === null) return;
      set((state) => {
        // Apply a deferred center-on-support snap now that the drag has ended
        // (see pendingCenterSnap): the anchor jumps onto the support's center
        // without fighting the live gizmo. The height was already resolved during
        // the drag; here we only move the XZ anchor (and, for a two-point piece,
        // its far endpoint rigidly).
        let design = state.design;
        const snap = state.pendingCenterSnap;
        if (snap) {
          design = clone(design);
          const piece = design.pieces.find((p) => p.id === snap.id);
          if (piece) {
            piece.position = { ...snap.position };
            if (snap.end && "end" in piece && piece.end) {
              piece.end = { ...snap.end };
            }
          }
        }
        return {
          design,
          history: pushPast(state.history, snapshot),
          pendingSnapshot: null,
          pendingCenterSnap: null,
        };
      });
    },

    cancelTransient: () => {
      const snapshot = get().pendingSnapshot;
      if (snapshot === null) return;
      set({ design: snapshot, pendingSnapshot: null, pendingCenterSnap: null });
    },

    undo: () => {
      set((state) => {
        const { past, future } = state.history;
        if (past.length === 0) return {};
        const prev = past[past.length - 1];
        return {
          design: clone(prev),
          history: {
            past: past.slice(0, -1),
            future: [clone(state.design), ...future],
          },
          selectedId: selectionStillValid(prev, state.selectedId),
          pendingSnapshot: null,
          pendingCenterSnap: null,
        };
      });
    },

    redo: () => {
      set((state) => {
        const { past, future } = state.history;
        if (future.length === 0) return {};
        const next = future[0];
        return {
          design: clone(next),
          history: {
            past: [...past, clone(state.design)],
            future: future.slice(1),
          },
          selectedId: selectionStillValid(next, state.selectedId),
          pendingSnapshot: null,
          pendingCenterSnap: null,
        };
      });
    },

    canUndo: () => get().history.past.length > 0,
    canRedo: () => get().history.future.length > 0,

    loadDesign: (design) =>
      set({
        design: clone(design),
        selectedId: null,
        history: { past: [], future: [] },
        pendingSnapshot: null,
        pendingCenterSnap: null,
      }),

    newDesign: () =>
      set((state) => ({
        design: createEmptyDesign(),
        // Reset every doc-dependent transient so nothing references a gone piece.
        selectedId: null,
        history: { past: [], future: [] },
        pendingSnapshot: null,
        pendingCenterSnap: null,
        // Bump the boot counter → the editor tree remounts clean (clearing any
        // component-local in-progress placement/drag state too).
        bootNonce: state.bootNonce + 1,
      })),
  };
});
