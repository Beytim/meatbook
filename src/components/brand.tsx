"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// MeatBook brand logo mark
export function MeatLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8", className)} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.22 25)" />
          <stop offset="1" stopColor="oklch(0.45 0.18 25)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" className="fill-card stroke-border" strokeWidth="1" />
      <path
        d="M16 22c0-6 5-10 11-9 7 1 11 5 11 11 0 4-2 7-5 9-1 3-4 5-8 5-5 0-9-3-9-8 0-3 0-5 0-8Z"
        fill="url(#mbg)"
      />
      <circle cx="34" cy="30" r="3.5" className="fill-background" />
      <path d="M40 40c4 2 8 0 8 4 0 4-4 4-6 2-2 2-6 2-6-2 0-2 2-4 4-4Z" className="fill-bone" />
    </svg>
  );
}

export function BrandMark({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-11 w-11" : size === "md" ? "h-9 w-9" : "h-8 w-8";
  const text = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-base";
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("grid place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/20", dim)}>
        <MeatLogo className={cn(dim === "h-11 w-11" ? "h-7 w-7" : "h-5 w-5")} />
      </div>
      <div className="leading-none">
        <div className={cn("font-bold tracking-tight", text)}>
          Meat<span className="text-primary">Book</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Digital Butcher&apos;s Book</div>
      </div>
    </div>
  );
}
