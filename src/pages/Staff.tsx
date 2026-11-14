import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Building2, CheckSquare, Copy, Grid2X2, List, Mail, Pencil, Plus, Search, Shield, ShieldAlert, ShieldCheck, UserCog, UserPlus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";
import { getBentoGridClass } from "@/components/dashboard/bentoGrid";
import { IconTooltipButton } from "@/components/IconTooltipButton";
import { RowActions } from "@/components/RowActions";
import { BentoDataTable } from "@/components/BentoDataTable";
import { FilterPopover } from "@/components/FilterPopover";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { ConfirmDestructiveDialog } from "@/components/ConfirmDestructiveDialog";

type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "user_id" | "full_name" | "phone" | "job_title" | "avatar_url" | "account_type" | "company_id" | "status" | "created_at">;
type InviteRow = Pick<Database["public"]["Tables"]["invites"]["Row"], "id" | "email" | "full_name" | "account_type" | "company_id" | "token" | "status" | "expires_at" | "created_at">;
type PermissionRow = Database["public"]["Tables"]["workspace_member_permissions"]["Row"];

type InviteForm = {
  fullName: string;
  email: string;
  accountType: "collaborator" | "client";
  companyId: string;
};

const permissionLabels = {
  clients: "Clientes",
  tasks: "Tarefas",
  financial: "Financeiro",
  documents: "Documentos",
  reports: "Relatórios",
  integrations: "Integrações",
};

type PermissionKey = keyof typeof permissionLabels;
type PermissionAction = "read" | "create" | "update" | "delete";
type PermissionMatrix = Record<PermissionKey, Record<PermissionAction, boolean>>;

const permissionActions: { key: PermissionAction; label: string }[] = [
  { key: "read", label: "Ver" },
  { key: "create", label: "Criar" },
  { key: "update", label: "Editar" },
  { key: "delete", label: "Excluir" },
];

const defaultPermissionMatrix: PermissionMatrix = {
  clients: { read: true, create: true, update: true, delete: false },
  tasks: { read: true, create: true, update: true, delete: false },
  financial: { read: true, create: false, update: false, delete: false },
  documents: { read: true, create: true, update: true, delete: false },
  reports: { read: true, create: false, update: false, delete: false },
  integrations: { read: false, create: false, update: false, delete: false },
};

