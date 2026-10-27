import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../../packages/ui/App";
import "../../../packages/ui/style.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App extension popup={location.pathname.includes("popup")} />
  </React.StrictMode>,
);
