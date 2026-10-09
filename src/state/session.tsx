"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildAnalytics } from "@/lib/analytics";
import { classifyReels, clearClassifyCache, type ClassifyProgress } from "@/lib/classify-client";
import { ImportError, applyTierCap, parseSavedPostsJson } from "@/lib/parser";
import { getPlan } from "@/lib/plans";
import { SAMPLE_EXPORT_JSON } from "@/lib/sample-export";
import type {
  AnalyticsSnapshot,
  CanonicalReel,
  ClassifiedReel,
  Entitlement,
  ImportPreview,
  PlanId,
  PublicConfig,
} from "@/lib/types";

export type AppStage =
  | "landing"
  | "reading"
  | "preview"
  | "tier"
  | "consent"
  | "checkout"
  | "processing"
  | "results";

export type ResultsView =
  | "dashboard"
  | "topics"
  | "creators"
  | "map"
  | "library"
  | "methods";

interface SessionState {
  stage: AppStage;
  config: PublicConfig | null;
  error: string | null;
  importErrorCode: string | null;
  preview: ImportPreview | null;
  reels: CanonicalReel[];
  planId: PlanId | null;
  entitlement: Entitlement | null;
  checkout: {
    status: "idle" | "starting" | "waiting" | "verifying" | "canceled" | "failed" | "test";
    sessionId: string | null;
    url: string | null;
    message: string | null;
  };
  progress: ClassifyProgress | null;
  results: ClassifiedReel[];
  view: ResultsView;
  selectedId: string | null;
  resetOpen: boolean;
  downloaded: boolean;
  mapFilter: { kind: "topic" | "creator" | "contentType"; value: string } | null;
  turnstileToken: string | null;
}

const initial: SessionState = {
  stage: "landing",
  config: null,
  error: null,
  importErrorCode: null,
  preview: null,
  reels: [],
  planId: null,
  entitlement: null,
  checkout: { status: "idle", sessionId: null, url: null, message: null },
  progress: null,
  results: [],
  view: "dashboard",
  selectedId: null,
  resetOpen: false,
  downloaded: false,
  mapFilter: null,
  turnstileToken: null,
};

interface SessionApi extends SessionState {
  analytics: AnalyticsSnapshot | null;
  loadFile: (file: File) => Promise<void>;
  loadSample: () => Promise<void>;
  continueToTiers: () => void;
  choosePlan: (id: PlanId) => void;
  giveConsent: () => Promise<void>;
  declineConsent: () => void;
  startCheckout: () => Promise<void>;
  confirmTestCheckout: () => void;
  cancelCheckout: () => void;
  verifyCheckout: (sessionId: string) => Promise<void>;
  cancelProcessing: () => void;
  retryFailed: () => Promise<void>;
  setView: (view: ResultsView) => void;
  selectReel: (id: string | null) => void;
  setMapFilter: (filter: SessionState["mapFilter"]) => void;
  setTurnstileToken: (token: string) => void;
  markDownloaded: () => void;
  askReset: () => void;
  cancelReset: () => void;
  confirmReset: () => void;
  analyzedReels: CanonicalReel[];
}

