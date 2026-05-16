import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./app/App";
import { installGlobalHandlers } from "./lib/debugLog";
import "./styles/theme.css";

installGlobalHandlers();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster richColors position="top-center" />
  </React.StrictMode>
);
