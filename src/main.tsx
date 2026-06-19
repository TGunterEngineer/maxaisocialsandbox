import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global handlers for uncaught errors (outside React tree)
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    // eslint-disable-next-line no-console
    console.error("[GlobalError]", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      col: event.colno,
      error: event.error,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    // eslint-disable-next-line no-console
    console.error("[UnhandledRejection]", event.reason);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
