// B-061 — pipeline unifié de chargement d'un `.vviz`.
//
// Avant B-061 : chaque appelant (main.ts) faisait
//   `invoke("read_vviz")` + `JSON.parse(raw)` + assertion `as VVizDocument`.
// Ce code ne validait jamais la structure et fuyait `SyntaxError` brut.
//
// Désormais le pipeline canonique passe par `loadVViz()` :
//   1. `invoke("read_vviz")` — peut échouer en `NotFound` / `Forbidden` / `Io`
//   2. `JSON.parse` — échec ⇒ `Corrupt`
//   3. `validateVViz` (Ajv) — échec ⇒ `Invalid` + `details[]`
//   4. `doc` typé `VVizDocument`
//
// `loadVVizAndRender()` est le helper haut-niveau : si erreur, peint le
// bandeau `error-banner` (B-060) et renvoie `null` ; sinon renvoie le
// doc. Le caller n'a plus aucun `try/catch` à écrire.

import { invoke } from "@tauri-apps/api/core";
import {
  formatSchemaErrors,
  validateVViz,
} from "../utils/schema-validator";
import {
  fromVVizError,
  renderErrorBanner,
  type ErrorPayload,
} from "../components/error-banner";
import type { VVizDocument } from "./types";

export interface LoadResult {
  doc: VVizDocument | null;
  error: ErrorPayload | null;
}

/**
 * Lit et valide un fichier `.vviz`. Ne lance jamais — toute condition
 * d'échec est encodée dans `error: ErrorPayload`.
 */
export async function loadVViz(path: string): Promise<LoadResult> {
  let raw: string;
  try {
    raw = await invoke<string>("read_vviz", { path });
  } catch (err: unknown) {
    return { doc: null, error: fromVVizError(err, path) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      doc: null,
      error: {
        kind: "Corrupt",
        path,
        message: `JSON invalide : ${msg}`,
      },
    };
  }

  const errs = validateVViz(parsed);
  if (errs) {
    return {
      doc: null,
      error: {
        kind: "Invalid",
        path,
        message: `${errs.length} violation(s) du schema vviz-v1`,
        details: formatSchemaErrors(errs),
      },
    };
  }

  return { doc: parsed as VVizDocument, error: null };
}

export interface LoadAndRenderOpts {
  /** Lien Aide affiché en pied du bandeau d'erreur. */
  helpHref?: string;
  /** Rappel `onRetry` du bouton du bandeau. */
  onRetry?: () => void;
}

/**
 * Charge un `.vviz` et, en cas d'erreur, peint le bandeau dans
 * `errorMount`. Renvoie `null` si erreur, sinon le doc validé.
 */
export async function loadVVizAndRender(
  path: string,
  errorMount: HTMLElement,
  opts: LoadAndRenderOpts = {},
): Promise<VVizDocument | null> {
  const { doc, error } = await loadVViz(path);
  if (error) {
    renderErrorBanner(errorMount, error, {
      onRetry: opts.onRetry,
      helpHref: opts.helpHref,
    });
    return null;
  }
  return doc;
}
