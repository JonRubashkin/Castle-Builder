import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { FlagQA } from "./flags/dev/FlagQA";
import "./index.css";

// A tiny hash router: the dev-only `#flags` QA screen vs. the real editor.
// (Analogous to the prior project's `#catalog` route.) It re-reads on hashchange
// so navigating to/from `#flags` swaps screens without a manual reload.
function Root() {
  const [hash, setHash] = React.useState(window.location.hash);
  React.useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (hash === "#flags") return <FlagQA />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
