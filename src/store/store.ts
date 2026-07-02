import { create } from "zustand";
import {
  createDefaultFlagDesign,
  createEmptyDesign,
  DEFAULT_FLAG_CLOTH_WIDTH,
  DEFAULT_FLAG_POLE_HEIGHT,
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
  DEFAULT_ROOF_MATERIAL,
  DEFAULT_ROOF_PITCH,
  DEFAULT_STONE_MATERIAL,
  DEFAULT_TIMBER_MATERIAL,
  DEFAULT_TOWER_HEIGHT,
  DEFAULT_TOWER_RADIUS,
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  DEFAULT_WATER_MATERIAL,
  type Design,
  type Flag,
  type Gate,
  type Gatehouse,
  type Moat,
  type Piece,
  type Ramp,
  type Tower,
  type Vec2,
  type WallRun,
} from "./schema";
import type { FlagDesign } from "../flags/types";
import {
  deleteEntry,
  overwriteEntry,
  renameEntry,
  saveNewEntry,
  type FlagLibrary,
} from "../flags/library";
import { flatTopWorldY, resolveSupportAt, type PlacementMode } from "../geometry/support";
import { allRidersOf, RIDER_BASE_TOLERANCE } from "../geometry/riders";
import { dropRidersAfterDelete } from "../geometry/deleteDrop";
import { resolvePlaceOnTop } from "../geometry/placeOnTop";
import { flagPositionsAlong, type FlagAlongOptions } from "../geometry/flagAlong";
import { groundHeightAt } from "../geometry/ground";
import { snapHorizontalVec2 } from "../geometry/grid";
import {
  loadFlagLibrary,
  loadLastFlagDesign,
  loadPlacementMode,
  saveFlagLibrary,
  saveLastFlagDesign,
  savePlacementMode,
} from "../persistence/storage";

export type { PlacementMode };

export const HISTORY_CAP = 100;

