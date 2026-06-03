import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { UserCog, Plus, Search, MoreHorizontal, Mail, Phone, Shield, ShieldCheck, ShieldAlert, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "collaborator";
  department: string;
  status: "active" | "inactive";
  tasksAssigned: number;
  tasksCompleted: number;
  permissions: {
    clients: boolean;
    payments: boolean;
    documents: boolean;
    reports: boolean;
    integrations: boolean;
    agents: boolean;
  };
}

const initialStaff: StaffMember[] = [
  { id: "u1", name: "John Doe", email: "john@lotus.com", phone: "(11) 99999-0001", role: "admin", department: "Diretoria", status: "active", tasksAssigned: 12, tasksCompleted: 8, permissions: { clients: true, payments: true, documents: true, reports: true, integrations: true, agents: true } },
  { id: "u2", name: "Ana Costa", email: "ana@lotus.com", phone: "(11) 99999-0002", role: "collaborator", department: "Fiscal", status: "active", tasksAssigned: 25, tasksCompleted: 18, permissions: { clients: true, payments: false, documents: true, reports: true, integrations: false, agents: false } },
  { id: "u3", name: "Roberto Santos", email: "roberto@lotus.com", phone: "(11) 99999-0003", role: "collaborator", department: "Auditoria", status: "active", tasksAssigned: 15, tasksCompleted: 12, permissions: { clients: true, payments: true, documents: true, reports: true, integrations: false, agents: false } },
  { id: "u4", name: "Carlos Mendes", email: "carlos@lotus.com", phone: "(11) 99999-0004", role: "collaborator", department: "Contábil", status: "active", tasksAssigned: 20, tasksCompleted: 14, permissions: { clients: true, payments: false, documents: true, reports: false, integrations: false, agents: false } },
  { id: "u5", name: "Maria Silva", email: "maria@lotus.com", phone: "(11) 99999-0005", role: "collaborator", department: "RH", status: "inactive", tasksAssigned: 8, tasksCompleted: 8, permissions: { clients: false, payments: false, documents: true, reports: false, integrations: false, agents: false } },
];

