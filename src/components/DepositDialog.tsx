import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, Zap } from "lucide-react";

const QUICK = [10, 25, 50, 100];
type Step = "choose" | "loading" | "pix" | "paid";

interface PixCharge {
  deposit_id: string;
  amount: number;
  br_code: string | null;
  qr_code_image: string | null;
  expires_at: string | null;
}

export const DepositDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [step, setStep] = useState<Step>("choose");
  const [amount, setAmount] = useState<number>(25);
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("choose"); setCharge(null); setCopied(false);
      if (pollRef.current) window.clearInterval(pollRef.current);
    }
  }, [open]);

  const startPolling = (depositId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const { data } = await supabase.from("deposits").select("status").eq("id", depositId).maybeSingle();
      if (data?.status === "paid") {
        window.clearInterval(pollRef.current!);
        setStep("paid");
        toast.success("Pagamento confirmado! Saldo creditado.");
      } else if (data?.status === "expired" || data?.status === "failed") {
        window.clearInterval(pollRef.current!);
        toast.error("Cobrança expirou ou falhou.");
        setStep("choose");
      }
    }, 3000);
  };

  const handleGenerate = async (value: number) => {
    if (value < 10) return toast.error("Valor mínimo R$ 10,00");
    setStep("loading");
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-deposit", { body: { amount: value } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCharge(data as PixCharge);
      setStep("pix");
      startPolling(data.deposit_id);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao gerar PIX");
      setStep("choose");
    }
  };

  const handleCopy = async () => {
    if (!charge?.br_code) return;
    await navigator.clipboard.writeText(charge.br_code);
    setCopied(true); toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-0 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-glow flex items-center gap-2"><Zap className="w-5 h-5" /> Depositar via PIX</DialogTitle>
          <DialogDescription>Mínimo R$10. Saldo cai automaticamente após o pagamento.</DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {QUICK.map((v) => (
                <button key={v} onClick={() => setAmount(v)} className={`glass rounded-xl py-3 text-center transition ${amount === v ? "ring-2 ring-primary" : ""}`}>
                  <p className="text-xs text-muted-foreground">R$</p>
                  <p className="text-lg font-bold">{v}</p>
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Outro valor (R$)</label>
              <Input type="number" min={10} max={5000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1" />
            </div>
            <Button onClick={() => handleGenerate(amount)} className="w-full h-12 text-base font-bold">Gerar PIX de R$ {amount.toFixed(2)}</Button>
          </div>
        )}

        {step === "loading" && (
          <div className="py-10 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Gerando cobrança PIX...</p>
          </div>
        )}

        {step === "pix" && charge && (
          <div className="space-y-4">
            {charge.qr_code_image ? (
              <img src={charge.qr_code_image.startsWith("data:") || charge.qr_code_image.startsWith("http") ? charge.qr_code_image : `data:image/png;base64,${charge.qr_code_image}`} alt="QR Code PIX" className="w-56 h-56 mx-auto rounded-xl bg-white p-2" />
            ) : (
              <div className="w-56 h-56 mx-auto rounded-xl bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">QR Code indisponível</div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">PIX Copia e Cola</label>
              <div className="flex gap-2 mt-1">
                <Input value={charge.br_code ?? ""} readOnly className="font-mono text-xs" />
                <Button onClick={handleCopy} variant="secondary" size="icon">{copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Aguardando pagamento...
            </div>
          </div>
        )}

        {step === "paid" && (
          <div className="py-8 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-[hsl(var(--safe))]" />
            <p className="text-lg font-bold">Pagamento confirmado!</p>
            <Button onClick={() => onOpenChange(false)} className="mt-2">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
