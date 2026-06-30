import { useStore, type StoreState } from "./store";

// Test-only window accessor, gated behind ?e2e=1. Playwright reads app/store state
// through this (never the WebGL canvas). It is intentionally read-mostly: it
// exposes the store's getState plus a couple of conveniences for assertions.

export interface CastleE2EApi {
  getState: () => StoreState;
  getPieces: () => StoreState["design"]["pieces"];
  getPieceCount: () => number;
  getSelectedId: () => string | null;
  subscribe: (listener: () => void) => () => void;
}

declare global {
  interface Window {
    __CASTLE_E2E__?: CastleE2EApi;
  }
}

export function isE2E(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("e2e") === "1";
}

export function installE2EAccessor(): void {
  if (!isE2E()) return;
  const api: CastleE2EApi = {
    getState: () => useStore.getState(),
    getPieces: () => useStore.getState().design.pieces,
    getPieceCount: () => useStore.getState().design.pieces.length,
    getSelectedId: () => useStore.getState().selectedId,
    subscribe: (listener) => useStore.subscribe(listener),
  };
  window.__CASTLE_E2E__ = api;
}
