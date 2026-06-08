import { Wallet, WalletCards, ShieldCheck } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import iceStepLogo from "@/assets/ice-step-logo.png";

export const WalletHeader = ({ onDepositClick, onWithdrawClick }: { onDepositClick: () => void; onWithdrawClick: () => void }) => {
  const { balance, locked } = useWallet();
  return (
    <header className="w-full mb-6">
      {/* Top row: logo + brand + saldo */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-white/10 shadow-[0_8px_30px_rgba(0,200,255,0.35)]">
            <img src={iceStepLogo} alt="ICE STEP" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-glow leading-none">ICE STEP</h1>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-primary-glow" />
              Pagamentos seguros via PIX
            </p>
          </div>
        </div>

        <div className="glass-strong px-3 py-2 rounded-2xl text-right shrink-0">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground leading-none">Saldo</p>
          <p className="text-base sm:text-lg font-bold text-glow leading-tight mt-1 whitespace-nowrap">R$ {balance.toFixed(2)}</p>
          {locked > 0 && <p className="text-[10px] text-primary-glow leading-none">Em jogo: R$ {locked.toFixed(2)}</p>}
        </div>
      </div>

      {/* Action row */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onDepositClick}
          className="glass-strong h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.98] transition-transform"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <Wallet className="w-4 h-4" /> Depositar
        </button>
        <button
          onClick={onWithdrawClick}
          className="glass h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.98] transition-transform"
        >
          <WalletCards className="w-4 h-4" /> Sacar
        </button>
      </div>
    </header>
  );
};
