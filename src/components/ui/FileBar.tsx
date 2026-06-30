import { useRef } from "react";
import { useStore } from "../../store/store";
import {
  DesignValidationError,
  downloadDesign,
  importDesignFile,
} from "../../persistence/storage";

export function FileBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    downloadDesign(useStore.getState().design);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same filename
    if (!file) return;
    try {
      const design = await importDesignFile(file);
      useStore.getState().loadDesign(design);
    } catch (err) {
      const msg =
        err instanceof DesignValidationError
          ? err.message
          : "Could not read that file.";
      window.alert(`Import failed: ${msg}`);
    }
  };

  return (
    <footer className="filebar">
      <div className="filebar__actions">
        <button type="button" onClick={handleExport}>
          Export JSON
        </button>
        <button type="button" onClick={handleImportClick}>
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          hidden
          data-testid="import-input"
        />
      </div>
      <p className="filebar__notice">
        Your work autosaves in this browser only. Clearing browser data erases
        it — use Export JSON to keep a backup.
      </p>
    </footer>
  );
}
