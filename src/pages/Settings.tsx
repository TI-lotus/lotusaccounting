import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Settings as SettingsIcon, User, Bell, Shield, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUserProfile } from "@/contexts/UserProfileContext";

const Settings = () => {
  const profile = useUserProfile();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Gerencie sua conta e preferências</p>
        </div>

        {/* Profile Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Perfil</h3>
          </div>
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">{profile.initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={profile.firstName} onChange={(e) => profile.updateProfile({ firstName: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Sobrenome</Label>
                  <Input value={profile.lastName} onChange={(e) => profile.updateProfile({ lastName: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile.email} onChange={(e) => profile.updateProfile({ email: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={profile.cpf} className="rounded-xl" disabled />
              </div>
            </div>
          </div>
        </div>

        {/* Company Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Building className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Empresa</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input value={profile.companyName} onChange={(e) => profile.updateProfile({ companyName: e.target.value })} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={profile.cnpj} className="rounded-xl" disabled />
              </div>
              <div className="space-y-2">
                <Label>Encerramento do Exercício Fiscal</Label>
                <Input defaultValue="Dezembro" className="rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Preferências</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Tema</p>
                <p className="text-sm text-muted-foreground">Alternar entre modo claro e escuro</p>
              </div>
              <ThemeToggle />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Moeda</p>
                <p className="text-sm text-muted-foreground">Moeda padrão de exibição</p>
              </div>
              <span className="text-sm text-muted-foreground">BRL (R$)</span>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Notificações</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notificações por Email</p>
                <p className="text-sm text-muted-foreground">Receber atualizações por email</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Alertas de Pagamento</p>
                <p className="text-sm text-muted-foreground">Ser notificado sobre pagamentos recebidos</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Lembretes de Fatura</p>
                <p className="text-sm text-muted-foreground">Lembretes para faturas vencidas</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Segurança</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Autenticação em Duas Etapas</p>
                <p className="text-sm text-muted-foreground">Adicione uma camada extra de segurança</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-lg">
                Ativar
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Alterar Senha</p>
                <p className="text-sm text-muted-foreground">Atualize a senha da sua conta</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-lg">
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button className="rounded-xl px-8">
            Salvar Alterações
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
