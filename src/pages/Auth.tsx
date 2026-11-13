import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
  const { session, mfaRequired, signIn, signUp, signInWithProvider, refreshMfaState, refreshProfile } = useAuth();
  const inviteToken = searchParams.get("invite")?.trim() || undefined;
  const isPasswordReset = searchParams.get("reset") === "1";
  const isClientAccess = searchParams.get("client") === "1";
  const isLoggedOut = searchParams.get("logged_out") === "1";
  const [mode, setMode] = useState<"signin" | "signup" | "client-signup" | "recovery" | "reset" | "mfa">(
    searchParams.get("mfa") === "1" ? "mfa" : inviteToken ? "signup" : isPasswordReset ? "reset" : isClientAccess ? "client-signup" : "signin",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    workspaceName: "",
    cnpj: "",
  });

  useEffect(() => {
    setMode(searchParams.get("mfa") === "1" ? "mfa" : inviteToken ? "signup" : isPasswordReset ? "reset" : isClientAccess ? "client-signup" : "signin");
  }, [inviteToken, isClientAccess, isPasswordReset, searchParams]);

  useEffect(() => {
    if (session && mfaRequired) setMode("mfa");
  }, [mfaRequired, session]);

  if (session && !mfaRequired && mode !== "reset" && mode !== "client-signup") return <Navigate to="/" replace />;

  if (isLoggedOut && !session && mode === "signin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f1724] px-5 py-10 text-white">
        <div className="w-full max-w-md text-center">
          <div className="mb-8 flex justify-center">
            <LotusLogo size="lg" />
          </div>
          <section className="rounded-[24px] border border-white/10 bg-white/[0.06] p-8">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-black">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <h1 className="mt-6 text-3xl font-normal tracking-tight">Até a próxima.</h1>
            <p className="mt-3 text-sm leading-6 text-white/60">
              Seu espaço de trabalho foi fechado com segurança. Seus dados continuam protegidos.
            </p>
            <Button className="mt-7 w-full bg-white text-black hover:bg-white/90" onClick={() => navigate("/auth")}>
              Voltar ao login <ArrowRight className="h-4 w-4" />
            </Button>
            <small className="mt-6 block text-[11px] leading-5 text-white/40">
              Lotus Accounting · sessão encerrada
            </small>
          </section>
        </div>
      </main>
    );
  }

  const isSignupMode = mode === "signup" || mode === "client-signup";
  const isClientSignup = mode === "client-signup";

  const verifyMfa = async () => {
    if (!mfaCode.trim()) {
      toast.error("Informe o codigo do autenticador");
      return;
    }
    setLoading(true);
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const factor = factors.totp.find((item) => item.status === "verified");
      if (!factor) throw new Error("Nenhum autenticador verificado foi encontrado.");
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: mfaCode.trim(),
      });
      if (error) throw error;
      await refreshMfaState();
      toast.success("Autenticacao em duas etapas confirmada");
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel validar o codigo");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "mfa") {
      await verifyMfa();
      return;
    }
    if (isSignupMode && !form.fullName.trim()) {
      toast.error("Informe seu nome completo");
      return;
    }
    if ((isSignupMode || mode === "reset") && form.password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if ((isSignupMode || mode === "reset") && form.password !== form.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      if (mode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/auth?reset=1`,
        });
        if (error) throw error;
        toast.success("Enviamos o link de recuperação para seu e-mail.");
        setMode("signin");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password: form.password });
        if (error) throw error;
        toast.success("Senha atualizada. Você já pode entrar na plataforma.");
        navigate("/");
      } else if (mode === "signin") {
        await signIn(form.email, form.password);
        toast.success("Login realizado com sucesso");
      } else {
        if (isClientSignup) {
          const { data, error } = await supabase.functions.invoke("client-self-signup", {
            body: {
              email: form.email,
              password: form.password,
              fullName: form.fullName.trim(),
              cnpj: form.cnpj.trim() || undefined,
            },
          });
          const response = data as { status?: string; companyName?: string; error?: { message?: string } } | null;
          if (error || response?.error) {
            throw new Error(response?.error?.message ?? error?.message ?? "Não foi possível criar seu acesso de cliente.");
          }
          await signIn(form.email, form.password);
          await refreshProfile();
          toast.success(response?.companyName ? `Acesso liberado para ${response.companyName}` : "Acesso de cliente liberado");
          navigate("/");
          return;
        }

        const result = await signUp({
          email: form.email,
          password: form.password,
          fullName: form.fullName.trim(),
          workspaceName: inviteToken || isClientSignup
            ? undefined
            : form.workspaceName.trim() || undefined,
          accountType: inviteToken || isClientSignup ? "client" : "admin",
          inviteToken,
          clientClaim: isClientSignup,
        });
        toast.success(result.emailConfirmationRequired
          ? "Conta criada. Confirme seu e-mail para liberar o acesso."
          : inviteToken ? "Convite aceito com sucesso" : "Conta criada com sucesso");
        if (result.emailConfirmationRequired) return;
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
                {isLoggedOut && mode === "signin" ? "Até a próxima." : mode === "signin" ? "Acesse sua conta" : mode === "signup" ? "Criar conta" : mode === "client-signup" ? "Acesso de cliente" : mode === "recovery" ? "Recuperar acesso" : mode === "reset" ? "Definir nova senha" : "Verifique seu acesso"}
              </h1>
              <p className="text-sm text-[#070f32]/60 dark:text-white/55">
                {isLoggedOut && mode === "signin" ? "Seu espaço foi fechado com segurança. Entre novamente quando quiser." : mode === "recovery" ? "Enviaremos um link para redefinir sua senha" : mode === "reset" ? "Escolha uma senha segura para sua conta" : mode === "mfa" ? "Digite o codigo do seu aplicativo autenticador" : mode === "client-signup" ? "Use o e-mail cadastrado pelo seu escritório" : "Entre ou crie seu acesso na Lotus"}
              </p>
            </div>
          </div>

          {isLoggedOut && mode === "signin" && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-black/10 bg-[#f1f1f1] p-3 text-left dark:border-white/10 dark:bg-[#202020]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black text-white dark:bg-white dark:text-black">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Sessão encerrada</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Seus dados continuam protegidos. Você pode abrir o workspace novamente pelo login.</p>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "mfa" ? (
              <div className="space-y-1.5">
                <Label htmlFor="mfaCode">Codigo de seis digitos</Label>
                <Input
                  id="mfaCode"
                  name="one-time-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  className={`${fieldClassName} text-center text-lg tracking-[0.35em]`}
                  required
                  autoFocus
                />
              </div>
            ) : <>
            {isSignupMode && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    name="name"
                    autoComplete="name"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    placeholder="Seu nome completo"
                    className={fieldClassName}
                    required
                  />
                </div>
                {!inviteToken && !isClientSignup && (
                  <div className="space-y-1.5">
                    <Label htmlFor="workspaceName">Nome do escritório</Label>
                    <Input
                      id="workspaceName"
                      name="organization"
                      autoComplete="organization"
                      value={form.workspaceName}
                      onChange={(e) =>
                        setForm({ ...form, workspaceName: e.target.value })
                      }
                      placeholder="Ex: Lotus Contabilidade"
                      className={fieldClassName}
                    />
                  </div>
                )}
                {isClientSignup && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cnpj">CNPJ da empresa</Label>
                    <Input
                      id="cnpj"
                      name="tax-id"
                      autoComplete="off"
                      value={form.cnpj}
                      onChange={(e) =>
                        setForm({ ...form, cnpj: e.target.value })
                      }
                      placeholder="Opcional, ajuda a confirmar o vínculo"
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
                name="email"
                type="email"
                autoComplete={mode === "signin" ? "username" : "email"}
                spellCheck={false}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={fieldClassName}
                required
              />
            </div>

            {mode !== "recovery" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className={`${fieldClassName} pr-10`}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#070f32]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7d684b]/50 dark:text-white/55"
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
            )}

            {(isSignupMode || mode === "reset") && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  name="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm({ ...form, confirmPassword: e.target.value })
                  }
                  className={fieldClassName}
                  required
                  minLength={8}
                />
              </div>
            )}

            </>}

            <Button
              type="submit"
              className={`${quietButtonClassName} w-full`}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar" : mode === "signup" ? "Criar escritório" : mode === "client-signup" ? "Criar acesso de cliente" : mode === "recovery" ? "Enviar link de recuperação" : mode === "reset" ? "Salvar nova senha" : "Verificar codigo"}
            </Button>
            {!inviteToken && mode !== "recovery" && mode !== "reset" && mode !== "mfa" && !isClientSignup && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={quietButtonClassName}
                  onClick={() => handleProviderLogin("google")}
                >
                  <img src={googleLogo} alt="" className="h-4 w-4 object-contain" />
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
            )}
            {mode === "signin" && (
              <div className="space-y-2">
                <button
                  type="button"
                  className="block w-full text-center text-sm text-[#7d684b] hover:text-[#5d503a] dark:text-[#d2b58a] dark:hover:text-[#e2cba7]"
                  onClick={() => setMode("client-signup")}
                >
                  Sou cliente e preciso criar meu acesso
                </button>
                <button
                  type="button"
                  className="block w-full text-center text-sm text-[#7d684b] hover:text-[#5d503a] dark:text-[#d2b58a] dark:hover:text-[#e2cba7]"
                  onClick={() => setMode("recovery")}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}
            {mode !== "mfa" && <p className="text-center text-sm text-[#070f32]/60 dark:text-white/55">
              {mode === "signup" ? "Já tem conta?" : mode === "signin" ? "Não tem conta?" : mode === "client-signup" ? "É escritório?" : "Voltar para o login"}{" "}
              <button
                type="button"
                className="font-medium text-[#7d684b] hover:text-[#5d503a] dark:text-[#d2b58a] dark:hover:text-[#e2cba7]"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Criar escritório" : mode === "signup" ? "Entrar" : mode === "client-signup" ? "Entrar ou criar escritório" : "Entrar"}
              </button>
            </p>}
          </form>
        </div>
      </section>

      {/* Slogan banner — website cover photo with overlay */}
      <aside className="hidden h-screen items-center justify-center py-2 pl-6 pr-2 text-center lg:flex xl:py-3 xl:pl-10 xl:pr-3">
        <div
          className="relative flex h-full max-h-[940px] min-h-[560px] w-full max-w-[800px] items-center justify-center overflow-hidden rounded-[2rem] bg-[#070f32]"
          style={{
            backgroundImage: `url(${coverImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/45" />
          <p
            className="relative mx-auto max-w-md text-2xl leading-snug tracking-tight text-white drop-shadow-lg xl:text-3xl"
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
        </div>
      </aside>
    </main>
  );
};

export default Auth;
