import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Remove StrictMode for smoother game performance (avoids double renders)
createRoot(document.getElementById("root")!).render(<App />);
