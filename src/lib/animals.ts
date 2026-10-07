// MeatBook animal types for whole-animal purchases.
// A butcher buys whole animals (ox/sheep/goat) by weight at a negotiated price,
// then sells the cuts by kg. This models the buying side.

export type AnimalType = "OX" | "SHEEP" | "GOAT";

export interface AnimalTypeDef {
  id: AnimalType;
  name: string;     // display name
  emoji: string;    // for UI tiles
  short: string;    // compact label
  tone: string;     // tailwind color tone key
}

export const ANIMAL_TYPES: AnimalTypeDef[] = [
  { id: "OX", name: "Ox", emoji: "🐂", short: "Ox", tone: "amber" },
  { id: "SHEEP", name: "Sheep", emoji: "🐑", short: "Sheep", tone: "sky" },
  { id: "GOAT", name: "Goat", emoji: "🐐", short: "Goat", tone: "violet" },
];

export function animalTypeDef(id?: string | null): AnimalTypeDef | null {
  if (!id) return null;
  return ANIMAL_TYPES.find((a) => a.id === id || a.name === id) ?? null;
}

export function animalName(id?: string | null): string {
  return animalTypeDef(id)?.name ?? (id || "Other");
}

export function animalEmoji(id?: string | null): string {
  return animalTypeDef(id)?.emoji ?? "🥩";
}

// tone → tailwind classes for tiles/badges
export function animalTone(id?: string | null): string {
  const t = animalTypeDef(id)?.tone;
  if (t === "amber") return "bg-amber-500/15 text-amber-400 ring-amber-500/20";
  if (t === "sky") return "bg-sky-500/15 text-sky-400 ring-sky-500/20";
  if (t === "violet") return "bg-violet-500/15 text-violet-400 ring-violet-500/20";
  return "bg-muted text-muted-foreground ring-border/40";
}
