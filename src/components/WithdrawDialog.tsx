import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWallet, refreshWallet } from "@/hooks/useWallet";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine } from "lucide-react";

export const WithdrawDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { balance } = useWallet();
  const [amount, setAmount] = useState(20);
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState<"cpf" | "email" | "phone" | "random">("cpf");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (amount < 20) return toast.error("Saque mínimo R$ 20");
    if (amount > balance) return toast.error("Saldo insuficiente");
    if (!pixKey.trim()) return toast.error("Informe a chave Pix");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-withdrawal", {
        body: { amount_cents: Math.round(amount * 100), pix_key: pixKey.trim(), pix_key_type: pixType },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Saque solicitado! Aguarde aprovação.");
      refreshWallet();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-0 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-glow flex items-center gap-2"><ArrowDownToLine className="w-5 h-5" /> Sacar via PIX</DialogTitle>
          <DialogDescription>Saldo disponível: R$ {balance.toFixed(2)}. Mínimo R$20, máx R$5000/dia.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Valor (R$)</label>
            <Input type="number" min={20} max={5000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo da chave</label>
            <Select value={pixType} onValueChange={(v) => setPixType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="random">Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Chave PIX</label>
            <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Sua chave PIX" />
          </div>
          <Button onClick={submit} disabled={loading} className="w-full h-12 font-bold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Solicitar saque"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">Pagamento processado manualmente em até 24h.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
