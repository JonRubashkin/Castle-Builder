import { create } from "zustand";
import {
  createEmptyDesign,
  DEFAULT_MERLON_SIZE,
  DEFAULT_STONE_MATERIAL,
  DEFAULT_TOWER_HEIGHT,
  DEFAULT_TOWER_RADIUS,
  type Design,
  type Piece,
  type Tower,
  type Vec2,
} from "./schema";

export const HISTORY_CAP = 100;

export type Tool = "select" | "tower";

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
  updatePiece: (id: string, patch: Partial<Piece>) => void;
  deletePiece: (id: string) => void;

  // --- transient interaction (drag / gizmo) ---
  beginTransient: () => void;
  setPiecePositionTransient: (id: string, position: Vec2) => void;
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

    updatePiece: (id, patch) => {
      commit((design) => {
        const piece = design.pieces.find((p) => p.id === id);
        if (piece) Object.assign(piece, patch);
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
        if (piece) piece.position = { ...position };
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