const normalizePermissionMatrix = (value: Json): PermissionMatrix => {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
  return Object.fromEntries(Object.keys(permissionLabels).map((resource) => {
    const actions = source[resource] && typeof source[resource] === "object" && !Array.isArray(source[resource])
      ? source[resource] as Record<string, boolean>
      : {};
    return [resource, Object.fromEntries(permissionActions.map(({ key }) => [key, Boolean(actions[key] ?? defaultPermissionMatrix[resource as PermissionKey][key])]))];
  })) as PermissionMatrix;
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
  const { tasks, updateTask, updateClient, tenantId, clients } = useData();
  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [memberPermissions, setMemberPermissions] = useState<PermissionRow[]>([]);
  const [permissionMemberId, setPermissionMemberId] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteStatusFilters, setInviteStatusFilters] = useState<string[]>([]);
  const [inviteAccessFilters, setInviteAccessFilters] = useState<string[]>([]);
  const [peopleViewMode, setPeopleViewMode] = useState<"grid" | "list">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [clientAssignmentOpen, setClientAssignmentOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ProfileRow | null>(null);
  const [detailMember, setDetailMember] = useState<ProfileRow | null>(null);
  const [accessMember, setAccessMember] = useState<ProfileRow | null>(null);
  const [editingMember, setEditingMember] = useState<ProfileRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InviteRow | null>(null);
  const [accessRole, setAccessRole] = useState<"admin" | "collaborator">("collaborator");
  const [editForm, setEditForm] = useState({ fullName: "", jobTitle: "", phone: "" });
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
    const [profilesRes, invitesRes, permissionsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, full_name, phone, job_title, avatar_url, account_type, company_id, status, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true }),
      supabase
        .from("invites")
        .select("id, email, full_name, account_type, company_id, token, status, expires_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("workspace_member_permissions")
        .select("tenant_id, user_id, permissions, updated_at, updated_by")
        .eq("tenant_id", tenantId),
    ]);

    if (profilesRes.error) toast.error("Erro ao carregar equipe: " + profilesRes.error.message);
    if (invitesRes.error) toast.error("Erro ao carregar convites: " + invitesRes.error.message);
    if (permissionsRes.error) toast.error("Erro ao carregar permissões: " + permissionsRes.error.message);
    setProfiles((profilesRes.data ?? []) as ProfileRow[]);
    setInvites((invitesRes.data ?? []) as InviteRow[]);
    setMemberPermissions((permissionsRes.data ?? []) as PermissionRow[]);
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
  const filteredInvites = invites.filter((invite) => {
    const search = inviteSearch.trim().toLowerCase();
    const searchMatch = !search || `${invite.full_name ?? ""} ${invite.email}`.toLowerCase().includes(search);
    const statusMatch = inviteStatusFilters.length === 0 || inviteStatusFilters.includes(invite.status);
    const accessMatch = inviteAccessFilters.length === 0 || inviteAccessFilters.includes(invite.account_type);
    return searchMatch && statusMatch && accessMatch;
  });

  const handleInvite = async () => {
    if (!tenantId || !user) {
      toast.error("Sessão não encontrada");
      return;
    }
    if (profile?.account_type !== "admin") {
      toast.error("Somente administradores podem criar convites");
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

    const { data, error } = await supabase.functions.invoke("create-workspace-invite", {
      body: {
        email: inviteForm.email.trim().toLowerCase(),
        fullName: inviteForm.fullName.trim() || null,
        accountType: inviteForm.accountType,
        companyId: inviteForm.accountType === "client" ? inviteForm.companyId : null,
      },
    });

    const response = data as { invite?: InviteRow; deliveryStatus?: string; deliveryError?: string } | null;
    if (error || !response?.invite) {
      toast.error("Erro ao criar convite: " + (error?.message ?? "registro não retornado"));
      return;
    }

    const invite = response.invite;
    const link = `${window.location.origin}/auth?invite=${invite.token}`;
    await navigator.clipboard?.writeText(link);
    setInvites((current) => [invite, ...current]);
    setInviteForm({ fullName: "", email: "", accountType: "collaborator", companyId: "" });
    setDialogOpen(false);
    if (response.deliveryStatus === "sent") {
      toast.success("Convite enviado por e-mail e link copiado");
    } else if (response.deliveryStatus === "failed") {
      toast.warning("Convite criado, mas o e-mail não foi enviado", {
        description: response.deliveryError
          ? `Link copiado. Erro do provedor: ${response.deliveryError.slice(0, 180)}`
          : "Link copiado. Envie manualmente ao convidado.",
      });
    } else {
      toast.success("Convite criado e link copiado", {
        description: response.deliveryStatus === "not_configured"
          ? "O envio por e-mail será ativado após configurar o provedor."
          : "Envie o link copiado manualmente ao convidado.",
      });
    }
  };

  const copyInviteLink = async (token: string) => {
    await navigator.clipboard?.writeText(`${window.location.origin}/auth?invite=${token}`);
    toast.success("Link do convite copiado");
  };

  const revokeInvite = async (inviteId: string) => {
    if (!tenantId || profile?.account_type !== "admin") {
      toast.error("Somente administradores podem revogar convites");
      return false;
    }
    const { error } = await supabase.from("invites").update({ status: "revoked" }).eq("id", inviteId).eq("tenant_id", tenantId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    setInvites((current) => current.map((invite) => invite.id === inviteId ? { ...invite, status: "revoked" } : invite));
    toast.success("Convite revogado");
    return true;
  };

  const toggleStatus = async (member: ProfileRow) => {
    if (!tenantId || profile?.account_type !== "admin") {
      toast.error("Somente administradores podem alterar acessos");
      return;
    }
    const nextStatus = member.status === "active" ? "inactive" : "active";
    const assigned = tasks.filter((task) => task.assignedToId === member.user_id && task.status !== "completed");
    const assignedClients = clients.filter((client) => client.responsibleUserId === member.user_id);
    const { data, error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", member.id).eq("tenant_id", tenantId).select("id").maybeSingle();
    if (error || !data) {
      toast.error(error?.message ?? "Seu perfil não pode alterar este acesso.");
      return;
    }
    if (nextStatus === "inactive" && assigned.length > 0) {
      const results = await Promise.all(assigned.map((task) => updateTask(task.id, { assignedToId: "", assignedToName: "Sem responsável" })));
      const cleared = results.filter(Boolean).length;
      if (cleared) toast.info(`${cleared} tarefa(s) ficaram sem responsável`);
    }
    if (nextStatus === "inactive" && assignedClients.length > 0) {
      const results = await Promise.all(assignedClients.map((client) =>
        updateClient(client.id, { responsibleUserId: "", responsibleUserName: "" }),
      ));
      const cleared = results.filter(Boolean).length;
      if (cleared) toast.info(`${cleared} cliente(s) ficaram sem responsável`);
    }
    setProfiles((current) => current.map((item) => item.id === member.id ? { ...item, status: nextStatus } : item));
    toast.success(nextStatus === "active" ? "Usuário reativado" : "Usuário desativado");
  };

  const openAccessEditor = (member: ProfileRow) => {
    setAccessMember(member);
    setAccessRole(member.account_type as "admin" | "collaborator");
    setAccessDialogOpen(true);
  };

  const saveAccess = async () => {
    if (!tenantId || !accessMember || profile?.account_type !== "admin") return;
    const { data, error } = await supabase
      .from("profiles")
      .update({
        account_type: accessRole,
        company_id: null,
      })
      .eq("id", accessMember.id)
      .eq("tenant_id", tenantId)
      .select("id, user_id, full_name, phone, job_title, avatar_url, account_type, company_id, status, created_at")
      .maybeSingle();
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível atualizar o acesso.");
      return;
    }
    setProfiles((current) => current.map((member) => member.id === accessMember.id ? data as ProfileRow : member));
    setAccessDialogOpen(false);
    toast.success("Acesso atualizado com sucesso");
  };

  const openMemberEditor = (member: ProfileRow) => {
    setEditingMember(member);
    setEditForm({
      fullName: member.full_name ?? "",
      jobTitle: member.job_title ?? "",
      phone: member.phone ?? "",
    });
    setEditDialogOpen(true);
  };

  const saveMemberDetails = async () => {
    if (!tenantId || !editingMember || profile?.account_type !== "admin") return;
    const fullName = editForm.fullName.trim();
    if (!fullName) {
      toast.error("Informe o nome do colaborador");
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        job_title: editForm.jobTitle.trim() || null,
        phone: editForm.phone.trim() || null,
      })
      .eq("id", editingMember.id)
      .eq("tenant_id", tenantId)
      .select("id, user_id, full_name, phone, job_title, avatar_url, account_type, company_id, status, created_at")
      .maybeSingle();
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível editar o colaborador.");
      return;
    }
    setProfiles((current) => current.map((member) => member.id === data.id ? data as ProfileRow : member));
    setEditDialogOpen(false);
    toast.success("Dados do colaborador atualizados");
  };

  const updateClientResponsibility = async (clientId: string, assigned: boolean) => {
    if (!selectedMember) return;
    const ok = await updateClient(
      clientId,
      assigned
        ? { responsibleUserId: selectedMember.user_id, responsibleUserName: selectedMember.full_name || "Sem nome" }
        : { responsibleUserId: "", responsibleUserName: "" },
    );
    if (ok) toast.success(assigned ? "Responsabilidade atribuída" : "Responsabilidade removida");
  };

  const assignTask = (taskId: string, checked: boolean) => {
    if (!selectedMember) return;
    const task = tasks.find((item) => item.id === taskId);
    if (task?.status === "completed") {
      toast.error("Tarefas concluídas não podem ser atribuídas. Reabra a tarefa antes de alterar o responsável.");
      return;
    }
    updateTask(taskId, checked
      ? { assignedToId: selectedMember.user_id, assignedToName: selectedMember.full_name || "Sem nome" }
      : { assignedToId: "", assignedToName: "Sem responsável" }
    );
  };

  const activeMembers = members.filter((member) => member.status === "active");
  const collaborators = members.filter((member) => member.account_type === "collaborator");
  const permissionMember = collaborators.find((member) => member.user_id === permissionMemberId) ?? collaborators[0] ?? null;
  const selectedPermissions = normalizePermissionMatrix(
    memberPermissions.find((item) => item.user_id === permissionMember?.user_id)?.permissions ?? defaultPermissionMatrix as unknown as Json,
  );
  const pendingInvites = invites.filter((invite) => invite.status === "pending");

  const setPermission = (resource: PermissionKey, action: PermissionAction, enabled: boolean) => {
    if (!permissionMember) return;
    setMemberPermissions((current) => {
      const existing = current.find((item) => item.user_id === permissionMember.user_id);
      const permissions = normalizePermissionMatrix(existing?.permissions ?? defaultPermissionMatrix as unknown as Json);
      permissions[resource][action] = enabled;
      const next: PermissionRow = existing
        ? { ...existing, permissions: permissions as unknown as Json }
        : { tenant_id: tenantId ?? "", user_id: permissionMember.user_id, permissions: permissions as unknown as Json, updated_at: new Date().toISOString(), updated_by: user?.id ?? null };
      return [...current.filter((item) => item.user_id !== permissionMember.user_id), next];
    });
  };

  const savePermissions = async () => {
    if (!tenantId || !permissionMember || profile?.account_type !== "admin") return;
    const { data, error } = await supabase
      .from("workspace_member_permissions")
      .upsert({ tenant_id: tenantId, user_id: permissionMember.user_id, permissions: selectedPermissions as unknown as Json, updated_by: user?.id ?? null }, { onConflict: "tenant_id,user_id" })
      .select("tenant_id, user_id, permissions, updated_at, updated_by")
      .maybeSingle();
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível salvar permissões.");
      return;
    }
    setMemberPermissions((current) => [...current.filter((item) => item.user_id !== data.user_id), data as PermissionRow]);
    toast.success(`Permissões de ${permissionMember.full_name || "colaborador"} atualizadas`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="page-header flex items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-[28px] font-normal tracking-[-0.035em]">Equipe e acessos</h1>
            <p className="text-muted-foreground">Convide usuários, acompanhe papéis e controle vínculos por cliente</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />Novo convite</Button>
            </DialogTrigger>
            <DialogContent className="dialog-window staff-dialog sm:max-w-[460px]">
              <DialogHeader className="dialog-header">
                <DialogTitle>Criar convite</DialogTitle>
                <DialogDescription>O link criado pode ser enviado ao colaborador ou cliente.</DialogDescription>
              </DialogHeader>
              <div className="dialog-body custom-scroll grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="invite-full-name">Nome</Label>
                  <Input id="invite-full-name" name="full-name" autoComplete="name" value={inviteForm.fullName} onChange={(event) => setInviteForm({ ...inviteForm, fullName: event.target.value })} placeholder="Nome completo" className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invite-email">E-mail</Label>
                  <Input id="invite-email" name="email" autoComplete="email" type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} placeholder="email@empresa.com" className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invite-account-type">Tipo de acesso</Label>
                  <Select value={inviteForm.accountType} onValueChange={(value: InviteForm["accountType"]) => setInviteForm({ ...inviteForm, accountType: value, companyId: "" })}>
                    <SelectTrigger id="invite-account-type" className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collaborator">Colaborador</SelectItem>
                      <SelectItem value="client">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {inviteForm.accountType === "client" && (
                  <div className="grid gap-2">
                    <Label htmlFor="invite-company">Empresa vinculada</Label>
                    <Select value={inviteForm.companyId} onValueChange={(value) => setInviteForm({ ...inviteForm, companyId: value })}>
                      <SelectTrigger id="invite-company" className="rounded-xl"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.filter((client) => client.status === "active").map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter className="dialog-footer">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                <Button onClick={handleInvite} className="rounded-xl">Criar convite</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <BentoStatStrip
          className="animate-fade-in"
          items={[
            { label: "Equipe", value: members.length, icon: UserCog, compact: true },
            { label: "Ativos", value: activeMembers.length, icon: ShieldCheck, compact: true },
            { label: "Convites", value: pendingInvites.length, icon: UserPlus, compact: true },
            { label: "Acessos cliente", value: clientsProfiles.length, icon: CheckSquare, compact: true },
          ]}
        />

        <Tabs defaultValue="people" className="animate-fade-in">
          <TabsList>
            <TabsTrigger value="people">Equipe</TabsTrigger>
            <TabsTrigger value="invites">Convites</TabsTrigger>
            <TabsTrigger value="capacity">Capacidade</TabsTrigger>
            <TabsTrigger value="perms">Permissões</TabsTrigger>
          </TabsList>

          <TabsContent value="people" className="mt-4">
            <div className="glass page-section">
              <div className="filter-toolbar mb-6 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="staff-search"
                    autoComplete="off"
                    aria-label="Buscar colaboradores"
                    placeholder="Buscar por nome, cargo ou papel…"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-10 rounded-xl"
                  />
                </div>
                <Badge variant="secondary" className="px-3 py-1.5">{filteredMembers.length} membros</Badge>
                <div className="ml-auto flex rounded-full border border-border bg-card p-1">
                  <IconTooltipButton icon={Grid2X2} label="Grade" variant={peopleViewMode === "grid" ? "default" : "ghost"} aria-pressed={peopleViewMode === "grid"} onClick={() => setPeopleViewMode("grid")} />
                  <IconTooltipButton icon={List} label="Lista" variant={peopleViewMode === "list" ? "default" : "ghost"} aria-pressed={peopleViewMode === "list"} onClick={() => setPeopleViewMode("list")} />
                </div>
              </div>

              {peopleViewMode === "list" ? (
                <BentoDataTable
                  rows={filteredMembers}
                  getRowKey={(member) => member.id}
                  empty={<span>Nenhum membro encontrado.</span>}
                  columns={[
                    {
                      key: "member",
                      label: "Colaborador",
                      render: (member) => {
                        const name = member.full_name || "Sem nome";
                        return (
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-9 w-9 shrink-0 ring-2 ring-gilver/30">
                              <AvatarImage src={member.avatar_url ?? undefined} />
                              <AvatarFallback className="bg-gilver/15 text-xs font-medium text-gilver">{initials(name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate font-medium">{name}</p>
                              <p className="max-w-[220px] truncate text-xs text-muted-foreground">{roleLabel(member.account_type)}</p>
                            </div>
                          </div>
                        );
                      },
                    },
                    {
                      key: "jobTitle",
                      label: "Cargo",
                      render: (member) => <span className="block max-w-[180px] truncate text-sm text-muted-foreground">{member.job_title || "—"}</span>,
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (member) => <Badge className={cn("text-[10px]", member.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>{member.status === "active" ? "Ativo" : "Inativo"}</Badge>,
                    },
                    {
                      key: "tasks",
                      label: "Tarefas",
                      sortValue: (member) => tasks.filter((task) => task.assignedToId === member.user_id).length,
                      render: (member) => {
                        const memberTasks = tasks.filter((task) => task.assignedToId === member.user_id);
                        const completed = memberTasks.filter((task) => task.status === "completed").length;
                        const progress = memberTasks.length ? Math.round((completed / memberTasks.length) * 100) : 0;
                        return (
                          <div className="w-[140px] space-y-1">
                            <div className="flex justify-between gap-2 text-[10px] text-muted-foreground"><span>{completed}/{memberTasks.length} concluídas</span><span>{progress}%</span></div>
                            <Progress value={progress} className="h-1.5" />
                          </div>
                        );
                      },
                    },
                    {
                      key: "created",
                      label: "Desde",
                      sortValue: (member) => member.created_at ? new Date(member.created_at) : null,
                      render: (member) => <span className="whitespace-nowrap text-sm text-muted-foreground">{member.created_at ? new Date(member.created_at).toLocaleDateString("pt-BR") : "—"}</span>,
                    },
                  ]}
                  actions={(member) => {
                    const name = member.full_name || "Sem nome";
                    return (
                      <RowActions
                        primaryLabel={`Abrir detalhes de ${name}`}
                        primaryIcon={Eye}
                        onPrimary={() => setDetailMember(member)}
                        menuItems={[
                          { label: "Atribuir tarefas", icon: CheckSquare, onSelect: () => { setSelectedMember(member); setAssignDialogOpen(true); } },
                          ...(member.user_id !== profile?.user_id && profile?.account_type === "admin" ? [{ label: "Atribuir clientes", icon: Building2, onSelect: () => { setSelectedMember(member); setClientAssignmentOpen(true); } }] : []),
                          ...(member.user_id !== profile?.user_id && profile?.account_type === "admin" ? [{ label: "Editar colaborador", icon: Pencil, onSelect: () => openMemberEditor(member) }, { label: "Editar acesso", icon: Shield, onSelect: () => openAccessEditor(member) }] : []),
                          ...(member.user_id !== profile?.user_id ? [{ label: member.status === "active" ? "Desativar acesso" : "Ativar acesso", icon: ShieldAlert, onSelect: () => void toggleStatus(member) }] : []),
                        ]}
                      />
                    );
                  }}
                />
              ) : (
              <div className={cn("overflow-hidden rounded-2xl border border-border/70 bg-border/70", "grid gap-px", getBentoGridClass(filteredMembers.length))}>
                {filteredMembers.map((member) => {
                  const memberTasks = tasks.filter((task) => task.assignedToId === member.user_id);
                  const completed = memberTasks.filter((task) => task.status === "completed").length;
                  const name = member.full_name || "Sem nome";
                  return (
                    <div
                      key={member.id}
                      className="flex flex-col gap-3 bg-card p-4 transition-colors duration-200 hover:bg-accent/30"
                    >
                      <button
                        type="button"
                        className={cn("w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2", peopleViewMode === "grid" ? "flex flex-col gap-3" : "grid items-center gap-3 md:grid-cols-[minmax(230px,1.2fr)_minmax(170px,0.8fr)_minmax(110px,0.5fr)]")}
                        onClick={() => setDetailMember(member)}
                        aria-label={`Abrir detalhes de ${name}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-11 w-11 ring-2 ring-gilver/30">
                              <AvatarImage src={member.avatar_url ?? undefined} />
                              <AvatarFallback className="bg-gilver/15 font-medium text-gilver">{initials(name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate font-medium">{name}</p>
                                {member.account_type === "admin" && <Shield className="h-3.5 w-3.5 shrink-0 text-gilver" />}
                              </div>
                              <p className="truncate text-xs text-muted-foreground">{roleLabel(member.account_type)}</p>
                            </div>
                          </div>
                          <Badge className={cn("shrink-0 py-0.5 text-[10px]", member.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                            {member.status === "active" ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>

                        <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
                          <p className="truncate"><span className="font-medium text-foreground">Cargo:</span> {member.job_title || "—"}</p>
                          <p className="truncate"><span className="font-medium text-foreground">Telefone:</span> {member.phone || "—"}</p>
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-xs">
                          <span className="text-muted-foreground">Tarefas</span>
                          <span className="font-medium">{completed}/{memberTasks.length}</span>
                        </div>
                      </button>

                      <div className="flex justify-end border-t border-border/70 pt-3">
                        <RowActions
                          primaryLabel={`Abrir detalhes de ${name}`}
                          primaryIcon={Eye}
                          onPrimary={() => setDetailMember(member)}
                          menuItems={[
                            { label: "Atribuir tarefas", icon: CheckSquare, onSelect: () => { setSelectedMember(member); setAssignDialogOpen(true); } },
                            ...(member.user_id !== profile?.user_id && profile?.account_type === "admin" ? [{ label: "Atribuir clientes", icon: Building2, onSelect: () => { setSelectedMember(member); setClientAssignmentOpen(true); } }] : []),
                            ...(member.user_id !== profile?.user_id && profile?.account_type === "admin" ? [{ label: "Editar colaborador", icon: Pencil, onSelect: () => openMemberEditor(member) }, { label: "Editar acesso", icon: Shield, onSelect: () => openAccessEditor(member) }] : []),
                            ...(member.user_id !== profile?.user_id ? [{ label: member.status === "active" ? "Desativar acesso" : "Ativar acesso", icon: ShieldAlert, onSelect: () => void toggleStatus(member) }] : []),
                          ]}
                        />
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
              )}
            </div>
          </TabsContent>

          <TabsContent value="invites" className="mt-4">
            <div className="glass page-section space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-medium">Convites enviados</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Acompanhe destinatário, vínculo, status e validade do acesso.</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="relative min-w-[210px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      value={inviteSearch}
                      onChange={(event) => setInviteSearch(event.target.value)}
                      placeholder="Buscar convite…"
                      aria-label="Buscar convites"
                      className="h-9 rounded-lg border-border/70 bg-card/80 pl-9 text-xs"
                    />
                  </div>
                  <FilterPopover
                    title="Filtrar convites"
                    activeCount={inviteStatusFilters.length + inviteAccessFilters.length}
                    onClear={() => { setInviteStatusFilters([]); setInviteAccessFilters([]); }}
                  >
                    <MultiSelectFilter
                      label="Status"
                      options={[{ value: "pending", label: "Pendentes" }, { value: "accepted", label: "Aceitos" }, { value: "revoked", label: "Revogados" }]}
                      value={inviteStatusFilters}
                      onChange={setInviteStatusFilters}
                    />
                    <MultiSelectFilter
                      label="Tipo de acesso"
                      options={[{ value: "collaborator", label: "Colaboradores" }, { value: "client", label: "Clientes" }]}
                      value={inviteAccessFilters}
                      onChange={setInviteAccessFilters}
                    />
                  </FilterPopover>
                  <Badge variant="secondary">{filteredInvites.length} registros</Badge>
                </div>
              </div>
              <BentoDataTable
                rows={filteredInvites}
                getRowKey={(invite) => invite.id}
                empty={<span>Nenhum convite criado ainda.</span>}
                columns={[
                  {
                    key: "recipient",
                    label: "Destinatário",
                    render: (invite) => <div className="min-w-0"><p className="max-w-[230px] truncate font-medium">{invite.full_name || invite.email}</p><p className="max-w-[230px] truncate text-xs text-muted-foreground">{invite.email}</p></div>,
                  },
                  {
                    key: "access",
                    label: "Acesso",
                    render: (invite) => <span className="text-sm text-muted-foreground">{roleLabel(invite.account_type)}</span>,
                  },
                  {
                    key: "company",
                    label: "Vínculo",
                    render: (invite) => <span className="block max-w-[190px] truncate text-sm text-muted-foreground">{invite.company_id ? clients.find((client) => client.id === invite.company_id)?.name ?? "Cliente vinculado" : "Workspace"}</span>,
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (invite) => <Badge variant={invite.status === "pending" ? "secondary" : "outline"}>{invite.status === "pending" ? "Pendente" : invite.status === "accepted" ? "Aceito" : "Revogado"}</Badge>,
                  },
                  {
                    key: "created",
                    label: "Criado em",
                    sortValue: (invite) => invite.created_at ? new Date(invite.created_at) : null,
                    render: (invite) => <span className="whitespace-nowrap text-sm text-muted-foreground">{invite.created_at ? new Date(invite.created_at).toLocaleDateString("pt-BR") : "—"}</span>,
                  },
                ]}
                actions={(invite) => (
                  <RowActions
                    primaryLabel={invite.status === "pending" ? "Copiar link do convite" : "Copiar referência"}
                    primaryIcon={Copy}
                    onPrimary={() => void copyInviteLink(invite.token)}
                    primaryDisabled={invite.status !== "pending"}
                    menuItems={invite.status === "pending" ? [
                      { label: "Copiar link", icon: Copy, onSelect: () => void copyInviteLink(invite.token) },
                      { label: "Revogar convite", icon: ShieldAlert, destructive: true, separatorBefore: true, onSelect: () => setRevokeTarget(invite) },
                    ] : []}
                  />
                )}
              />
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
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-2 min-w-[240px]">
                  <Label htmlFor="permission-member">Colaborador</Label>
                  <Select value={permissionMember?.user_id ?? ""} onValueChange={setPermissionMemberId}>
                    <SelectTrigger id="permission-member" className="rounded-xl"><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
                    <SelectContent>
                      {collaborators.map((member) => <SelectItem key={member.user_id} value={member.user_id}>{member.full_name || "Sem nome"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="max-w-md text-sm text-muted-foreground">Administradores têm acesso total. As permissões abaixo afetam este colaborador no banco e na interface.</p>
              </div>
              {!permissionMember ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há colaboradores para configurar.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2 pr-4">Módulo</th>{permissionActions.map((action) => <th key={action.key} className="px-3 py-2 text-center">{action.label}</th>)}</tr></thead>
                    <tbody>{(Object.entries(permissionLabels) as [PermissionKey, string][]).map(([resource, label]) => <tr key={resource} className="border-b border-border/50"><td className="py-3 pr-4 font-medium">{label}</td>{permissionActions.map((action) => <td key={action.key} className="px-3 py-3 text-center"><Checkbox checked={selectedPermissions[resource][action.key]} onCheckedChange={(checked) => setPermission(resource, action.key, checked === true)} aria-label={`${action.label} ${label}`} /></td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end"><Button className="rounded-xl" disabled={!permissionMember || profile?.account_type !== "admin"} onClick={() => void savePermissions()}>Salvar permissões</Button></div>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="dialog-window staff-dialog sm:max-w-[480px]">
            <DialogHeader className="dialog-header">
              <DialogTitle>Atribuir tarefas</DialogTitle>
              <DialogDescription>{selectedMember?.full_name || "Usuário selecionado"}</DialogDescription>
            </DialogHeader>
            {selectedMember && (
              <div className="dialog-body custom-scroll max-h-[420px] space-y-2">
                {tasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa cadastrada.</p>}
                {tasks.map((task) => {
                  const checked = task.assignedToId === selectedMember.user_id;
                  const disabled = task.status === "completed";
                  return (
                    <label key={task.id} className={cn("flex items-start gap-3 rounded-xl border border-border p-3 hover:bg-accent/40", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
                      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => assignTask(task.id, !!value)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{task.clientName ?? "Sem cliente"} · {disabled ? "Concluída" : task.status}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <DialogFooter className="dialog-footer">
              <Button onClick={() => setAssignDialogOpen(false)} className="rounded-xl">Concluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(detailMember)} onOpenChange={(open) => !open && setDetailMember(null)}>
          <DialogContent className="dialog-window staff-dialog sm:max-w-[540px]">
            {detailMember && (
              <>
                <DialogHeader className="dialog-header">
                  <DialogTitle>{detailMember.full_name || "Sem nome"}</DialogTitle>
                  <DialogDescription>{roleLabel(detailMember.account_type)}</DialogDescription>
                </DialogHeader>
                <div className="dialog-body custom-scroll grid gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-2 ring-gilver/30">
                      <AvatarImage src={detailMember.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-gilver/15 text-gilver font-medium">{initials(detailMember.full_name || "Sem nome")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <Badge className={cn("text-[10px]", detailMember.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                        {detailMember.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><p className="text-xs text-muted-foreground">Cargo</p><p className="font-medium">{detailMember.job_title || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Telefone</p><p className="font-medium">{detailMember.phone || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Tarefas atribuídas</p><p className="font-medium">{tasks.filter((task) => task.assignedToId === detailMember.user_id).length}</p></div>
                    <div><p className="text-xs text-muted-foreground">Clientes responsáveis</p><p className="font-medium">{clients.filter((client) => client.responsibleUserId === detailMember.user_id).length}</p></div>
                  </div>
                </div>
                <DialogFooter className="dialog-footer flex-col gap-2 sm:flex-row sm:justify-between">
                  {detailMember.user_id !== profile?.user_id && (
                    <Button variant={detailMember.status === "active" ? "destructive" : "default"} className="rounded-xl" onClick={() => { void toggleStatus(detailMember); setDetailMember(null); }}>
                      <ShieldAlert className="mr-2 h-4 w-4" />{detailMember.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => { setSelectedMember(detailMember); setDetailMember(null); setAssignDialogOpen(true); }}>
                      <CheckSquare className="mr-2 h-4 w-4" />Tarefas
                    </Button>
                    {detailMember.user_id !== profile?.user_id && profile?.account_type === "admin" && (
                      <>
                        <Button variant="outline" className="rounded-xl" onClick={() => { setSelectedMember(detailMember); setDetailMember(null); setClientAssignmentOpen(true); }}>
                          <Building2 className="mr-2 h-4 w-4" />Clientes
                        </Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => { setDetailMember(null); openAccessEditor(detailMember); }}>
                          Acesso
                        </Button>
                        <Button className="rounded-xl" onClick={() => { setDetailMember(null); openMemberEditor(detailMember); }}>
                          <Pencil className="mr-2 h-4 w-4" />Editar
                        </Button>
                      </>
                    )}
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={clientAssignmentOpen} onOpenChange={setClientAssignmentOpen}>
          <DialogContent className="dialog-window staff-dialog sm:max-w-[520px]">
            <DialogHeader className="dialog-header">
              <DialogTitle>Atribuir clientes</DialogTitle>
              <DialogDescription>{selectedMember?.full_name || "Colaborador selecionado"}. Cada cliente possui um responsável por vez.</DialogDescription>
            </DialogHeader>
            {selectedMember && (
              <div className="dialog-body custom-scroll max-h-[420px] space-y-2">
                {clients.filter((client) => client.status === "active").length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cliente ativo cadastrado.</p>}
                {clients.filter((client) => client.status === "active").map((client) => {
                  const checked = client.responsibleUserId === selectedMember.user_id;
                  return (
                    <label key={client.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 hover:bg-accent/40">
                      <Checkbox checked={checked} onCheckedChange={(value) => void updateClientResponsibility(client.id, value === true)} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{client.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{checked ? "Responsável atual" : client.responsibleUserName ? `Responsável atual: ${client.responsibleUserName}` : "Sem responsável"}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <DialogFooter className="dialog-footer"><Button onClick={() => setClientAssignmentOpen(false)} className="rounded-xl">Concluir</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="dialog-window staff-dialog sm:max-w-[440px]">
            <DialogHeader className="dialog-header">
              <DialogTitle>Editar colaborador</DialogTitle>
              <DialogDescription>Atualize os dados profissionais do membro da equipe.</DialogDescription>
            </DialogHeader>
            <div className="dialog-body custom-scroll grid gap-4">
              <div className="grid gap-2"><Label htmlFor="edit-member-name">Nome completo</Label><Input id="edit-member-name" name="full-name" autoComplete="name" value={editForm.fullName} onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })} className="rounded-xl" /></div>
              <div className="grid gap-2"><Label htmlFor="edit-member-job">Cargo</Label><Input id="edit-member-job" name="organization-title" value={editForm.jobTitle} onChange={(event) => setEditForm({ ...editForm, jobTitle: event.target.value })} className="rounded-xl" /></div>
              <div className="grid gap-2"><Label htmlFor="edit-member-phone">Telefone</Label><Input id="edit-member-phone" name="tel" autoComplete="tel" type="tel" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} className="rounded-xl" /></div>
            </div>
            <DialogFooter className="dialog-footer"><Button variant="outline" className="rounded-xl" onClick={() => setEditDialogOpen(false)}>Cancelar</Button><Button className="rounded-xl" onClick={() => void saveMemberDetails()}>Salvar dados</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
          <DialogContent className="dialog-window staff-dialog sm:max-w-[440px]">
            <DialogHeader className="dialog-header">
              <DialogTitle>Editar acesso</DialogTitle>
              <DialogDescription>{accessMember?.full_name || "Usuário selecionado"}</DialogDescription>
            </DialogHeader>
            <div className="dialog-body custom-scroll grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="access-role">Papel</Label>
                <Select value={accessRole} onValueChange={(value: "admin" | "collaborator") => setAccessRole(value)}>
                  <SelectTrigger id="access-role" className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="collaborator">Colaborador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="dialog-footer">
              <Button variant="outline" className="rounded-xl" onClick={() => setAccessDialogOpen(false)}>Cancelar</Button>
              <Button className="rounded-xl" onClick={saveAccess}>Salvar acesso</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDestructiveDialog
          open={Boolean(revokeTarget)}
          onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}
          title="Revogar convite?"
          description={revokeTarget ? `O convite para ${revokeTarget.email} deixará de funcionar e não poderá mais ser aceito.` : ""}
          confirmLabel="Revogar convite"
          onConfirm={async () => {
            if (!revokeTarget) return false;
            const success = await revokeInvite(revokeTarget.id);
            if (success) setRevokeTarget(null);
            return success;
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default Staff;
