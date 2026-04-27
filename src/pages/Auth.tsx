import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LotusLogo } from "@/components/LotusLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import googleLogo from "@/assets/google-logo.png";
import metaLogo from "@/assets/meta-logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const { session, signIn, signUp, signInWithProvider } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", accountType: "client" });

  if (session) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(form.email, form.password);
        toast.success("Login realizado com sucesso");
      } else {
        await signUp(form);
        toast.success("Conta criada com sucesso");
      }
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível autenticar");
    } finally {
      setLoading(false);
    }
  };

  const handleProviderLogin = async (provider: "google" | "facebook") => {
    try {
      await signInWithProvider(provider);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar");
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6 relative">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <section className="w-full max-w-md glass rounded-3xl p-6 shadow-soft-lg">
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <div className="h-14 flex items-center justify-center">
            <LotusLogo className="h-12" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Acesse sua conta</h1>
            <p className="text-sm text-muted-foreground">Entre ou crie seu acesso na Lotus</p>
          </div>
        </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required={mode === "signup"} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de conta</Label>
                <Select value={form.accountType} onValueChange={(accountType) => setForm({ ...form, accountType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Cliente</SelectItem>
                    <SelectItem value="collaborator">Colaborador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pr-10" required minLength={6} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full rounded-2xl" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => handleProviderLogin("google")}>
                <img src={googleLogo} alt="" className="h-4 w-4 object-contain" />
                Google
              </Button>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => handleProviderLogin("facebook")}>
                <img src={metaLogo} alt="" className="h-4 w-4 object-contain" />
                Facebook
              </Button>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? "Não tem conta?" : "Já tem conta?"}{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Criar conta" : "Entrar"}
              </button>
            </p>
          </form>
      </section>
    </main>
  );
};

export default Auth;
