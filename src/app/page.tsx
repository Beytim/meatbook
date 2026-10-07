"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";

// Auto-reload ONLY on actual stale-chunk failures (when the dev server
// recompiles and old chunk URLs become invalid). We do NOT reload on
// runtime ReferenceErrors from view code — those should surface as real
// errors, not silently bounce the user back to Home.
function useChunkErrorRecovery() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const tryReload = () => {
      const key = "mb-chunk-reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      } else {
        sessionStorage.removeItem(key);
      }
    };
    // Only recover from chunk-loading failures, NOT from runtime code errors.
    const isChunkLoadFailure = (msg: string) =>
      msg.includes("Loading chunk") ||
      msg.includes("ChunkLoadError") ||
      msg.includes("Failed to fetch dynamically imported module");

    const onChunkError = (e: ErrorEvent) => {
      const msg = e.message || "";
      if (isChunkLoadFailure(msg)) tryReload();
    };
    window.addEventListener("error", onChunkError);
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = String(e.reason || "");
      if (isChunkLoadFailure(reason)) tryReload();
    };
    window.addEventListener("unhandledrejection", onRejection);
    sessionStorage.removeItem("mb-chunk-reload");
    return () => {
      window.removeEventListener("error", onChunkError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}

export default function Page() {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useChunkErrorRecovery();

  return (
    <QueryClientProvider client={client}>
      <AppShell />
    </QueryClientProvider>
  );
}
