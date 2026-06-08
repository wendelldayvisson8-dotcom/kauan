// Game logic separated from UI

export interface RowConfig {
  safeProbability: number; // 0-1
  multiplier: number;
}

// Default RTP-tunable progression
export const DEFAULT_ROWS: RowConfig[] = [
  { safeProbability: 0.9, multiplier: 1.1 },
  { safeProbability: 0.8, multiplier: 1.3 },
  { safeProbability: 0.7, multiplier: 1.6 },
  { safeProbability: 0.6, multiplier: 2.0 },
  { safeProbability: 0.5, multiplier: 3.0 },
  { safeProbability: 0.4, multiplier: 4.5 },
  { safeProbability: 0.3, multiplier: 7.0 },
  { safeProbability: 0.2, multiplier: 12.0 },
];

export type BlockState = "hidden" | "safe" | "broken";

export interface RowState {
  safeIndex: 0 | 1;
  picked: 0 | 1 | null;
  revealed: boolean;
}

export function generateRows(rows: RowConfig[]): RowState[] {
  return rows.map((r) => ({
    // Position is random, but probability of "safe being picked" matches r.safeProbability
    // We'll use safeProbability when computing pick outcome — position is purely visual
    safeIndex: Math.random() < 0.5 ? 0 : 1,
    picked: null,
    revealed: false,
  }));
}

export function isSafePick(prob: number): boolean {
  return Math.random() < prob;
}

export function currentMultiplier(rows: RowConfig[], rowsCleared: number): number {
  if (rowsCleared <= 0) return 1;
  return rows[Math.min(rowsCleared, rows.length) - 1].multiplier;
}
