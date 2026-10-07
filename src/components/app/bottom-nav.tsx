"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useNav, activePrimary, type ViewId } from "@/lib/nav";
import { useLang } from "@/components/lang-provider";

const Icon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
      <path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" />
    </svg>
  ),
  sell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
      <circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
    </svg>
  ),
  products: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
      <path d="m7.5 4.5 9 5v9l-9-5z" /><path d="M7.5 4.5 3 7v9l4.5 2.5" /><path d="M16.5 9.5 21 12v5l-4.5 2.5" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 12h.01M18 12h.01" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
      <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
    </svg>
  ),
};

const TABS: { id: ViewId; labelKey: string; icon: React.ReactNode }[] = [
  { id: "HOME", labelKey: "nav.home", icon: Icon.home },
  { id: "SELL", labelKey: "nav.sell", icon: Icon.sell },
  { id: "PRODUCTS", labelKey: "nav.products", icon: Icon.products },
  { id: "MONEY", labelKey: "nav.money", icon: Icon.money },
  { id: "MORE", labelKey: "nav.more", icon: Icon.more },
];

export function BottomNav({ onMore }: { onMore: () => void }) {
  const view = useNav((s) => s.view);
  const go = useNav((s) => s.go);
  const { t } = useLang();
  const active = activePrimary(view);

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-safe">
      <div className="pointer-events-auto mx-2 mb-2 flex w-full max-w-md items-center justify-around rounded-2xl border border-border/70 bg-card/85 px-1.5 py-1.5 shadow-2xl backdrop-blur-xl card-raised">
        {TABS.map((tab) => {
          const isActive = tab.id === "MORE" ? false : active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => (tab.id === "MORE" ? onMore() : go(tab.id))}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 tap-scale",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute -top-0.5 h-1 w-7 rounded-full bg-primary" />
              )}
              {tab.id === "SELL" ? (
                <span className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl transition-colors",
                  isActive ? "bg-primary text-primary-foreground meat-glow" : "bg-primary/15 text-primary"
                )}>
                  {tab.icon}
                </span>
              ) : (
                tab.icon
              )}
              <span className="text-[10px] font-semibold tracking-wide">{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
