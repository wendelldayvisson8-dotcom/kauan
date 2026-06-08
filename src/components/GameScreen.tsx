import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Snowflake, TrendingUp, Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { refreshWallet } from "@/hooks/useWallet";
import penguin from "@/assets/penguin.png";

type Phase = "playing" | "won" | "lost";

interface RowVisual {
  picked: 0 | 1 | null;
  revealed: boolean;
  safeIndex: 0 | 1 | null;
}

interface Props {
  bet: number;
  roundId: string;
  rows: { multiplier: number }[];
  onExit: () => void;
}

export const GameScreen = ({ bet, roundId, rows: rowMultipliers, onExit }: Props) => {
  const [rows, setRows] = useState<RowVisual[]>(() =>
    rowMultipliers.map(() => ({ picked: null, revealed: false, safeIndex: null }))
  );
  const [currentRow, setCurrentRow] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [revealing, setRevealing] = useState(false);
  const [penguinPos, setPenguinPos] = useState<{ row: number; col: 0 | 1 }>({ row: -1, col: 0 });
  const [jumping, setJumping] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const lockedBetRef = useRef(bet);

  const cleared = currentRow;
  const potential = useMemo(() => +(lockedBetRef.current * multiplier).toFixed(2), [multiplier]);

  const pick = async (idx: 0 | 1) => {
    if (phase !== "playing" || revealing) return;
    setRevealing(true);
    setJumping(true);
    setPenguinPos({ row: currentRow, col: idx });

    try {
      const { data, error } = await supabase.functions.invoke("play-step", {
        body: { round_id: roundId, pick: idx },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      setTimeout(() => {
        setRows((prev) => {
          const next = [...prev];
          next[currentRow] = { picked: idx, revealed: true, safeIndex: data.safe_index };
          return next;
        });
        setJumping(false);

        if (data.safe) {
          setMultiplier(Number(data.current_multiplier));
          if (data.finished) {
            // auto-cashout no topo
            void doCashout();
          } else {
            setCurrentRow((r) => r + 1);
          }
        } else {
          toast.error(`💥 Quebrou! -R$ ${lockedBetRef.current.toFixed(2)}`);
          setPhase("lost");
          refreshWallet();
        }
        setRevealing(false);
      }, 550);
    } catch (e) {
      setJumping(false);
      setRevealing(false);
      toast.error((e as Error).message || "Falha de conexão");
    }
  };

  const doCashout = async () => {
    if (revealing || cleared === 0) return;
    setRevealing(true);
    try {
      const { data, error } = await supabase.functions.invoke("play-cashout", {
        body: { round_id: roundId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`💎 Sacou R$ ${(data.payout_cents / 100).toFixed(2)}`);
      setPhase("won");
      refreshWallet();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRevealing(false);
    }
  };

  useEffect(() => {
    if (phase === "won" || phase === "lost") {
      const t = setTimeout(onExit, 2000);
      return () => clearTimeout(t);
    }
  }, [phase, onExit]);

  return (
    <div className="fixed inset-0 z-50 animate-fade-in flex flex-col" style={{ background: "var(--gradient-bg)" }}>
      <div className="w-full max-w-md mx-auto flex flex-col flex-1 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button onClick={onExit} className="glass w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform" aria-label="Sair">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="glass-strong px-3 py-1.5 rounded-xl text-center flex-1">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 justify-center"><Coins className="w-3 h-3" /> Aposta</p>
            <p className="text-sm font-bold leading-tight">R$ {lockedBetRef.current.toFixed(2)}</p>
          </div>
          <div className="glass-strong px-3 py-1.5 rounded-xl text-center flex-1">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 justify-center"><TrendingUp className="w-3 h-3" /> Multi</p>
            <p className="text-base font-bold text-glow leading-tight">{multiplier.toFixed(2)}x</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col justify-end">
          <div className="flex flex-col-reverse gap-1.5 pb-2">
            <div className="grid grid-cols-[32px_1fr_1fr] items-center gap-2">
              <div />
              <div className="col-span-2 glass-strong h-10 rounded-2xl relative flex items-center justify-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Plataforma</p>
                {penguinPos.row === -1 && <PenguinSprite jumping={jumping} idle />}
              </div>
            </div>

            {rowMultipliers.map((cfg, rowIdx) => {
              const row = rows[rowIdx];
              const isActive = phase === "playing" && rowIdx === currentRow;
              const isPast = rowIdx < currentRow;
              return (
                <div key={rowIdx} className="grid grid-cols-[32px_1fr_1fr] items-center gap-2">
                  <div className="text-right pr-0.5">
                    <p className="text-[9px] text-muted-foreground leading-none">L{rowIdx + 1}</p>
                    <p className="text-[11px] font-bold text-primary-glow leading-tight">{cfg.multiplier}x</p>
                  </div>
                  {[0, 1].map((i) => {
                    const ii = i as 0 | 1;
                    const revealed = row?.revealed;
                    const isSafe = revealed && row?.safeIndex === ii;
                    const isBroken = revealed && row?.safeIndex !== ii;
                    const clickable = isActive && !revealing;
                    const penguinHere = penguinPos.row === rowIdx && penguinPos.col === ii;
                    return (
                      <button
                        key={i}
                        disabled={!clickable}
                        onClick={() => pick(ii)}
                        className={[
                          "ice-block relative h-14 sm:h-16 rounded-2xl flex items-center justify-center select-none touch-manipulation",
                          isSafe ? "safe" : "",
                          isBroken ? "broken animate-shake" : "",
                          isActive && !revealed ? "animate-pulse-glow" : "",
                          !isActive && !revealed && !isPast ? "opacity-30" : "",
                          clickable ? "active:scale-[0.97]" : "",
                        ].join(" ")}
                      >
                        {isSafe && !penguinHere && <Snowflake className="w-5 h-5 text-success" />}
                        {isBroken && <span className="text-2xl">💥</span>}
                        {penguinHere && <PenguinSprite jumping={jumping} />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          <button
            onClick={doCashout}
            disabled={phase !== "playing" || cleared === 0 || revealing}
            className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--gradient-safe)", border: "1px solid hsl(160 84% 60% / 0.6)", boxShadow: "var(--shadow-glow)" }}
          >
            {revealing ? <Loader2 className="w-4 h-4 animate-spin" /> : "💰"} SACAR R$ {potential.toFixed(2)}
          </button>
          <p className="text-center text-[11px] text-muted-foreground mt-1.5 h-4">
            {phase === "playing" && "Toque num bloco para o pinguim pular"}
            {phase === "won" && <span className="text-success font-bold">🎉 Vitória!</span>}
            {phase === "lost" && <span className="text-destructive font-bold">❄️ Tente novamente…</span>}
          </p>
        </div>
      </div>
    </div>
  );
};

const PenguinSprite = ({ jumping, idle }: { jumping: boolean; idle?: boolean }) => (
  <img
    src={penguin}
    alt=""
    aria-hidden
    className={["absolute left-1/2 -translate-x-1/2 bottom-1 w-11 h-11 sm:w-12 sm:h-12 object-contain pointer-events-none z-20", jumping ? "animate-penguin-hop" : idle ? "animate-pengu-idle" : ""].join(" ")}
    style={{ filter: "drop-shadow(0 6px 10px hsl(195 100% 60% / 0.55))" }}
  />
);