const Ctx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initial);
  const abortRef = useRef<AbortController | null>(null);
  const reelsRef = useRef<CanonicalReel[]>([]);
  const resultsRef = useRef<ClassifiedReel[]>([]);
  const entitlementRef = useRef<Entitlement | null>(null);
  const planRef = useRef<PlanId | null>(null);
  const turnstileRef = useRef<string | null>(null);

  useEffect(() => {
    reelsRef.current = state.reels;
  }, [state.reels]);
  useEffect(() => {
    resultsRef.current = state.results;
  }, [state.results]);
  useEffect(() => {
    entitlementRef.current = state.entitlement;
  }, [state.entitlement]);
  useEffect(() => {
    planRef.current = state.planId;
  }, [state.planId]);
  useEffect(() => {
    turnstileRef.current = state.turnstileToken;
  }, [state.turnstileToken]);

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((config: PublicConfig) => setState((s) => ({ ...s, config })))
      .catch(() => setState((s) => ({ ...s, error: "Could not load app configuration." })));
  }, []);

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; sessionId?: string; canceled?: boolean };
      if (data?.type === "snj-checkout" && data.sessionId) {
        void verifyCheckout(data.sessionId);
      }
      if (data?.type === "snj-checkout" && data.canceled) {
        setState((s) => ({
          ...s,
          checkout: { ...s.checkout, status: "canceled", message: "Checkout was canceled." },
        }));
      }
    };
    window.addEventListener("message", onMsg);
    const channel = new BroadcastChannel("snj-checkout");
    channel.onmessage = (event) => {
      const data = event.data as { type?: string; sessionId?: string; canceled?: boolean };
      if (data?.type === "snj-checkout" && data.sessionId) {
        void verifyCheckout(data.sessionId);
      }
      if (data?.type === "snj-checkout" && data.canceled) {
        setState((s) => ({
          ...s,
          checkout: { ...s.checkout, status: "canceled", message: "Checkout was canceled." },
        }));
      }
    };
    return () => {
      window.removeEventListener("message", onMsg);
      channel.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wipe = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearClassifyCache();
    reelsRef.current = [];
    resultsRef.current = [];
    entitlementRef.current = null;
    planRef.current = null;
    setState((s) => ({
      ...initial,
      config: s.config,
    }));
  }, []);

  const ingest = useCallback(async (text: string, name: string, bytes: number) => {
    setState((s) => ({
      ...s,
      stage: "reading",
      error: null,
      importErrorCode: null,
    }));
    await new Promise((r) => setTimeout(r, 180));
    try {
      const parsed = parseSavedPostsJson(text, name, bytes);
      setState((s) => ({
        ...s,
        stage: "preview",
        preview: parsed.preview,
        reels: parsed.reels,
      }));
    } catch (err) {
      const code = err instanceof ImportError ? err.code : "unknown";
      const message =
        err instanceof ImportError
          ? err.message
          : "The export could not be read in this browser.";
      setState((s) => ({
        ...s,
        stage: "landing",
        error: message,
        importErrorCode: code,
      }));
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".json")) {
        setState((s) => ({
          ...s,
          error: "Choose a .json file from your Instagram export.",
          importErrorCode: "not_json",
        }));
        return;
      }
      const text = await file.text();
      await ingest(text, file.name, file.size);
    },
    [ingest],
  );

  const loadSample = useCallback(async () => {
    await ingest(SAMPLE_EXPORT_JSON, "sample-saved-posts.json", SAMPLE_EXPORT_JSON.length);
  }, [ingest]);

  const continueToTiers = useCallback(() => {
    setState((s) => ({ ...s, stage: "tier" }));
  }, []);

  const choosePlan = useCallback((id: PlanId) => {
    setState((s) => ({ ...s, planId: id, stage: "consent" }));
  }, []);

  const runClassification = useCallback(async (entitlement: Entitlement, onlyFailed = false) => {
    const plan = getPlan(entitlement.planId);
    const capped = applyTierCap(reelsRef.current, plan.cap);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((s) => ({
      ...s,
      stage: "processing",
      entitlement,
      progress: {
        stage: "classifying",
        completed: 0,
        total: capped.length,
        failed: 0,
        insufficient: capped.filter((r) => !r.hasUsableText).length,
        percent: 0,
      },
    }));
    const results = await classifyReels({
      reels: capped,
      entitlement,
      signal: controller.signal,
      turnstileToken: turnstileRef.current ?? undefined,
      onlyFailedOf: onlyFailed ? resultsRef.current : undefined,
      onProgress: (progress) => setState((s) => ({ ...s, progress })),
    });
    resultsRef.current = results;
    setState((s) => ({
      ...s,
      results,
      stage: "results",
      view: "dashboard",
    }));
  }, []);

  const startCheckout = useCallback(async () => {
    const planId = planRef.current;
    if (!planId) return;
    setState((s) => ({
      ...s,
      stage: "checkout",
      checkout: { status: "starting", sessionId: null, url: null, message: null },
    }));
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          planId,
          uniqueReelCount: reelsRef.current.length,
        }),
      });
      const data = (await res.json()) as {
        kind?: string;
        url?: string;
        sessionId?: string;
        entitlement?: Entitlement;
        error?: { message: string };
        testMode?: boolean;
      };
      if (!res.ok) {
        setState((s) => ({
          ...s,
          checkout: {
            status: "failed",
            sessionId: null,
            url: null,
            message: data.error?.message ?? "Checkout could not be started.",
          },
        }));
        return;
      }
      if (data.kind === "entitlement" && data.entitlement) {
        await runClassification(data.entitlement);
        return;
      }
      if (data.kind === "test_checkout" && data.entitlement) {
        setState((s) => ({
          ...s,
          entitlement: data.entitlement ?? null,
          checkout: {
            status: "test",
            sessionId: null,
            url: null,
            message: "TEST MODE: Stripe is not configured. Simulated checkout only.",
          },
        }));
        entitlementRef.current = data.entitlement;
        return;
      }
      if (data.kind === "stripe" && data.url && data.sessionId) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        setState((s) => ({
          ...s,
          checkout: {
            status: "waiting",
            sessionId: data.sessionId ?? null,
            url: data.url ?? null,
            message: "Complete payment in the new tab. This tab keeps your file in memory.",
          },
        }));
        return;
      }
      setState((s) => ({
        ...s,
        checkout: { status: "failed", sessionId: null, url: null, message: "Unexpected checkout response." },
      }));
    } catch {
      setState((s) => ({
        ...s,
        checkout: { status: "failed", sessionId: null, url: null, message: "Checkout could not be started." },
      }));
    }
  }, [runClassification]);

  const giveConsent = useCallback(async () => {
    await startCheckout();
  }, [startCheckout]);

  const declineConsent = useCallback(() => {
    setState((s) => ({
      ...s,
      stage: "preview",
      error: "Classification was not started. Caption text is only sent to TypeSafe after you consent.",
    }));
  }, []);

  const confirmTestCheckout = useCallback(() => {
    const entitlement = entitlementRef.current;
    if (entitlement) void runClassification(entitlement);
  }, [runClassification]);

  const cancelCheckout = useCallback(() => {
    setState((s) => ({
      ...s,
      stage: "tier",
      checkout: { status: "idle", sessionId: null, url: null, message: null },
    }));
  }, []);

  const verifyCheckout = useCallback(
    async (sessionId: string) => {
      setState((s) => ({
        ...s,
        checkout: { ...s.checkout, status: "verifying", sessionId },
      }));
      try {
        const res = await fetch("/api/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json()) as {
          paid?: boolean;
          entitlement?: Entitlement;
          error?: { message: string };
        };
        if (!res.ok || !data.paid || !data.entitlement) {
          setState((s) => ({
            ...s,
            checkout: {
              status: "failed",
              sessionId,
              url: s.checkout.url,
              message: data.error?.message ?? "Payment could not be verified. The file is still in this tab.",
            },
          }));
          return;
        }
        await runClassification(data.entitlement);
      } catch {
        setState((s) => ({
          ...s,
          checkout: {
            status: "failed",
            sessionId,
            url: s.checkout.url,
            message: "Payment could not be verified.",
          },
        }));
      }
    },
    [runClassification],
  );

  const cancelProcessing = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retryFailed = useCallback(async () => {
    const entitlement = entitlementRef.current;
    if (entitlement) await runClassification(entitlement, true);
  }, [runClassification]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (state.stage === "landing") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [state.stage]);

  const analyzedReels = useMemo(() => {
    if (!state.planId) return state.reels;
    return applyTierCap(state.reels, getPlan(state.planId).cap);
  }, [state.reels, state.planId]);

  const analytics = useMemo(
    () => (state.results.length ? buildAnalytics(state.results) : null),
    [state.results],
  );

  const api: SessionApi = {
    ...state,
    analytics,
    analyzedReels,
    loadFile,
    loadSample,
    continueToTiers,
    choosePlan,
    giveConsent,
    declineConsent,
    startCheckout,
    confirmTestCheckout,
    cancelCheckout,
    verifyCheckout,
    cancelProcessing,
    retryFailed,
    setView: (view) => setState((s) => ({ ...s, view })),
    selectReel: (id) => setState((s) => ({ ...s, selectedId: id })),
    setMapFilter: (mapFilter) =>
      setState((s) => ({ ...s, mapFilter, view: mapFilter ? "library" : s.view })),
    setTurnstileToken: (token) => setState((s) => ({ ...s, turnstileToken: token })),
    markDownloaded: () => setState((s) => ({ ...s, downloaded: true })),
    askReset: () => setState((s) => ({ ...s, resetOpen: true })),
    cancelReset: () => setState((s) => ({ ...s, resetOpen: false })),
    confirmReset: wipe,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