const Staff = () => {
  const { tasks, updateTask } = useData();
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);
  const [newMember, setNewMember] = useState({ name: "", email: "", phone: "", role: "collaborator" as "admin" | "collaborator", department: "" });

  const filteredStaff = staff.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load persisted users on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("users").select("id, name, role, created_at");
      if (cancelled || !data?.length) return;
      const dbStaff: StaffMember[] = data.map((row) => ({
        id: row.id,
        name: row.name ?? "Sem nome",
        email: "",
        phone: "",
        role: (row.role === "admin" ? "admin" : "collaborator") as "admin" | "collaborator",
        department: "",
        status: "active",
        tasksAssigned: 0,
        tasksCompleted: 0,
        permissions: { clients: true, payments: false, documents: true, reports: false, integrations: false, agents: false },
      }));
      setStaff((prev) => {
        const ids = new Set(prev.map((s) => s.id));
        return [...dbStaff.filter((s) => !ids.has(s.id)), ...prev];
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAdd = async () => {
    if (!newMember.name || !newMember.email) {
      toast.error("Preencha nome e email");
      return;
    }
    const id = crypto.randomUUID();
    const member: StaffMember = {
      id,
      ...newMember,
      status: "active",
      tasksAssigned: 0,
      tasksCompleted: 0,
      permissions: { clients: true, payments: false, documents: true, reports: false, integrations: false, agents: false },
    };
    // Persist basic fields to users table (id, name, role).
    const { error } = await supabase.from("users").insert({ id, name: newMember.name, role: newMember.role });
    if (error) toast.error("Salvo apenas localmente: " + error.message);
    setStaff(prev => [member, ...prev]);
    setNewMember({ name: "", email: "", phone: "", role: "collaborator", department: "" });
    setDialogOpen(false);
    toast.success("Colaborador adicionado!");
  };

  const togglePermission = (memberId: string, perm: keyof StaffMember["permissions"]) => {
    setStaff(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      return { ...m, permissions: { ...m.permissions, [perm]: !m.permissions[perm] } };
    }));
    if (selectedMember?.id === memberId) {
      setSelectedMember(prev => prev ? { ...prev, permissions: { ...prev.permissions, [perm]: !prev.permissions[perm] } } : null);
    }
  };

  const toggleStatus = (id: string) => {
    setStaff(prev => prev.map(m => m.id === id ? { ...m, status: m.status === "active" ? "inactive" : "active" } : m));
    toast.success("Status atualizado!");
  };

  const permLabels: Record<keyof StaffMember["permissions"], string> = {
    clients: "Clientes",
    payments: "Pagamentos",
    documents: "Documentos",
    reports: "Relatórios",
    integrations: "Integrações",
    agents: "Agentes IA",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Colaboradores</h1>
            <p className="text-muted-foreground">Gerencie membros da equipe, tarefas e permissões</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />Adicionar Colaborador</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Novo Colaborador</DialogTitle>
                <DialogDescription>Adicione um membro à equipe.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Nome</Label><Input value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} placeholder="Nome completo" className="rounded-xl" /></div>
                <div className="grid gap-2"><Label>Email</Label><Input type="email" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} placeholder="email@lotus.com" className="rounded-xl" /></div>
                <div className="grid gap-2"><Label>Telefone</Label><Input value={newMember.phone} onChange={e => setNewMember({ ...newMember, phone: e.target.value })} placeholder="(11) 99999-0000" className="rounded-xl" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Cargo</Label>
                    <Select value={newMember.role} onValueChange={(v: "admin" | "collaborator") => setNewMember({ ...newMember, role: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="collaborator">Colaborador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Departamento</Label>
                    <Input value={newMember.department} onChange={e => setNewMember({ ...newMember, department: e.target.value })} placeholder="Ex: Fiscal" className="rounded-xl" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                <Button onClick={handleAdd} className="rounded-xl">Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gilver/10"><UserCog className="h-5 w-5 text-gilver" /></div>
            <div><p className="text-2xl font-semibold">{staff.length}</p><p className="text-sm text-muted-foreground">Total</p></div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10"><ShieldCheck className="h-5 w-5 text-emerald-500" /></div>
            <div><p className="text-2xl font-semibold">{staff.filter(m => m.status === "active").length}</p><p className="text-sm text-muted-foreground">Ativos</p></div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10"><ShieldAlert className="h-5 w-5 text-amber-500" /></div>
            <div><p className="text-2xl font-semibold">{staff.filter(m => m.role === "admin").length}</p><p className="text-sm text-muted-foreground">Admins</p></div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10"><CheckSquare className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-2xl font-semibold">{staff.reduce((s, m) => s + m.tasksAssigned, 0)}</p><p className="text-sm text-muted-foreground">Tarefas</p></div>
          </div>
        </div>

        {/* Search */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, email ou departamento..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 rounded-xl" />
            </div>
            <Badge variant="secondary" className="px-3 py-1.5">{filteredStaff.length} membros</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredStaff.map((member) => {
              const memberTasks = tasks.filter((t) => t.assignedToId === member.id);
              return (
                <div key={member.id} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-soft-lg transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-11 w-11 ring-2 ring-gilver/30">
                        <AvatarFallback className="bg-gilver/15 text-gilver font-medium">
                          {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium truncate">{member.name}</p>
                          {member.role === "admin" && <Shield className="h-3.5 w-3.5 text-gilver shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{member.role === "admin" ? "Administrador" : "Colaborador"}</p>
                      </div>
                    </div>
                    <Badge
                      className={cn("cursor-pointer text-[10px] py-0.5", member.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted text-muted-foreground")}
                      onClick={() => toggleStatus(member.id)}
                    >
                      {member.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" />{member.email || "—"}</p>
                    <p className="flex items-center gap-1.5 truncate"><Phone className="h-3 w-3 shrink-0" />{member.phone || "—"}</p>
                    <p className="truncate"><span className="font-medium text-foreground">Departamento:</span> {member.department || "—"}</p>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Tarefas</span>
                    <span className="font-medium">{member.tasksCompleted}/{member.tasksAssigned}</span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full rounded-xl justify-between">
                        <span className="flex items-center gap-2"><CheckSquare className="h-4 w-4" />Tarefas ({memberTasks.length})</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72 max-h-64 overflow-y-auto custom-scroll">
                      {memberTasks.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhuma tarefa atribuída</div>
                      ) : (
                        memberTasks.map((t) => (
                          <DropdownMenuItem key={t.id} className="flex-col items-start gap-0.5">
                            <p className="text-sm font-medium truncate w-full">{t.title}</p>
                            <p className="text-[10px] text-muted-foreground">{t.status} • {t.category}</p>
                          </DropdownMenuItem>
                        ))
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setSelectedMember(member); setAssignDialogOpen(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />Atribuir/Remover tarefa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-xl gap-1.5" onClick={() => { setSelectedMember(member); setPermDialogOpen(true); }}>
                      <Shield className="h-3.5 w-3.5" />Permissões
                    </Button>
                    <Button
                      variant={member.status === "active" ? "outline" : "default"}
                      size="sm"
                      className="flex-1 rounded-xl gap-1.5"
                      onClick={() => toggleStatus(member.id)}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {member.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              );
            })}

            {filteredStaff.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <UserCog className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum colaborador encontrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Permissions Dialog */}
        <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Permissões — {selectedMember?.name}</DialogTitle>
              <DialogDescription>Configure o acesso deste colaborador aos módulos.</DialogDescription>
            </DialogHeader>
            {selectedMember && (
              <div className="space-y-4 py-4">
                {(Object.keys(permLabels) as (keyof StaffMember["permissions"])[]).map(perm => (
                  <div key={perm} className="flex items-center justify-between">
                    <Label className="text-sm">{permLabels[perm]}</Label>
                    <Switch
                      checked={selectedMember.permissions[perm]}
                      onCheckedChange={() => togglePermission(selectedMember.id, perm)}
                    />
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Assign Tasks Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Atribuir Tarefas — {selectedMember?.name}</DialogTitle>
              <DialogDescription>
                Marque para atrelar o colaborador como responsável. Desmarque para removê-lo.
              </DialogDescription>
            </DialogHeader>
            {selectedMember && (
              <div className="max-h-[420px] overflow-y-auto custom-scroll space-y-2 py-2">
                {tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa cadastrada.</p>
                )}
                {tasks.map((task) => {
                  const isAssigned = task.assignedToId === selectedMember.id;
                  return (
                    <label
                      key={task.id}
                      className="flex items-start gap-3 rounded-xl border border-border p-3 hover:bg-accent/40 cursor-pointer"
                    >
                      <Checkbox
                        checked={isAssigned}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            updateTask(task.id, { assignedToId: selectedMember.id, assignedToName: selectedMember.name });
                            toast.success(`Tarefa atribuída a ${selectedMember.name}`);
                          } else {
                            updateTask(task.id, { assignedToId: "", assignedToName: "Sem responsável" });
                            toast.success(`${selectedMember.name} removido da tarefa`);
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {isAssigned ? "Atribuída a este colaborador" : `Responsável: ${task.assignedToName || "—"}`}
                        </p>
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
