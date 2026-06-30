import { create } from "zustand";
import {
  createEmptyDesign,
  DEFAULT_GATEHOUSE_DEPTH,
  DEFAULT_GATEHOUSE_HEIGHT,
  DEFAULT_GATEHOUSE_WIDTH,
  DEFAULT_MERLON_SIZE,
  DEFAULT_STONE_MATERIAL,
  DEFAULT_TOWER_HEIGHT,
  DEFAULT_TOWER_RADIUS,
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  type Design,
  type Gatehouse,
  type Piece,
  type Tower,
  type Vec2,
  type WallRun,
} from "./schema";
import { resolveSupportAt } from "../geometry/support";
import { snapHorizontalVec2 } from "../geometry/grid";

export const HISTORY_CAP = 100;

export type Tool = "select" | "tower" | "gatehouse" | "wallRun";

/** Which endpoint of a wall run an edit targets. */
export type WallEndpoint = "start" | "end";

interface History {
  past: Design[];
  future: Design[];
}

export interface StoreState {
  design: Design;
  tool: Tool;
  selectedId: string | null;
  history: History;
  // Snapshot captured at the start of a transient interaction (drag/gizmo). While
  // non-null, piece mutations are previewed live without touching history; the
  // snapshot is what gets pushed to `past` when the interaction commits.
  pendingSnapshot: Design | null;

  // --- tool / selection ---
  setTool: (tool: Tool) => void;
  selectPiece: (id: string | null) => void;

  // --- committed mutations (each pushes one history entry) ---
  addTower: (input: { position: Vec2; base: number }) => string;
  addGatehouse: (input: { position: Vec2; base: number }) => string;
  addWallRun: (input: { position: Vec2; end: Vec2; base: number }) => string;
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
  resetDesign: () => void;
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
    selectedId: null,
    history: { past: [], future: [] },
    pendingSnapshot: null,

    setTool: (tool) => set({ tool }),
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
        set({ pendingSnapshot: clone(get().design) });
      }
    },

    setPiecePositionTransient: (id, position) => {
      set((state) => {
        const design = clone(state.design);
        const piece = design.pieces.find((p) => p.id === id);
        if (piece) {
          if (piece.kind === "wallRun") {
            // A whole-wall move shifts BOTH endpoints by the same delta, so the
            // wall keeps its shape. `position` is the new START anchor.
            const dx = position.x - piece.position.x;
            const dy = position.y - piece.position.y;
            piece.position = { ...position };
            piece.end = { x: piece.end.x + dx, y: piece.end.y + dy };
          } else {
            piece.position = { ...position };
          }
          // Resolve the dragged piece's base through the SAME support rule the
          // placement path uses (resolveSupportAt): groundHeightAt over open
          // ground, an existing piece's top via face-attach. The piece being
          // moved is excluded so it can't seat on its own footprint. This is
          // the single source of truth — no parallel ground-only logic and no
          // hardcoded ground-y in the move path. (Walls resolve at the start
          // anchor, i.e. `position`.)
          const others = design.pieces.filter((p) => p.id !== id);
          piece.base = resolveSupportAt(piece.position, others).base;
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
      }),

    resetDesign: () =>
      set({
        design: createEmptyDesign(),
        selectedId: null,
        history: { past: [], future: [] },
        pendingSnapshot: null,
      }),
  };
});
