// Configuração de RTP e limites — fonte da verdade no servidor.
// RTP alvo: 92% (margem de casa = 8% por passo).
// EV(continuar) = safeProb * (mult_proximo / mult_atual) = 0.92
// => mult_proximo = mult_atual * 0.92 / safeProb
export const RTP = 0.92;

export interface RowConfig {
  safeProbability: number;
  multiplier: number;
}

// Multiplicadores cumulativos do passo i (depois de cumprir o passo).
// Calculados para devolver 92% de RTP por passo.
export const ROWS: RowConfig[] = [
  { safeProbability: 0.9, multiplier: 1.02 },
  { safeProbability: 0.8, multiplier: 1.17 },
  { safeProbability: 0.7, multiplier: 1.54 },
  { safeProbability: 0.6, multiplier: 2.36 },
  { safeProbability: 0.5, multiplier: 4.35 },
  { safeProbability: 0.4, multiplier: 10.02 },
  { safeProbability: 0.3, multiplier: 30.74 },
  { safeProbability: 0.2, multiplier: 141.43 },
];

// Limites antifraude (em centavos)
export const LIMITS = {
  bet: { min: 100, max: 50000 },           // R$1 — R$500
  deposit: { min: 1000, max: 500000, dailyMax: 1000000 },   // R$10 — R$5000, diário R$10k
  withdraw: { min: 2000, max: 500000, dailyMax: 500000 },   // R$20 — R$5000, diário R$5k
};

// RNG criptográfica
export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0xffffffff;
}
