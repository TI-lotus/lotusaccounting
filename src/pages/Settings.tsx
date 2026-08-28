import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Building,
  Camera,
} from "lucide-react";
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
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useData } from "@/contexts/DataContext";
import {
  defaultAutomationPreferences,
  defaultNotificationChannels,
} from "@/lib/workspaceSettingsDefaults";
import { useTheme } from "@/hooks/useTheme";
import { useEffect, useRef, useState } from "react";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

type ThemePreference = "light" | "dark" | "system";
const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

export const SettingsContent = ({
  showHeader = true,
}: {
  showHeader?: boolean;
}) => {
  const profile = useUserProfile();
  const { workspaceSettings, updateWorkspaceSettings } = useData();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [themePref, setThemePref] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem("lotus-theme-pref");
    return isThemePreference(stored) ? stored : "light";
  });
  useEffect(() => {
    localStorage.setItem("lotus-theme-pref", themePref);
    if (themePref === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(isDark ? "dark" : "light");
    } else {
      setTheme(themePref);
    }
  }, [themePref, setTheme]);

  const [officeName, setOfficeName] = useState("");
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

  useEffect(() => {
    if (!workspaceSettings) return;
    if (isThemePreference(workspaceSettings.theme_preference)) {
      setThemePref(workspaceSettings.theme_preference);
    }
    setOfficeName(profile.companyName || workspaceSettings.office_name || "");
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
  }, [profile.companyName, workspaceSettings]);

  const handleSaveSettings = async () => {
    const saved = await updateWorkspaceSettings({
      office_name: officeName || workspaceSettings?.office_name,
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
    if (saved) toast.success("Configurações salvas com sucesso!");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {showHeader && (
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">
            Configurações
          </h1>
          <p className="text-muted-foreground">
            Gerencie sua conta e preferências
          </p>
        </div>
      )}

      {/* Profile */}
      <div className="glass rounded-2xl p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Perfil</h3>
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
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-soft-lg hover:opacity-90"
              aria-label="Trocar foto"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () =>
                  profile.updateProfile({ avatarUrl: String(reader.result) });
                reader.readAsDataURL(file);
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
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={profile.cpf} className="rounded-xl" disabled />
            </div>
          </div>
        </div>
      </div>

      {/* Company */}
      <div className="glass rounded-2xl p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Building className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Empresa</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Empresa</Label>
            <Input
              value={officeName}
              onChange={(e) => {
                setOfficeName(e.target.value);
                profile.updateProfile({ companyName: e.target.value });
              }}
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={profile.cnpj} className="rounded-xl" disabled />
            </div>
            <div className="space-y-2">
              <Label>Encerramento do Exercício Fiscal</Label>
              <Input
                value={fiscalYearEnd}
                onChange={(e) => setFiscalYearEnd(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="glass rounded-2xl p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Preferências</h3>
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
              onValueChange={(v: ThemePreference) => setThemePref(v)}
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
      </div>

      {/* Notifications */}
      <div className="glass rounded-2xl p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Notificações</h3>
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
      </div>

      {/* Automations */}
      <div className="glass rounded-2xl p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Automações</h3>
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
      </div>

      {/* Security */}
      <div className="glass rounded-2xl p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Segurança</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Autenticação em Duas Etapas</p>
              <p className="text-sm text-muted-foreground">
                Adicione uma camada extra de segurança
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg">
              Ativar
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Alterar Senha</p>
              <p className="text-sm text-muted-foreground">
                Atualize a senha da sua conta
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg">
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="rounded-xl px-8" onClick={handleSaveSettings}>
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
};

const Settings = () => (
  <DashboardLayout>
    <SettingsContent />
  </DashboardLayout>
);

export default Settings;
