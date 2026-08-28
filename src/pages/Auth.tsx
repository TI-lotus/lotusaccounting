import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
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
import coverImage from "@/assets/website-cover.jpg";

const fieldClassName =
  "h-10 rounded-2xl border-0 bg-[#f1f1f1] text-[#070f32] shadow-none placeholder:text-[#070f32]/40 focus-visible:ring-2 focus-visible:ring-[#d2b58a]/45 focus-visible:ring-offset-0 dark:bg-[#262626] dark:text-white dark:placeholder:text-white/35";

const quietButtonClassName =
  "h-10 rounded-2xl border-0 bg-[#f1f1f1] text-[#070f32] shadow-none hover:bg-white dark:bg-[#262626] dark:text-white dark:hover:bg-[#333333]";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, signIn, signUp, signInWithProvider } = useAuth();
  const inviteToken = searchParams.get("invite")?.trim() || undefined;
  const [mode, setMode] = useState<"signin" | "signup">(
    inviteToken ? "signup" : "signin",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    workspaceName: "",
  });

  if (session) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "signup" && !form.fullName.trim()) {
      toast.error("Informe seu nome completo");
      return;
    }
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
        await signUp({
          email: form.email,
          password: form.password,
          fullName: form.fullName.trim(),
          workspaceName: inviteToken
            ? undefined
            : form.workspaceName.trim() || undefined,
          accountType: inviteToken ? "client" : "admin",
          inviteToken,
        });
        toast.success(
          inviteToken
            ? "Convite aceito com sucesso"
            : "Conta criada com sucesso",
        );
      }
      navigate("/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível autenticar",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProviderLogin = async (provider: "google" | "facebook") => {
    try {
      await signInWithProvider(provider);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível continuar",
      );
    }
  };

  return (
    <main className="h-screen overflow-hidden bg-[#e7e2d9] text-[#070f32] grid lg:grid-cols-2 relative dark:bg-black dark:text-white">
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle className="bg-white/70 text-[#070f32] hover:bg-white dark:bg-white/10 dark:text-white dark:hover:bg-white/20" />
      </div>

      {/* Form pane — fixed to screen height, centered */}
      <section className="h-screen flex items-center justify-center p-4 lg:p-8 overflow-y-auto bg-[#e7e2d9] dark:bg-black">
        <div className="w-full max-w-sm rounded-3xl border-0 bg-white p-5 shadow-none dark:bg-[#0f0f0f]">
          <div className="mb-4 flex flex-col items-center gap-2.5 text-center">
            <div className="flex h-12 items-center justify-center">
              <LotusLogo
                size="lg"
                className="[&_img]:invert dark:[&_img]:invert-0"
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                {mode === "signin" ? "Acesse sua conta" : "Criar conta"}
              </h1>
              <p className="text-sm text-[#070f32]/60 dark:text-white/55">
                Entre ou crie seu acesso na Lotus
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    placeholder="Seu nome completo"
                    className={fieldClassName}
                    required
                  />
                </div>
                {!inviteToken && (
                  <div className="space-y-1.5">
                    <Label htmlFor="workspaceName">Nome do escritório</Label>
                    <Input
                      id="workspaceName"
                      value={form.workspaceName}
                      onChange={(e) =>
                        setForm({ ...form, workspaceName: e.target.value })
                      }
                      placeholder="Ex: Lotus Contabilidade"
                      className={fieldClassName}
                    />
                  </div>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={fieldClassName}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className={`${fieldClassName} pr-10`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#070f32]/55 dark:text-white/55"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm({ ...form, confirmPassword: e.target.value })
                  }
                  className={fieldClassName}
                  required
                  minLength={6}
                />
              </div>
            )}

            <Button
              type="submit"
              className={`${quietButtonClassName} w-full`}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className={quietButtonClassName}
                onClick={() => handleProviderLogin("google")}
              >
                <img
                  src={googleLogo}
                  alt=""
                  className="h-4 w-4 object-contain"
                />
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className={quietButtonClassName}
                onClick={() => handleProviderLogin("facebook")}
              >
                <img src={metaLogo} alt="" className="h-4 w-4 object-contain" />
                Facebook
              </Button>
            </div>
            <p className="text-center text-sm text-[#070f32]/60 dark:text-white/55">
              {mode === "signin" ? "Não tem conta?" : "Já tem conta?"}{" "}
              <button
                type="button"
                className="font-medium text-[#7d684b] hover:text-[#5d503a] dark:text-[#d2b58a] dark:hover:text-[#e2cba7]"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Criar conta" : "Entrar"}
              </button>
            </p>
          </form>
        </div>
      </section>

      {/* Slogan banner — website cover photo with overlay */}
      <aside
        className="hidden lg:flex h-screen items-center justify-center p-12 text-center relative overflow-hidden"
        style={{
          backgroundImage: `url(${coverImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/45" />
        <p
          className="relative text-2xl xl:text-3xl leading-snug tracking-tight max-w-md mx-auto text-white drop-shadow-lg"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Transformando números em{" "}
          <span
            className="italic"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            decisões
          </span>
        </p>
      </aside>
    </main>
  );
};

export default Auth;
