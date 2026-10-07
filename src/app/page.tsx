"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";

// Auto-reload on stale chunk/HMR errors. When the dev server recompiles, old
// chunks become invalid and Turbopack HMR can leave the browser with a
// partially-updated module (e.g. JSX references a function that didn't
// hot-reload in → ReferenceError). We catch these and reload once.
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
    const isErrorRecoverable = (msg: string) =>
      msg.includes("Loading chunk") ||
      msg.includes("ChunkLoadError") ||
      msg.includes("Failed to fetch dynamically imported module") ||
      // stale HMR: a component function referenced in JSX is undefined
      /is not defined$/i.test(msg) ||
      msg.includes("Minified React error #130");

    const onChunkError = (e: ErrorEvent) => {
      const msg = e.message || "";
      if (isErrorRecoverable(msg)) tryReload();
    };
    window.addEventListener("error", onChunkError);
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = String(e.reason || "");
      if (isErrorRecoverable(reason)) tryReload();
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
