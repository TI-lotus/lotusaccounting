import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", fullName: "" });

  if (session) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "signup" && form.password !== form.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(form.email, form.password);
        toast.success("Login realizado com sucesso");
      } else {
        await signUp({ email: form.email, password: form.password, fullName: form.fullName, accountType: "client" });
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
    <main className="h-screen overflow-hidden bg-background grid lg:grid-cols-2 relative">
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>

      {/* Form pane — fixed to screen height, centered */}
      <section className="h-screen flex items-center justify-center p-6 lg:p-10 overflow-y-auto">
        <div className="w-full max-w-md glass rounded-3xl p-6 shadow-soft-lg">
          <div className="flex flex-col items-center text-center gap-3 mb-6">
            <div className="h-14 flex items-center justify-center">
              <LotusLogo className="h-12" iconOnly />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{mode === "signin" ? "Acesse sua conta" : "Criar conta"}</h1>
              <p className="text-sm text-muted-foreground">Entre ou crie seu acesso na Lotus</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
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

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input id="confirmPassword" type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required minLength={6} />
              </div>
            )}

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
        </div>
      </section>

      {/* Slogan banner — desk photo with overlay */}
      <aside
        className="hidden lg:flex h-screen items-center justify-center p-12 text-center relative overflow-hidden"
        style={{
          backgroundImage: `url(${deskImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/55" />
        <p
          className="relative text-2xl xl:text-3xl leading-snug tracking-tight max-w-md mx-auto text-white drop-shadow-lg"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Transformando números em <span className="italic" style={{ fontFamily: "'Playfair Display', serif" }}>decisões</span>
        </p>
      </aside>
    </main>
  );
};

export default Auth;
