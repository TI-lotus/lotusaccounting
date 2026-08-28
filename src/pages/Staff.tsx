import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { UserCog, Plus, Search, Mail, Shield, ShieldCheck, ShieldAlert, CheckSquare, Copy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";

type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "user_id" | "full_name" | "phone" | "job_title" | "account_type" | "company_id" | "status" | "created_at">;
type InviteRow = Pick<Database["public"]["Tables"]["invites"]["Row"], "id" | "email" | "full_name" | "account_type" | "company_id" | "token" | "status" | "expires_at" | "created_at">;

type InviteForm = {
  fullName: string;
  email: string;
  accountType: "collaborator" | "client";
  companyId: string;
};

const permissionLabels = {
  clients: "Clientes",
  payments: "Pagamentos",
  documents: "Documentos",
  reports: "Relatórios",
  integrations: "Integrações",
  agents: "Agentes IA",
};

const roleLabel = (role: string) => {
  if (role === "admin") return "Administrador";
  if (role === "client") return "Cliente";
  return "Colaborador";
};

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "LT";

const Staff = () => {
  const { tasks, updateTask, tenantId, clients } = useData();
  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ProfileRow | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    fullName: "",
    email: "",
    accountType: "collaborator",
    companyId: "",
  });

  const loadPeople = useCallback(async () => {
    if (!tenantId) {
      setProfiles([]);
      setInvites([]);
      return;
    }

    setLoading(true);
    const [profilesRes, invitesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, full_name, phone, job_title, account_type, company_id, status, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true }),
      supabase
        .from("invites")
        .select("id, email, full_name, account_type, company_id, token, status, expires_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
    ]);

    if (profilesRes.error) toast.error("Erro ao carregar equipe: " + profilesRes.error.message);
    if (invitesRes.error) toast.error("Erro ao carregar convites: " + invitesRes.error.message);
    setProfiles((profilesRes.data ?? []) as ProfileRow[]);
    setInvites((invitesRes.data ?? []) as InviteRow[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const members = useMemo(() => profiles.filter((member) => member.account_type !== "client"), [profiles]);
  const clientsProfiles = useMemo(() => profiles.filter((member) => member.account_type === "client"), [profiles]);

  const filteredMembers = members.filter((member) => {
    const haystack = `${member.full_name ?? ""} ${member.job_title ?? ""} ${member.account_type}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  const handleInvite = async () => {
    if (!tenantId || !user) {
      toast.error("Sessão não encontrada");
      return;
    }
    if (!inviteForm.email.trim()) {
      toast.error("Informe o email do convidado");
      return;
    }
    if (inviteForm.accountType === "client" && !inviteForm.companyId) {
      toast.error("Escolha o cliente que este acesso deve enxergar");
      return;
    }

    const { data, error } = await supabase
      .from("invites")
      .insert({
        tenant_id: tenantId,
        email: inviteForm.email.trim().toLowerCase(),
        full_name: inviteForm.fullName.trim() || null,
        account_type: inviteForm.accountType,
        company_id: inviteForm.accountType === "client" ? inviteForm.companyId : null,
        invited_by: user.id,
      })
      .select("id, email, full_name, account_type, company_id, token, status, expires_at, created_at")
      .maybeSingle();

    if (error || !data) {
      toast.error("Erro ao criar convite: " + (error?.message ?? "registro não retornado"));
      return;
    }

    const invite = data as InviteRow;
    const link = `${window.location.origin}/auth?invite=${invite.token}`;
    await navigator.clipboard?.writeText(link);
    setInvites((current) => [invite, ...current]);
    setInviteForm({ fullName: "", email: "", accountType: "collaborator", companyId: "" });
    setDialogOpen(false);
    toast.success("Convite criado e link copiado");
  };

  const copyInviteLink = async (token: string) => {
    await navigator.clipboard?.writeText(`${window.location.origin}/auth?invite=${token}`);
    toast.success("Link do convite copiado");
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from("invites").update({ status: "revoked" }).eq("id", inviteId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInvites((current) => current.map((invite) => invite.id === inviteId ? { ...invite, status: "revoked" } : invite));
    toast.success("Convite revogado");
  };

  const toggleStatus = async (member: ProfileRow) => {
    const nextStatus = member.status === "active" ? "inactive" : "active";
    const assigned = tasks.filter((task) => task.assignedToId === member.user_id && task.status !== "completed");
    if (nextStatus === "inactive" && assigned.length > 0) {
      assigned.forEach((task) => updateTask(task.id, { assignedToId: "", assignedToName: "Sem responsável" }));
      toast.info(`${assigned.length} tarefa(s) ficaram sem responsável`);
    }

    const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", member.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProfiles((current) => current.map((item) => item.id === member.id ? { ...item, status: nextStatus } : item));
    toast.success(nextStatus === "active" ? "Usuário reativado" : "Usuário desativado");
  };

  const assignTask = (taskId: string, checked: boolean) => {
    if (!selectedMember) return;
    updateTask(taskId, checked
      ? { assignedToId: selectedMember.user_id, assignedToName: selectedMember.full_name || "Sem nome" }
      : { assignedToId: "", assignedToName: "Sem responsável" }
    );
  };

  const activeMembers = members.filter((member) => member.status === "active");
  const pendingInvites = invites.filter((invite) => invite.status === "pending");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Equipe e acessos</h1>
            <p className="text-muted-foreground">Convide usuários, acompanhe papéis e controle vínculos por cliente</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />Novo convite</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
              <DialogHeader>
                <DialogTitle>Criar convite</DialogTitle>
                <DialogDescription>O link criado pode ser enviado ao colaborador ou cliente.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input value={inviteForm.fullName} onChange={(event) => setInviteForm({ ...inviteForm, fullName: event.target.value })} placeholder="Nome completo" className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} placeholder="email@empresa.com" className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label>Tipo de acesso</Label>
                  <Select value={inviteForm.accountType} onValueChange={(value: InviteForm["accountType"]) => setInviteForm({ ...inviteForm, accountType: value, companyId: "" })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collaborator">Colaborador</SelectItem>
                      <SelectItem value="client">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {inviteForm.accountType === "client" && (
                  <div className="grid gap-2">
                    <Label>Empresa vinculada</Label>
                    <Select value={inviteForm.companyId} onValueChange={(value) => setInviteForm({ ...inviteForm, companyId: value })}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                <Button onClick={handleInvite} className="rounded-xl">Criar convite</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gilver/10"><UserCog className="h-5 w-5 text-gilver" /></div>
            <div><p className="text-2xl font-semibold">{members.length}</p><p className="text-sm text-muted-foreground">Equipe</p></div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10"><ShieldCheck className="h-5 w-5 text-emerald-500" /></div>
            <div><p className="text-2xl font-semibold">{activeMembers.length}</p><p className="text-sm text-muted-foreground">Ativos</p></div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10"><UserPlus className="h-5 w-5 text-amber-500" /></div>
            <div><p className="text-2xl font-semibold">{pendingInvites.length}</p><p className="text-sm text-muted-foreground">Convites</p></div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10"><CheckSquare className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-2xl font-semibold">{clientsProfiles.length}</p><p className="text-sm text-muted-foreground">Acessos cliente</p></div>
          </div>
        </div>

        <Tabs defaultValue="people" className="animate-fade-in">
          <TabsList>
            <TabsTrigger value="people">Equipe</TabsTrigger>
            <TabsTrigger value="invites">Convites</TabsTrigger>
            <TabsTrigger value="capacity">Capacidade</TabsTrigger>
            <TabsTrigger value="perms">Permissões</TabsTrigger>
          </TabsList>

          <TabsContent value="people" className="mt-4">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nome, cargo ou papel..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-10 rounded-xl" />
                </div>
                <Badge variant="secondary" className="px-3 py-1.5">{filteredMembers.length} membros</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredMembers.map((member) => {
                  const memberTasks = tasks.filter((task) => task.assignedToId === member.user_id);
                  const completed = memberTasks.filter((task) => task.status === "completed").length;
                  const name = member.full_name || "Sem nome";
                  return (
                    <div key={member.id} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-11 w-11 ring-2 ring-gilver/30">
                            <AvatarFallback className="bg-gilver/15 text-gilver font-medium">{initials(name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium truncate">{name}</p>
                              {member.account_type === "admin" && <Shield className="h-3.5 w-3.5 text-gilver shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{roleLabel(member.account_type)}</p>
                          </div>
                        </div>
                        <Badge className={cn("text-[10px] py-0.5", member.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                          {member.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="truncate"><span className="font-medium text-foreground">Cargo:</span> {member.job_title || "—"}</p>
                        <p className="truncate"><span className="font-medium text-foreground">Telefone:</span> {member.phone || "—"}</p>
                      </div>

                      <div className="rounded-lg bg-muted/40 p-2 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tarefas</span>
                        <span className="font-medium">{completed}/{memberTasks.length}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 rounded-xl gap-1.5" onClick={() => { setSelectedMember(member); setAssignDialogOpen(true); }}>
                          <CheckSquare className="h-3.5 w-3.5" />Tarefas
                        </Button>
                        {member.user_id !== profile?.user_id && (
                          <Button variant={member.status === "active" ? "outline" : "default"} size="sm" className="flex-1 rounded-xl gap-1.5" onClick={() => toggleStatus(member)}>
                            <ShieldAlert className="h-3.5 w-3.5" />
                            {member.status === "active" ? "Desativar" : "Ativar"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!loading && filteredMembers.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <UserCog className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum membro encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="invites" className="mt-4">
            <div className="glass rounded-2xl p-6 space-y-3">
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum convite criado ainda.</p>
              ) : invites.map((invite) => (
                <div key={invite.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{invite.full_name || invite.email}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{invite.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {roleLabel(invite.account_type)}{invite.company_id ? ` · ${clients.find((client) => client.id === invite.company_id)?.name ?? "cliente vinculado"}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={invite.status === "pending" ? "secondary" : "outline"}>{invite.status === "pending" ? "Pendente" : invite.status === "accepted" ? "Aceito" : "Revogado"}</Badge>
                    {invite.status === "pending" && (
                      <>
                        <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => copyInviteLink(invite.token)}><Copy className="h-4 w-4" />Copiar link</Button>
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => revokeInvite(invite.id)}>Revogar</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="capacity" className="mt-4">
            <div className="glass rounded-2xl p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Volume de tarefas ativas por colaborador em relação à capacidade sugerida de 20 tarefas.</p>
              {activeMembers.map((member) => {
                const active = tasks.filter((task) => task.assignedToId === member.user_id && task.status !== "completed").length;
                const pct = Math.min(100, Math.round((active / 20) * 100));
                return (
                  <div key={member.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{member.full_name || "Sem nome"}</span>
                      <span className={cn("text-xs font-medium", pct >= 90 ? "text-red-500" : "text-muted-foreground")}>{active} / 20 tarefas</span>
                    </div>
                    <Progress value={pct} className={cn("h-2", pct >= 90 && "[&>div]:bg-red-500")} />
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="perms" className="mt-4">
            <div className="glass rounded-2xl p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4">Papel</th>
                    {Object.values(permissionLabels).map((label) => <th key={label} className="py-2 px-2 text-center">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { role: "Administrador", values: [true, true, true, true, true, true] },
                    { role: "Colaborador", values: [true, true, true, true, false, false] },
                    { role: "Cliente", values: [false, true, true, true, false, false] },
                  ].map((row) => (
                    <tr key={row.role} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium">{row.role}</td>
                      {row.values.map((enabled, index) => (
                        <td key={index} className="py-2 px-2 text-center">
                          {enabled ? <ShieldCheck className="h-4 w-4 text-emerald-500 mx-auto" /> : <ShieldAlert className="h-4 w-4 text-muted-foreground mx-auto" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Atribuir tarefas</DialogTitle>
              <DialogDescription>{selectedMember?.full_name || "Usuário selecionado"}</DialogDescription>
            </DialogHeader>
            {selectedMember && (
              <div className="max-h-[420px] overflow-y-auto custom-scroll space-y-2 py-2">
                {tasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa cadastrada.</p>}
                {tasks.map((task) => {
                  const checked = task.assignedToId === selectedMember.user_id;
                  return (
                    <label key={task.id} className="flex items-start gap-3 rounded-xl border border-border p-3 hover:bg-accent/40 cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={(value) => assignTask(task.id, !!value)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{task.clientName ?? "Sem cliente"} · {task.status}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setAssignDialogOpen(false)} className="rounded-xl">Concluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Staff;
