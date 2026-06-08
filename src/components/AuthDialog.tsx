import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, Mail, Lock, ShieldCheck, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import iceStepLogo from "@/assets/ice-step-logo.png";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthed?: () => void;
}

export const AuthDialog = ({ open, onOpenChange, onAuthed }: Props) => {
  const [tab, setTab] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Preencha e-mail e senha");
    if (tab === "register") {
      if (password.length < 6) return toast.error("Senha deve ter ao menos 6 caracteres");
      if (password !== confirm) return toast.error("As senhas não coincidem");
      if (!agree) return toast.error("Você precisa aceitar os termos");
    }
    setLoading(true);
    try {
      if (tab === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada com sucesso!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      }
      onAuthed?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 border-0 overflow-hidden rounded-3xl"
        style={{
          background:
            "linear-gradient(165deg, hsl(220 75% 12%) 0%, hsl(215 70% 18%) 60%, hsl(210 80% 14%) 100%)",
          boxShadow: "0 25px 80px -20px hsl(195 100% 50% / 0.35), 0 0 0 1px hsl(195 100% 70% / 0.12) inset",
        }}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Acesso ao ICE STEP</DialogTitle>
        <DialogDescription className="sr-only">Faça login ou crie uma conta para jogar.</DialogDescription>

        {/* Brand banner */}
        <div
          className="relative px-6 pt-7 pb-5 border-b border-white/10 overflow-hidden"
          style={{
            background:
              "radial-gradient(circle at 20% 0%, hsl(195 100% 55% / 0.35), transparent 60%), radial-gradient(circle at 100% 100%, hsl(220 90% 40% / 0.4), transparent 55%)",
          }}
        >
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-14 h-14 rounded-2xl overflow-hidden ring-1 ring-white/20 shadow-[0_8px_30px_rgba(0,200,255,0.45)] shrink-0 bg-white/5 backdrop-blur">
              <img src={iceStepLogo} alt="ICE STEP" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold text-white tracking-tight leading-none">ICE STEP</h2>
              <p className="text-[11px] text-white/70 mt-1.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[hsl(160_84%_60%)]" />
                Plataforma 100% segura • Saques via PIX
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex relative pt-5 px-6">
          <button
            type="button"
            onClick={() => setTab("register")}
            className={`flex-1 flex items-center justify-center gap-2 pb-3 text-sm font-semibold transition ${
              tab === "register" ? "text-white" : "text-white/45"
            }`}
          >
            <UserPlus className="w-4 h-4" /> Registro
          </button>
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`flex-1 flex items-center justify-center gap-2 pb-3 text-sm font-semibold transition ${
              tab === "login" ? "text-white" : "text-white/45"
            }`}
          >
            <LogIn className="w-4 h-4" /> Login
          </button>
          <div
            className="absolute bottom-0 h-0.5 rounded-full bg-gradient-to-r from-[hsl(195_100%_60%)] to-[hsl(220_100%_70%)] transition-all duration-300"
            style={{
              width: "calc(50% - 1.5rem)",
              left: tab === "register" ? "1.5rem" : "calc(50%)",
            }}
          />
          <div className="absolute bottom-0 left-6 right-6 h-px bg-white/10" />
        </div>


        <form onSubmit={submit} className="px-6 pb-6 pt-5 space-y-4">
          {tab === "register" && (
            <p className="text-white/80 text-sm">Crie sua conta para começar a jogar</p>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            <Input
              type="email"
              placeholder="* Digite seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-10 bg-transparent border-white/30 text-white placeholder:text-white/50 rounded-xl focus-visible:ring-white/40"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            <Input
              type="password"
              placeholder="* Inserir senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pl-10 bg-transparent border-white/30 text-white placeholder:text-white/50 rounded-xl focus-visible:ring-white/40"
            />
          </div>

          {tab === "register" && (
            <>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                <Input
                  type="password"
                  placeholder="* Confirme sua senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-12 pl-10 bg-transparent border-white/30 text-white placeholder:text-white/50 rounded-xl focus-visible:ring-white/40"
                />
              </div>

              <label className="flex items-start gap-2 text-white/90 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-success"
                />
                <span>
                  Tenho +18 anos, li e concordo com os Termos de Uso
                </span>
              </label>
            </>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl font-bold text-base text-[hsl(220_80%_15%)] shadow-[0_10px_30px_-10px_hsl(195_100%_55%/0.6)] transition-transform active:scale-[0.98]"
            style={{
              background:
                "linear-gradient(135deg, hsl(195 100% 75%), hsl(50 95% 85%))",
            }}
          >
            {loading ? "Aguarde..." : tab === "register" ? "Criar conta grátis" : "Entrar"}
          </Button>

          <button
            type="button"
            onClick={() => setTab(tab === "register" ? "login" : "register")}
            className="w-full text-center text-white/75 text-sm hover:text-white"
          >
            {tab === "register" ? "Já tem conta? Faça login" : "Não tem conta? Cadastre-se"}
          </button>

          <div className="flex items-center justify-center gap-4 pt-2 text-[10px] text-white/55">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> SSL 256-bit</span>
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Anti-fraude</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Saque rápido</span>
          </div>
        </form>

      </DialogContent>
    </Dialog>
  );
};
