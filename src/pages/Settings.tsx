import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  defaultAutomationPreferences,
  defaultNotificationChannels,
} from "@/lib/workspaceSettingsDefaults";
import { useTheme } from "@/hooks/useTheme";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfirmDestructiveDialog } from "@/components/ConfirmDestructiveDialog";

type ThemePreference = "light" | "dark" | "system";
export type SettingsSection = "all" | "profile" | "organization" | "preferences" | "security";
type MfaFactor = {
  id: string;
  friendly_name?: string;
  status: "verified" | "unverified";
};
const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

export const SettingsContent = ({
  showHeader = true,
  section = "all",
}: {
  showHeader?: boolean;
  section?: SettingsSection;
}) => {
  const profile = useUserProfile();
  const { workspaceSettings, updateWorkspaceSettings } = useData();
  const { profile: authProfile, refreshMfaState } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [themePref, setThemePref] = useState<ThemePreference>(theme);
  const [themeReady, setThemeReady] = useState(false);
  const [themeTouched, setThemeTouched] = useState(false);
  useEffect(() => {
    if (!themeReady || !themeTouched) return;
    localStorage.setItem("lotus-theme-pref", themePref);
    if (themePref === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(isDark ? "dark" : "light");
    } else {
      setTheme(themePref);
    }
  }, [themePref, themeReady, themeTouched, setTheme]);

  const [officeName, setOfficeName] = useState("");
  const [officeCnpj, setOfficeCnpj] = useState("");
  const [fiscalYearEnd, setFiscalYearEnd] = useState("Dezembro");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappTypes, setWhatsappTypes] = useState({
    tarefas: true,
    vencimentos: true,
    recebimentos: false,
    documentos: false,
  });
  const [automationPrefs, setAutomationPrefs] = useState(
    defaultAutomationPreferences,
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [mfaEnrollment, setMfaEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaRemovalTarget, setMfaRemovalTarget] = useState<MfaFactor | null>(null);
  const isAdmin = authProfile?.account_type === "admin";
  const showSection = (target: Exclude<SettingsSection, "all">) => section === "all" || section === target;

  const loadMfaFactors = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    setMfaFactors(data.totp.map((factor) => ({
      id: factor.id,
      friendly_name: factor.friendly_name,
      status: factor.status,
    })));
  }, []);

  const openMfaDialog = async (open: boolean) => {
    setMfaDialogOpen(open);
    if (!open) return;
    try {
      await loadMfaFactors();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar a configuracao de 2FA.");
    }
  };

  const startMfaEnrollment = async () => {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Lotus Authenticator",
      });
      if (error) throw error;
      setMfaEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setMfaCode("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel iniciar o 2FA.");
    } finally {
      setMfaLoading(false);
    }
  };

  const confirmMfaEnrollment = async () => {
    if (!mfaEnrollment || mfaCode.trim().length !== 6) {
      toast.error("Informe o codigo de seis digitos do autenticador.");
      return;
    }
    setMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaEnrollment.factorId,
        code: mfaCode.trim(),
      });
      if (error) throw error;
      setMfaEnrollment(null);
      setMfaCode("");
      await loadMfaFactors();
      await refreshMfaState();
      toast.success("Autenticacao em duas etapas ativada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Codigo invalido.");
    } finally {
      setMfaLoading(false);
    }
  };

  const removeMfaFactor = async (factorId: string) => {
    setMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await loadMfaFactors();
      await refreshMfaState();
      toast.success("Autenticacao em duas etapas desativada.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel desativar o 2FA.");
      return false;
    } finally {
      setMfaLoading(false);
    }
  };

  useEffect(() => {
    if (!workspaceSettings) return;
    if (showHeader && isThemePreference(workspaceSettings.theme_preference)) {
      setThemePref(workspaceSettings.theme_preference);
    }
    setThemeReady(true);
    setOfficeName(workspaceSettings.office_name || "");
    setOfficeCnpj(workspaceSettings.cnpj || "");
    setFiscalYearEnd(workspaceSettings.fiscal_year_end);

    const channels =
      workspaceSettings.notification_channels &&
      typeof workspaceSettings.notification_channels === "object" &&
      !Array.isArray(workspaceSettings.notification_channels)
        ? (workspaceSettings.notification_channels as Record<
            string,
            Json | undefined
          >)
        : defaultNotificationChannels;

    setEmailNotifications(Boolean(channels.email ?? true));
    setPaymentAlerts(Boolean(channels.paymentAlerts ?? true));
    setWhatsappEnabled(Boolean(channels.whatsapp ?? false));
    setWhatsappPhone(String(channels.whatsappPhone ?? ""));
    if (
      channels.whatsappTypes &&
      typeof channels.whatsappTypes === "object" &&
      !Array.isArray(channels.whatsappTypes)
    ) {
      setWhatsappTypes({
        ...defaultNotificationChannels.whatsappTypes,
        ...(channels.whatsappTypes as Record<string, boolean>),
      });
    }

    const automations =
      workspaceSettings.automation_preferences &&
      typeof workspaceSettings.automation_preferences === "object" &&
      !Array.isArray(workspaceSettings.automation_preferences)
        ? (workspaceSettings.automation_preferences as Record<string, boolean>)
        : defaultAutomationPreferences;
    setAutomationPrefs({
      ...defaultAutomationPreferences,
      ...automations,
    });
  }, [showHeader, workspaceSettings]);

  const handleSaveSettings = async () => {
    if (!isAdmin) {
      toast.error("Somente administradores podem alterar dados de identificação e do escritório.");
      return;
    }
    const normalizedCnpj = officeCnpj.replace(/\D/g, "");
    if (normalizedCnpj && normalizedCnpj.length !== 14) {
      toast.error("O CNPJ do escritório deve conter 14 dígitos");
      return;
    }
    const profileSaved = await profile.saveProfile();
    if (!profileSaved.ok) {
      toast.error("Não foi possível salvar seu perfil. Confira CPF, e-mail e permissões.");
      return;
    }
    const saved = await updateWorkspaceSettings({
      office_name: officeName || workspaceSettings?.office_name,
      cnpj: normalizedCnpj || null,
      fiscal_year_end: fiscalYearEnd,
      currency: "BRL",
      theme_preference: themePref,
      notification_channels: {
        email: emailNotifications,
        paymentAlerts,
        whatsapp: whatsappEnabled,
        whatsappPhone,
        whatsappTypes,
      } as Json,
      automation_preferences: automationPrefs as unknown as Json,
    });
    if (saved) {
      profile.updateProfile({ companyName: saved.office_name || "", cnpj: saved.cnpj || "" });
      toast.success(profileSaved.emailConfirmationRequired ? "Configurações salvas. Confirme o novo e-mail para concluir a alteração." : "Configurações salvas com sucesso!");
    }
  };

  const handlePasswordUpdate = async () => {
    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("Não foi possível alterar a senha: " + error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Senha atualizada com sucesso");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {showHeader && (
        <div className="animate-fade-in">
          <h1 className="text-[28px] font-normal tracking-[-0.035em]">
            Configurações
          </h1>
          <p className="text-muted-foreground">
            Gerencie sua conta e preferências
          </p>
        </div>
      )}

      {/* Profile */}
      {showSection("profile") && <div className="page-section animate-fade-in">
        <div className="mb-5">
          <h2 className="text-base font-medium">Perfil</h2>
          <p className="mt-1 text-sm text-muted-foreground">Dados pessoais e identificação de acesso.</p>
        </div>
        <div className="flex items-start gap-6">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatarUrl} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {profile.initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => isAdmin && fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-soft-lg hover:opacity-90"
              aria-label="Trocar foto"
              disabled={!isAdmin}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const uploaded = await profile.uploadAvatar(file);
                if (!uploaded) {
                  toast.error("Use uma imagem JPG, PNG ou WebP de até 2 MB.");
                  return;
                }
                toast.success("Foto de perfil atualizada");
              }}
            />
          </div>
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={profile.firstName}
                  onChange={(e) =>
                    profile.updateProfile({ firstName: e.target.value })
                  }
                  disabled={!isAdmin}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Sobrenome</Label>
                <Input
                  value={profile.lastName}
                  onChange={(e) =>
                    profile.updateProfile({ lastName: e.target.value })
                  }
                  disabled={!isAdmin}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={profile.email}
                onChange={(e) =>
                  profile.updateProfile({ email: e.target.value })
                }
                disabled={!isAdmin}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={profile.cpf} onChange={(e) => profile.updateProfile({ cpf: e.target.value })} placeholder="000.000.000-00" className="rounded-xl" disabled={!isAdmin} />
            </div>
          </div>
        </div>
      </div>}

      {/* Company */}
      {showSection("organization") && <div className="page-section animate-fade-in">
        <div className="mb-5">
          <h2 className="text-base font-medium">Empresa</h2>
          <p className="mt-1 text-sm text-muted-foreground">Identidade e período fiscal do escritório.</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Empresa</Label>
            <Input
              value={officeName}
              onChange={(e) => {
                setOfficeName(e.target.value);
              }}
              disabled={!isAdmin}
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={officeCnpj} onChange={(e) => setOfficeCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="rounded-xl" disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label>Encerramento do Exercício Fiscal</Label>
              <Input
                value={fiscalYearEnd}
                onChange={(e) => setFiscalYearEnd(e.target.value)}
                className="rounded-xl"
                disabled={!isAdmin}
              />
            </div>
          </div>
        </div>
      </div>}

      {/* Preferences */}
      {showSection("preferences") && <div className="page-section animate-fade-in">
        <div className="mb-5">
          <h2 className="text-base font-medium">Preferências</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ajustes de visualização e moeda.</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Tema</p>
              <p className="text-sm text-muted-foreground">
                Escolha o modo de exibição
              </p>
            </div>
            <Select
              value={themePref}
              onValueChange={(v: ThemePreference) => {
                setThemeTouched(true);
                setThemePref(v);
              }}
            >
              <SelectTrigger className="w-44 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="system">Adaptar ao Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Moeda</p>
              <p className="text-sm text-muted-foreground">
                Moeda padrão de exibição
              </p>
            </div>
            <span className="text-sm text-muted-foreground">BRL (R$)</span>
          </div>
        </div>
      </div>}

      {/* Notifications */}
      {showSection("preferences") && <div className="page-section animate-fade-in">
        <div className="mb-5">
          <h2 className="text-base font-medium">Notificações</h2>
          <p className="mt-1 text-sm text-muted-foreground">Escolha quais avisos chegam a você.</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Notificações por Email</p>
              <p className="text-sm text-muted-foreground">
                Receber atualizações por email
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Alertas de Pagamento</p>
              <p className="text-sm text-muted-foreground">
                Ser notificado sobre pagamentos recebidos
              </p>
            </div>
            <Switch
              checked={paymentAlerts}
              onCheckedChange={setPaymentAlerts}
            />
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notificações por WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  Receber mensagens automáticas
                </p>
              </div>
              <Switch
                checked={whatsappEnabled}
                onCheckedChange={setWhatsappEnabled}
              />
            </div>
            {whatsappEnabled && (
              <div className="rounded-xl border border-border p-4 space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <Label>Número de telefone</Label>
                  <Input
                    placeholder="(11) 99999-0000"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipos de mensagem</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["tarefas", "Tarefas"],
                        ["vencimentos", "Vencimentos"],
                        ["recebimentos", "Recebimentos"],
                        ["documentos", "Documentos"],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={whatsappTypes[key]}
                          onCheckedChange={(v) =>
                            setWhatsappTypes((prev) => ({
                              ...prev,
                              [key]: !!v,
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>}

      {/* Automations */}
      {showSection("preferences") && <div className="page-section animate-fade-in">
        <div className="mb-5">
          <h2 className="text-base font-medium">Automações</h2>
          <p className="mt-1 text-sm text-muted-foreground">Regras que ajudam o escritório a manter o ciclo em dia.</p>
        </div>
        <div className="space-y-4">
          {(
            [
              [
                "reviewIncompleteDocuments",
                "Criar pendência para documento incompleto",
              ],
              [
                "generateMonthlyObligations",
                "Gerar obrigações fiscais mensais",
              ],
              ["dueDateAlerts", "Alertar vencimentos próximos"],
              [
                "lowConfidenceReview",
                "Revisar classificações de baixa confiança",
              ],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">
                  Preferência operacional do workspace
                </p>
              </div>
              <Switch
                checked={automationPrefs[key]}
                onCheckedChange={(checked) =>
                  setAutomationPrefs((current) => ({
                    ...current,
                    [key]: checked,
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>}

      {/* Security */}
      {showSection("security") && <div className="page-section animate-fade-in">
        <div className="mb-5">
          <h2 className="text-base font-medium">Segurança</h2>
          <p className="mt-1 text-sm text-muted-foreground">Proteja sua conta e seus dados de trabalho.</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Autenticação em Duas Etapas</p>
              <p className="text-sm text-muted-foreground">
                Adicione uma camada extra de segurança
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void openMfaDialog(true)}>
              Configurar
            </Button>
          </div>
          <Separator />
          <div className="space-y-3">
            <div>
              <p className="font-medium">Alterar Senha</p>
              <p className="text-sm text-muted-foreground">Atualize a senha da sua conta.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha" className="rounded-xl" />
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar nova senha" className="rounded-xl" />
            </div>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={handlePasswordUpdate}>Atualizar senha</Button>
          </div>
        </div>
      </div>}

      {section !== "security" && <div className="flex justify-end">
        <Button className="rounded-xl px-8" onClick={handleSaveSettings}>
          Salvar Alterações
        </Button>
      </div>}

      <Dialog open={mfaDialogOpen} onOpenChange={(open) => void openMfaDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Autenticacao em duas etapas</DialogTitle>
            <DialogDescription>
              Use um aplicativo autenticador compativel com codigos TOTP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {mfaEnrollment ? (
              <>
                <div className="flex justify-center rounded-xl bg-white p-3">
                  <img src={mfaEnrollment.qrCode} alt="QR code para configurar o autenticador" className="h-40 w-40" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Caso nao consiga escanear, informe esta chave no aplicativo: <span className="font-mono text-foreground break-all">{mfaEnrollment.secret}</span>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="settingsMfaCode">Codigo de seis digitos</Label>
                  <Input
                    id="settingsMfaCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))}
                    className="rounded-xl text-center tracking-[0.3em]"
                  />
                </div>
              </>
            ) : (
              <>
                {mfaFactors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum autenticador configurado nesta conta.</p>
                ) : (
                  <div className="space-y-2">
                    {mfaFactors.map((factor) => (
                      <div key={factor.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                        <div>
                          <p className="text-sm font-medium">{factor.friendly_name || "Aplicativo autenticador"}</p>
                          <p className="text-xs text-muted-foreground">{factor.status === "verified" ? "Ativo" : "Aguardando confirmacao"}</p>
                        </div>
                        <Button variant="outline" size="sm" disabled={mfaLoading} onClick={() => setMfaRemovalTarget(factor)}>Remover</Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button className="w-full" disabled={mfaLoading} onClick={() => void startMfaEnrollment()}>
                  Configurar aplicativo autenticador
                </Button>
              </>
            )}
          </div>

          {mfaEnrollment && (
            <DialogFooter>
              <Button variant="outline" disabled={mfaLoading} onClick={() => setMfaEnrollment(null)}>Cancelar</Button>
              <Button disabled={mfaLoading} onClick={() => void confirmMfaEnrollment()}>Confirmar codigo</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDestructiveDialog
        open={Boolean(mfaRemovalTarget)}
        onOpenChange={(open) => { if (!open) setMfaRemovalTarget(null); }}
        title="Desativar autenticação em duas etapas?"
        description="O próximo acesso voltará a exigir apenas a senha desta conta."
        confirmLabel="Desativar 2FA"
        onConfirm={async () => {
          if (!mfaRemovalTarget) return false;
          const success = await removeMfaFactor(mfaRemovalTarget.id);
          if (success) setMfaRemovalTarget(null);
          return success;
        }}
      />
    </div>
  );
};

const Settings = () => (
  <DashboardLayout>
    <SettingsContent />
  </DashboardLayout>
);

export default Settings;
