import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import { SupabaseApp } from "./supabase-app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SupabaseApp />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}service-worker.js`,
    );
  });
}
