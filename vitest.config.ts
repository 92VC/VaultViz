import { defineConfig } from "vitest/config";

// Configuration vitest minimale pour le viz-engine VaultViz.
// - `happy-dom` plutôt que jsdom : 2-3× plus rapide, suffisant pour les
//   tests d'aller-retour Arrow IPC qui n'utilisent pas d'API DOM avancée.
// - `globals: false` : on importe explicitement `describe / it / expect`
//   depuis "vitest" pour rester compatible avec un mode `--isolate` plus
//   strict en CI (B-071).
// - Filtre `include` ciblé : pas de scan involontaire des fixtures ou des
//   sources Rust.
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: false,
    include: ["src/__tests__/**/*.test.ts"],
  },
});
