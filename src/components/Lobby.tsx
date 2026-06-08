import { Play, Wallet, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/hooks/useWallet";
import logo from "@/assets/logo.png";
import penguin from "@/assets/penguin.png";

// Tabela visual de multiplicadores (RTP 92%) — fonte da verdade está no servidor.
const ROW_PREVIEW = [
  { safeProbability: 0.9, multiplier: 1.02 },
  { safeProbability: 0.8, multiplier: 1.17 },
  { safeProbability: 0.7, multiplier: 1.54 },
  { safeProbability: 0.6, multiplier: 2.36 },
  { safeProbability: 0.5, multiplier: 4.35 },
  { safeProbability: 0.4, multiplier: 10.02 },
  { safeProbability: 0.3, multiplier: 30.74 },
  { safeProbability: 0.2, multiplier: 141.43 },
];

interface Props {
  bet: number;
  setBet: (n: number) => void;
  onStart: () => void;
  starting?: boolean;
}

export const Lobby = ({ bet, setBet, onStart, starting }: Props) => {
  const { balance } = useWallet();
  const canStart = bet > 0 && balance >= bet && !starting;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      {/* Hero */}
      <div className="glass-strong rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 30%, hsl(195 100% 60% / 0.5), transparent 60%)",
          }}
        />
        <img
          src={logo}
          alt="ICE STEP logo com pinguim mascote"
          width={420}
          height={420}
          className="w-56 sm:w-64 h-auto relative z-10 drop-shadow-[0_8px_30px_rgba(0,200,255,0.35)]"
        />
        <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-glow tracking-tight">
          Ajude o pinguim a subir
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mt-2">
          Escolha o bloco de gelo certo. A cada acerto o multiplicador cresce.
          Saque antes do gelo quebrar.
        </p>

        <button
          onClick={onStart}
          disabled={!canStart}
          className="mt-6 w-full max-w-sm h-14 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed glass-strong animate-pulse-glow"
        >
          {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />} JOGAR — R$ {bet.toFixed(2)}
        </button>
        {!canStart && balance < bet && (
          <p className="text-xs text-destructive mt-2">Saldo insuficiente. Faça um depósito.</p>
        )}
      </div>

      {/* Side */}
      <aside className="space-y-4">
        <div className="glass rounded-3xl p-5">
          <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5" /> Valor da aposta
          </label>
          <Input
            type="number"
            min={1}
            step={1}
            value={bet}
            onChange={(e) => setBet(Math.max(0, Number(e.target.value) || 0))}
            className="mt-2 bg-transparent border-white/10 text-2xl font-bold h-14"
          />
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[1, 5, 10, 25].map((v) => (
              <button
                key={v}
                onClick={() => setBet(v)}
                className="glass rounded-xl py-2 text-sm font-semibold hover:scale-[1.05] transition-transform"
              >
                R${v}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => setBet(+(bet / 2).toFixed(2))}
              className="glass rounded-xl py-2 text-sm font-semibold"
            >½</button>
            <button
              onClick={() => setBet(+(bet * 2).toFixed(2))}
              className="glass rounded-xl py-2 text-sm font-semibold"
            >2×</button>
          </div>
        </div>

        <div className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Progressão</p>
            <img src={penguin} alt="" width={28} height={28} className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            {ROW_PREVIEW.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Linha {i + 1}</span>
                <span className="text-foreground/80">
                  {Math.round(r.safeProbability * 100)}% •{" "}
                  <span className="text-primary-glow font-bold">{r.multiplier}x</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};
