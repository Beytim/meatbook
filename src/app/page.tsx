"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";

// Auto-reload on stale chunk errors. When the dev server recompiles, old chunk
// URLs become invalid and the browser throws ChunkLoadError. We catch it and
// reload the page once so the user gets the fresh chunks automatically.
function useChunkErrorRecovery() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onChunkError = (e: ErrorEvent) => {
      const msg = e.message || "";
      if (
        msg.includes("Loading chunk") ||
        msg.includes("ChunkLoadError") ||
        msg.includes("Failed to fetch dynamically imported module")
      ) {
        // reload once — guard with sessionStorage so we don't loop
        const key = "mb-chunk-reload";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
        } else {
          sessionStorage.removeItem(key);
        }
      }
    };
    window.addEventListener("error", onChunkError);
    // also catch unhandledrejection (dynamic import() rejects as a promise)
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = String(e.reason || "");
      if (
        reason.includes("Loading chunk") ||
        reason.includes("ChunkLoadError") ||
        reason.includes("Failed to fetch dynamically imported module")
      ) {
        const key = "mb-chunk-reload";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
        } else {
          sessionStorage.removeItem(key);
        }
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    // clear the reload guard once we're mounted successfully
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