export type Tool =
  | "select"
  | "tower"
  | "gatehouse"
  | "wallRun"
  | "gate"
  | "moat"
  | "ramp"
  | "flag";

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
  // the Design, NOT in undo history). Modeled as one enum: "normal" (the default
  // face-attach rule) / "groundOnly" (the "Keep on ground" toggle).
  placementMode: PlacementMode;
  selectedId: string | null;
  // Whether the one-shot "Place on top" action is armed. A transient UI flag (NOT
  // part of the Design, NOT persisted, NOT in undo history): while armed, the next
  // click on a valid target piece seats the SELECTED piece on that target's top
  // (see placeOnTopTarget) instead of selecting it.
  placeOnTopArmed: boolean;
  // The saved-flags library (2Fd): named FlagDesigns reused across flags/castles.
  // It is a SEPARATE per-origin store — NOT part of the castle Design, NOT in its
  // Export JSON, NOT in undo history, and untouched by newDesign (New Castle).
  // Hydrated from its own localStorage slot on boot; every mutation persists it.
  flagLibrary: FlagLibrary;
  // The most recent FlagDesign the user applied/edited (2Fe.1) — a persisted UI
  // PREFERENCE that backs the "Use last design" option of the "Add flags along"
  // chooser. NOT part of the castle Design, NOT in its Export JSON, NOT in undo
  // history, and untouched by newDesign. null until the user has edited a design.
  lastFlagDesign: FlagDesign | null;
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

  // --- tool / selection ---
  setTool: (tool: Tool) => void;
  setMoatShape: (shape: MoatShape) => void;
  // Set the placement mode ("normal" / "groundOnly"). Persisted.
  setPlacementMode: (mode: PlacementMode) => void;
  selectPiece: (id: string | null) => void;

  // --- "Place on top" one-shot action ---
  // Arm the action (only meaningful with a piece selected); cancel disarms it.
  // placeOnTopTarget resolves a click on `targetId` while armed: it seats the
  // selected piece on the target's top (ONE undoable step, selection kept), or
  // cancels (clicking self / no selection), or is a no-op that stays armed
  // (clicking an invalid target — a moat or a ramp).
  armPlaceOnTop: () => void;
  cancelPlaceOnTop: () => void;
  placeOnTopTarget: (targetId: string) => void;

  // --- committed mutations (each pushes one history entry) ---
  addTower: (input: { position: Vec2; base: number }) => string;
  addGatehouse: (input: { position: Vec2; base: number }) => string;
  addWallRun: (input: { position: Vec2; end: Vec2; base: number }) => string;
  addGate: (input: { position: Vec2; base: number }) => string;
  // A flag is a single-anchor piece (ground-raycast + face-attach like a tower);
  // it embeds a default FlagDesign until the 2Fc editor exists.
  addFlag: (input: { position: Vec2; base: number }) => string;
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
  // Auto-place-along (2Fe): generate independent Flag pieces evenly spaced along a
  // HOST piece's top edge (a wall run / gatehouse — see flagPositionsAlong), each
  // embedding a COPY of the given design (or a fresh default). ONE undoable step;
  // returns the new flag ids. GENERATE-ONCE — the flags are ordinary independent
  // pieces from that moment (no live "follow the wall" link): later resizing/moving
  // the host does NOT re-space or move them. A no-op (returns []) for an
  // unsupported host or a degenerate edge.
  addFlagsAlong: (
    hostId: string,
    opts?: FlagAlongOptions & { design?: FlagDesign },
  ) => string[];
  setWallEndpoint: (id: string, which: WallEndpoint, point: Vec2) => void;
  // Replace a flag's embedded FlagDesign wholesale (the flag editor's Apply). ONE
  // undoable, coalesced commit: the editor edits a WORKING COPY in local state and
  // only calls this on Apply, so an entire editing session (many layer edits + a
  // charge drag) collapses into a single history entry — the project's
  // slider-coalescing spirit — while Cancel/Esc simply discard the working copy.
  // The `dims` param (2Fe.1) lets the editor's Apply commit the flag PIECE's
  // pole/cloth dimensions together with the design as ONE undoable step (the same
  // coalesced entry). poleHeight/clothWidth are properties of the Flag piece, NOT
  // of FlagDesign — they are never saved to the library. Applying also updates the
  // persisted `lastFlagDesign` pref.
  updateFlagDesign: (
    id: string,
    design: FlagDesign,
    dims?: { poleHeight?: number; clothWidth?: number },
  ) => void;
  // Set the persisted "last flag design" pref directly (used when a design is
  // authored via the "Design new" chooser path, which never touches a placed flag).
  setLastFlagDesign: (design: FlagDesign) => void;
  deletePiece: (id: string) => void;

  // --- saved-flags library (2Fd) — separate from the Design, not undoable ---
  // Save the given design under a NEW named entry; returns the new entry's id (so
  // the editor can record it as the working design's source for later Overwrite).
  saveFlagToLibrary: (name: string, design: FlagDesign) => string;
  // Overwrite an existing entry's design in place (an EXPLICIT choice — never
  // silent). Rename / delete manage entries from the picker. Deleting an entry
  // does NOT touch any placed flag that already embedded a copy of it.
  overwriteFlagLibraryEntry: (id: string, design: FlagDesign) => void;
  renameFlagLibraryEntry: (id: string, name: string) => void;
  deleteFlagLibraryEntry: (id: string) => void;
  // Replace the whole library (library-only JSON import — its own backup path).
  replaceFlagLibrary: (library: FlagLibrary) => void;

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
    placeOnTopArmed: false,
    flagLibrary: loadFlagLibrary(), // hydrate the saved-flags palette on boot
    lastFlagDesign: loadLastFlagDesign(), // hydrate the last-used design pref on boot
    history: { past: [], future: [] },
    pendingSnapshot: null,
    bootNonce: 0,

    setTool: (tool) => set({ tool }),
    setMoatShape: (moatShape) => set({ moatShape }),
    setPlacementMode: (placementMode) => {
      savePlacementMode(placementMode); // persist the pref (survives reload)
      set({ placementMode });
    },
    selectPiece: (id) =>
      // Selecting (or deselecting) also disarms the one-shot "Place on top".
      set((state) => ({
        selectedId: selectionStillValid(state.design, id),
        placeOnTopArmed: false,
      })),

    armPlaceOnTop: () => {
      if (get().selectedId) set({ placeOnTopArmed: true });
    },

    cancelPlaceOnTop: () => set({ placeOnTopArmed: false }),

    placeOnTopTarget: (targetId) => {
      const state = get();
      if (!state.placeOnTopArmed) return;
      const movingId = state.selectedId;
      // Clicking self, or an unresolvable selection, cancels (disarms).
      if (!movingId || targetId === movingId) {
        set({ placeOnTopArmed: false });
        return;
      }
      const moving = state.design.pieces.find((p) => p.id === movingId);
      const target = state.design.pieces.find((p) => p.id === targetId);
      if (!moving || !target) {
        set({ placeOnTopArmed: false });
        return;
      }
      const result = resolvePlaceOnTop(moving, target);
      // Invalid target (a moat / a ramp — no flat top) → no-op that STAYS armed,
      // so the user can pick a real target without re-arming.
      if (!result) return;
      // ONE undoable step: seat the moving piece on the target's top, centered.
      commit((design) => {
        const piece = design.pieces.find((p) => p.id === movingId);
        if (piece) {
          piece.position = { ...result.position };
          piece.base = result.base;
          if (result.end && "end" in piece && piece.end) piece.end = { ...result.end };
        }
        return design;
      });
      // The moved piece stays selected (commit preserves a still-valid selection);
      // the action ends.
      set({ placeOnTopArmed: false });
    },

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
        // Roof (schema v3): off by default; params stored so a later toggle-on works.
        roofed: false,
        roofPitch: DEFAULT_ROOF_PITCH,
        roofMaterial: DEFAULT_ROOF_MATERIAL,
        raisedOnPosts: false,
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
        roofed: false,
        roofPitch: DEFAULT_ROOF_PITCH,
        roofMaterial: DEFAULT_ROOF_MATERIAL,
        raisedOnPosts: false,
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
        // Wall-walk cover (schema v3): off by default; always posted when on.
        roofed: false,
        roofPitch: DEFAULT_ROOF_PITCH,
        roofMaterial: DEFAULT_ROOF_MATERIAL,
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

    addFlag: ({ position, base }) => {
      const id = nextId();
      const flag: Flag = {
        id,
        kind: "flag",
        position: { ...position },
        base,
        rotation: 0,
        // A fresh default design per flag (embed model: the flag owns its design).
        design: createDefaultFlagDesign(),
        poleHeight: DEFAULT_FLAG_POLE_HEIGHT,
        clothWidth: DEFAULT_FLAG_CLOTH_WIDTH,
      };
      commit((design) => {
        design.pieces.push(flag);
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
        // Incline cover (schema v3): off by default; always posted when on.
        roofed: false,
        roofPitch: DEFAULT_ROOF_PITCH,
        roofMaterial: DEFAULT_ROOF_MATERIAL,
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
        if (!piece) return design;

        // RIDERS (phase 2G) — ride on resize/raise. An edit that raises the piece's
        // FLAT TOP (its height) or its base moves the surface riders sit on; the
        // riders must move by the same vertical delta so they stay ON TOP instead
        // of being buried or left floating. Capture the pre-edit top + the rider
        // set BEFORE mutating (the transitive stack, cycle-safe, once each). Only
        // edits that change base + height matter; a horizontal-only change
        // (material, radius, width/depth, rotation) leaves the top unchanged → the
        // delta is 0 → riders are untouched (we do NOT chase a shrunken footprint —
        // don't auto-mutate surprisingly). All in ONE undo step with the edit.
        const topBefore = flatTopWorldY(piece); // null for non-surface pieces
        const riders = topBefore === null ? [] : allRidersOf(piece, design.pieces);

        Object.assign(piece, patch);

        if (riders.length > 0) {
          const topAfter = flatTopWorldY(piece);
          if (topBefore !== null && topAfter !== null) {
            const delta = topAfter - topBefore; // Δbase + Δheight
            if (Math.abs(delta) > RIDER_BASE_TOLERANCE) {
              const riderIds = new Set(riders.map((r) => r.id));
              for (const p of design.pieces) {
                if (riderIds.has(p.id)) p.base += delta;
              }
            }
          }
        }
        return design;
      });
    },

    addFlagsAlong: (hostId, opts = {}) => {
      const host = get().design.pieces.find((p) => p.id === hostId);
      if (!host) return [];
      const { design: chosenDesign, ...alongOpts } = opts;
      const placements = flagPositionsAlong(host, alongOpts);
      if (placements.length === 0) return [];
      // Each generated flag EMBEDS its own copy of the design (the embed model),
      // so they are indistinguishable from hand-placed flags — independently
      // selectable / movable / editable / deletable afterward. Generate-once: they
      // carry no LIVE link back to the host. They DO carry a provenance MARKER
      // (autoFlagHostId) so a re-run can find and replace exactly this host's set.
      const source = chosenDesign ?? createDefaultFlagDesign();
      const flags: Flag[] = placements.map((pl) => ({
        id: nextId(),
        kind: "flag",
        position: { ...pl.position },
        base: pl.base,
        rotation: 0,
        design: clone(source),
        poleHeight: DEFAULT_FLAG_POLE_HEIGHT,
        clothWidth: DEFAULT_FLAG_CLOTH_WIDTH,
        autoFlagHostId: hostId,
      }));
      const ids = flags.map((f) => f.id);
      // ONE undoable step that RE-RUN-REPLACES: first remove every flag currently
      // tagged to this host (a WHOLESALE replace — including any the user hand-moved
      // after a prior generation; this is explicit and user-triggered, so the user
      // simply doesn't re-run if they've tweaked flags they want to keep), then push
      // the fresh batch. Undo reverses the whole replace (removals + additions).
      commit((design) => {
        design.pieces = design.pieces.filter(
          (p) => !(p.kind === "flag" && p.autoFlagHostId === hostId),
        );
        design.pieces.push(...flags);
        return design;
      });
      return ids;
    },

    updateFlagDesign: (id, flagDesign, dims) => {
      commit((design) => {
        const piece = design.pieces.find((p) => p.id === id);
        // Only flags carry an embedded design; clone so the working copy the
        // editor keeps editing can't leak into committed (history) state.
        if (piece && piece.kind === "flag") {
          piece.design = clone(flagDesign);
          // The pole/cloth dimensions are PIECE props (not design), committed in
          // the SAME undoable step so the editor's Apply is one coalesced entry.
          if (dims?.poleHeight !== undefined) piece.poleHeight = dims.poleHeight;
          if (dims?.clothWidth !== undefined) piece.clothWidth = dims.clothWidth;
        }
        return design;
      });
      // Remember the design as the "last used" pref (backs the chooser's use-last).
      // Persisted; NOT in undo history (a separate pref, like Keep-on-ground).
      saveLastFlagDesign(flagDesign);
      set({ lastFlagDesign: clone(flagDesign) });
    },

    setLastFlagDesign: (flagDesign) => {
      saveLastFlagDesign(flagDesign);
      set({ lastFlagDesign: clone(flagDesign) });
    },

    // --- saved-flags library (separate store; persisted; not undoable) -------
    // These mutate `flagLibrary` (never the castle Design) and persist to the
    // library's own slot. The pure CRUD deep-clones designs in, so a saved entry
    // never shares a reference with the editor's working copy (copy, not link).

    saveFlagToLibrary: (name, design) => {
      const { library, entry } = saveNewEntry(get().flagLibrary, name, design);
      saveFlagLibrary(library);
      set({ flagLibrary: library });
      return entry.id;
    },

    overwriteFlagLibraryEntry: (id, design) => {
      const library = overwriteEntry(get().flagLibrary, id, design);
      saveFlagLibrary(library);
      set({ flagLibrary: library });
    },

    renameFlagLibraryEntry: (id, name) => {
      const library = renameEntry(get().flagLibrary, id, name);
      saveFlagLibrary(library);
      set({ flagLibrary: library });
    },

    deleteFlagLibraryEntry: (id) => {
      const library = deleteEntry(get().flagLibrary, id);
      saveFlagLibrary(library);
      set({ flagLibrary: library });
    },

    replaceFlagLibrary: (library) => {
      saveFlagLibrary(library);
      set({ flagLibrary: library });
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
      // DELETE-DROP (riding cleanup): removing a piece must not leave its riders
      // floating. dropRidersAfterDelete removes the piece AND re-seats each
      // orphaned direct rider onto whatever support is now beneath it (the next
      // top, else the ground), carrying its transitive sub-stack down rigidly —
      // all through the SAME resolveSupportAt riding uses. ONE undoable step
      // (delete + the drops reverse together).
      commit((design) => {
        design.pieces = dropRidersAfterDelete(design.pieces, id);
        return design;
      });
      set((state) => ({
        selectedId: state.selectedId === id ? null : state.selectedId,
      }));
    },

    beginTransient: () => {
      // Only one interaction at a time; capture the pre-interaction snapshot.
      if (get().pendingSnapshot === null) {
        set({ pendingSnapshot: clone(get().design) });
      }
    },

    setPiecePositionTransient: (id, position) => {
      set((state) => {
        // Base the transient off the PRE-DRAG snapshot when an interaction is in
        // progress, so riders are computed from the pre-move geometry and each is
        // moved exactly once by the TOTAL delta (idempotent across the repeated
        // mid-drag calls a gizmo fires — never re-evaluated frame to frame, which
        // could double-move or drop a rider whose overlap drifts). Falls back to
        // the live design if no snapshot exists.
        const source = state.pendingSnapshot ?? state.design;
        const design = clone(source);
        const piece = design.pieces.find((p) => p.id === id);
        if (!piece) return { design: state.design };

        // The total horizontal delta from the piece's ORIGINAL anchor (in the
        // snapshot) to the requested new anchor.
        const dx = position.x - piece.position.x;
        const dy = position.y - piece.position.y;

        // RIDERS (phase 2G): everything resting on this piece, transitively,
        // computed ONCE from the pre-move geometry and cycle-safe. They ride the
        // move rigidly by the same horizontal delta — as ONE undo step (the
        // commit pushes a single snapshot on mouse-up). A move does not change the
        // host's top height, so riders keep their base; they RIDE, they do not
        // re-seat their own support mid-move.
        const riderIds = new Set(allRidersOf(piece, design.pieces).map((r) => r.id));

        // Two-endpoint pieces (a wall run, or a SEGMENT moat) move as a rigid
        // body: shift BOTH endpoints by the same delta so the piece keeps its
        // shape. `position` is the new START anchor.
        const twoPoint =
          piece.kind === "wallRun" ||
          (piece.kind === "moat" && piece.shape === "segment");
        if (twoPoint && "end" in piece && piece.end) {
          piece.position = { ...position };
          piece.end = { x: piece.end.x + dx, y: piece.end.y + dy };
        } else {
          piece.position = { ...position };
        }
        // The moat is GROUND-ONLY (no face-attach); its base routes through the
        // ground-height rule, never an existing piece's top. Every other piece
        // resolves its base through the SAME mode-aware support rule the placement
        // path uses (resolveSupportAt): groundHeightAt over open ground, a piece
        // top via face-attach. The moved piece AND its riders are excluded so it
        // can't seat on its own footprint OR climb onto something riding it. This
        // is the single source of truth — no hardcoded ground-y and no parallel
        // placement logic; the active placement mode is read HERE and passed
        // straight through. (Walls resolve at the start anchor, `position`.)
        if (piece.kind === "moat") {
          // A moat is inherently ground-only; the toggle doesn't change that.
          piece.base = groundOnlyBase(piece.position);
        } else {
          const others = design.pieces.filter(
            (p) => p.id !== id && !riderIds.has(p.id),
          );
          piece.base = resolveSupportAt(piece.position, others, state.placementMode).base;
        }

        // Translate every rider rigidly by the same horizontal delta (two-point
        // riders shift both endpoints). Their base is untouched.
        if ((dx !== 0 || dy !== 0) && riderIds.size > 0) {
          for (const rider of design.pieces) {
            if (!riderIds.has(rider.id)) continue;
            rider.position = { x: rider.position.x + dx, y: rider.position.y + dy };
            if ("end" in rider && rider.end) {
              rider.end = { x: rider.end.x + dx, y: rider.end.y + dy };
            }
          }
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
      set((state) => ({
        history: pushPast(state.history, snapshot),
        pendingSnapshot: null,
      }));
    },

    cancelTransient: () => {
      const snapshot = get().pendingSnapshot;
      if (snapshot === null) return;
      set({ design: snapshot, pendingSnapshot: null });
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
          placeOnTopArmed: false,
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
          placeOnTopArmed: false,
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
        placeOnTopArmed: false,
      }),

    newDesign: () =>
      set((state) => ({
        design: createEmptyDesign(),
        // Reset every doc-dependent transient so nothing references a gone piece.
        selectedId: null,
        history: { past: [], future: [] },
        pendingSnapshot: null,
        placeOnTopArmed: false,
        // Bump the boot counter → the editor tree remounts clean (clearing any
        // component-local in-progress placement/drag state too).
        bootNonce: state.bootNonce + 1,
      })),
  };
});
