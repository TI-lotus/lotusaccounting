import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Search, MoreHorizontal, Mail, Edit, Trash2, Eye, Grid2X2, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { ClientData } from "@/types";
import { cn } from "@/lib/utils";

const taxRegimeLabels: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
};

const Clients = () => {
  const navigate = useNavigate();
  const { clients, addClient, updateClient, deleteClient } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [feeRange, setFeeRange] = useState({ min: "", max: "" });
  const [contractSort, setContractSort] = useState("contract-desc");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "", email: "", phone: "", cnpj: "", taxRegime: "simples_nacional" as ClientData["taxRegime"],
    serviceFee: "", city: "", state: "",
  });

  const getClientSize = (client: ClientData) => {
    if (client.taxRegime === "mei") return "MEI";
    if (client.serviceFee >= 5000) return "Grande porte";
    if (client.serviceFee >= 3000) return "Médio porte";
    if (client.serviceFee >= 1500) return "EPP";
    return "ME";
  };
  const responsibles = Array.from(new Set(clients.map((client) => client.responsibleUserName)));

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cnpj.includes(searchTerm);
    const minFee = feeRange.min ? Number(feeRange.min) : null;
    const maxFee = feeRange.max ? Number(feeRange.max) : null;
    const matchesFee = (minFee === null || client.serviceFee >= minFee) && (maxFee === null || client.serviceFee <= maxFee);
    const matchesSize = sizeFilter === "all" || getClientSize(client) === sizeFilter;
    const matchesResponsible = responsibleFilter === "all" || client.responsibleUserName === responsibleFilter;
    return matchesSearch && matchesFee && matchesSize && matchesResponsible;
  }).sort((a, b) => {
    if (contractSort === "contract-asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleAddClient = () => {
    if (!newClient.name || !newClient.email) {
      toast.error("Preencha nome e email do cliente");
      return;
    }

    addClient({
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone || "(00) 00000-0000",
      cnpj: newClient.cnpj || "00.000.000/0001-00",
      taxRegime: newClient.taxRegime,
      responsibleUserId: "u2",
      responsibleUserName: "Ana Costa",
      serviceFee: parseFloat(newClient.serviceFee) || 0,
      city: newClient.city || "São Paulo",
      state: newClient.state || "SP",
      status: "pending",
    });

    setNewClient({ name: "", email: "", phone: "", cnpj: "", taxRegime: "simples_nacional", serviceFee: "", city: "", state: "" });
    setDialogOpen(false);
    toast.success("Cliente adicionado com sucesso!");
  };

  const handleDeleteClient = (id: string) => {
    deleteClient(id);
    toast.success("Cliente removido com sucesso!");
  };

  const handleStatusChange = (id: string, status: ClientData["status"]) => {
    updateClient(id, { status });
    toast.success("Status atualizado!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground">Gerencie seus relacionamentos com clientes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Novo Cliente</DialogTitle>
                <DialogDescription>
                  Adicione as informações do novo cliente abaixo.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome da Empresa</Label>
                  <Input id="name" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Empresa Ltda" className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input id="cnpj" value={newClient.cnpj} onChange={(e) => setNewClient({ ...newClient, cnpj: e.target.value })} placeholder="00.000.000/0001-00" className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="contato@empresa.com" className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="(11) 99999-9999" className="rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Regime Tributário</Label>
                    <Select value={newClient.taxRegime} onValueChange={(v: ClientData["taxRegime"]) => setNewClient({ ...newClient, taxRegime: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                        <SelectItem value="mei">MEI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fee">Honorários (R$)</Label>
                    <Input id="fee" type="number" value={newClient.serviceFee} onChange={(e) => setNewClient({ ...newClient, serviceFee: e.target.value })} placeholder="0,00" className="rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" value={newClient.city} onChange={(e) => setNewClient({ ...newClient, city: e.target.value })} placeholder="São Paulo" className="rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input id="state" value={newClient.state} onChange={(e) => setNewClient({ ...newClient, state: e.target.value })} placeholder="SP" className="rounded-xl" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                <Button onClick={handleAddClient} className="rounded-xl">Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, email ou CNPJ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 rounded-xl" />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-2 py-1">
              <span className="text-xs text-muted-foreground">Honorários</span>
              <Input inputMode="numeric" pattern="[0-9]*" value={feeRange.min} onChange={(e) => setFeeRange({ ...feeRange, min: e.target.value.replace(/\D/g, "") })} placeholder="Mín." className="h-8 w-20 rounded-lg" />
              <Input inputMode="numeric" pattern="[0-9]*" value={feeRange.max} onChange={(e) => setFeeRange({ ...feeRange, max: e.target.value.replace(/\D/g, "") })} placeholder="Máx." className="h-8 w-20 rounded-lg" />
            </div>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="w-[170px] rounded-xl"><SelectValue placeholder="Porte" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos portes</SelectItem>
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="ME">ME</SelectItem>
                <SelectItem value="EPP">EPP</SelectItem>
                <SelectItem value="Médio porte">Médio porte</SelectItem>
                <SelectItem value="Grande porte">Grande porte</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contractSort} onValueChange={setContractSort}>
              <SelectTrigger className="w-[180px] rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contract-desc">Contrato mais novo</SelectItem>
                <SelectItem value="contract-asc">Contrato mais antigo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="w-[190px] rounded-xl"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos responsáveis</SelectItem>{responsibles.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
            </Select>
            <Badge variant="secondary" className="px-3 py-1.5">
              {filteredClients.length} clientes
            </Badge>
            <div className="ml-auto flex rounded-xl border border-border bg-card p-1">
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" className="rounded-lg" onClick={() => setViewMode("grid")}><Grid2X2 className="h-4 w-4" />Grade</Button>
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="rounded-lg" onClick={() => setViewMode("list")}><List className="h-4 w-4" />Lista</Button>
            </div>
          </div>

          <div className={cn("grid gap-3", viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1")}>
            {filteredClients.map((client, index) => (
              <div
                key={client.id}
                className={cn("rounded-xl border border-border p-4 hover:bg-accent/40 transition-colors flex", viewMode === "grid" ? "flex-col" : "items-center gap-4")}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold truncate text-sm">{client.name}</p>
                  <Badge variant={client.status === 'active' ? 'default' : client.status === 'pending' ? 'secondary' : 'outline'} className={cn("text-[10px] shrink-0", client.status === 'active' && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400")}>{client.status === 'active' ? 'Ativo' : client.status === 'pending' ? 'Pendente' : 'Inativo'}</Badge>
                </div>
                <div className="mt-2 flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    <Badge variant="outline" className="text-[10px]">{taxRegimeLabels[client.taxRegime]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{getClientSize(client)}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 truncate">Resp.: {client.responsibleUserName}</p>
                </div>
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
                  <div><p className="font-semibold text-sm">R$ {client.serviceFee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-[10px] text-muted-foreground">{client.city}/{client.state}</p></div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-lg">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem className="gap-2" onClick={() => navigate(`/clients/${client.id}`)}>
                      <Eye className="h-4 w-4" />
                      Ver Detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2" onClick={() => navigate(`/clients/${client.id}`)}>
                      <Edit className="h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2">
                      <Mail className="h-4 w-4" />
                      Enviar Email
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-destructive focus:text-destructive"
                      onClick={() => handleDeleteClient(client.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
            ))}

            {filteredClients.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Clients;
