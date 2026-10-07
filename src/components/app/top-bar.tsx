"use client";

import * as React from "react";
import { BrandMark } from "@/components/brand";
import { useNav } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";
import { useLang } from "@/components/lang-provider";

export function TopBar() {
  const view = useNav((s) => s.view);
  const { lang, setLang, t } = useLang();
  const [now, setNow] = React.useState<string>("");

  React.useEffect(() => {
    const fmt = () =>
      new Date().toLocaleDateString(lang === "am" ? "am-ET" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    setNow(fmt());
  }, [lang]);

  const sub = view === "HOME" ? `${t("home.todaysSales")} · ${now}` : undefined;

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur-xl pt-safe">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-2.5">
        <BrandMark size="sm" />
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "am" : "en")}
            className="grid h-9 min-w-9 place-items-center rounded-full bg-muted/60 px-2 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground tap-scale"
            aria-label="Toggle language"
            title={lang === "en" ? "Switch to Amharic" : "Switch to English"}
          >
            {lang === "en" ? "አማ" : "EN"}
          </button>
          <button
            className="grid h-9 w-9 place-items-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground tap-scale"
            aria-label="Lock"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </button>
          <div className="flex items-center gap-2 rounded-full bg-card/80 pl-1 pr-2.5 py-1 ring-1 ring-border/60">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-[11px] font-bold text-primary">
              {initials("Abebe Owner")}
            </div>
            <div className="leading-none">
              <div className="text-[11px] font-semibold">Abebe Owner</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Owner</div>
            </div>
          </div>
        </div>
      </div>
      {sub && (
        <div className="mx-auto w-full max-w-2xl px-4 pb-2 text-[11px] text-muted-foreground">{sub}</div>
      )}
    </header>
  );
}
