import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Search, MoreHorizontal, Mail, Phone, Edit, Trash2, Eye } from "lucide-react";
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
  const [sortBy, setSortBy] = useState("fee-desc");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "", email: "", phone: "", cnpj: "", taxRegime: "simples_nacional" as ClientData["taxRegime"],
    serviceFee: "", city: "", state: "",
  });

  const getClientSize = (fee: number) => fee >= 3000 ? "Grande" : fee >= 1500 ? "Médio" : "Pequeno";
  const responsibles = Array.from(new Set(clients.map((client) => client.responsibleUserName)));

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cnpj.includes(searchTerm);
    const matchesSize = sizeFilter === "all" || getClientSize(client.serviceFee) === sizeFilter;
    const matchesResponsible = responsibleFilter === "all" || client.responsibleUserName === responsibleFilter;
    return matchesSearch && matchesSize && matchesResponsible;
  }).sort((a, b) => {
    if (sortBy === "fee-asc") return a.serviceFee - b.serviceFee;
    if (sortBy === "fee-desc") return b.serviceFee - a.serviceFee;
    if (sortBy === "contract-asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[190px] rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fee-desc">Honorários maiores</SelectItem>
                <SelectItem value="fee-asc">Honorários menores</SelectItem>
                <SelectItem value="contract-desc">Contrato mais novo</SelectItem>
                <SelectItem value="contract-asc">Contrato mais antigo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="w-[150px] rounded-xl"><SelectValue placeholder="Porte" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos portes</SelectItem><SelectItem value="Grande">Grande</SelectItem><SelectItem value="Médio">Médio</SelectItem><SelectItem value="Pequeno">Pequeno</SelectItem></SelectContent>
            </Select>
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="w-[190px] rounded-xl"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos responsáveis</SelectItem>{responsibles.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
            </Select>
            <Badge variant="secondary" className="px-3 py-1.5">
              {filteredClients.length} clientes
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredClients.map((client, index) => (
              <div
                key={client.id}
                className="aspect-square rounded-2xl border border-border p-5 hover:bg-accent/40 transition-colors flex flex-col"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-accent">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(client.name)}`} />
                  <AvatarFallback className="bg-accent text-accent-foreground font-medium">
                    {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <Badge variant={client.status === 'active' ? 'default' : client.status === 'pending' ? 'secondary' : 'outline'}>{client.status === 'active' ? 'Ativo' : client.status === 'pending' ? 'Pendente' : 'Inativo'}</Badge>
                </div>
                <div className="mt-4 flex-1 min-w-0">
                  <p className="font-semibold truncate">{client.name}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3" />
                      {client.email}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">{client.cnpj}</Badge>
                    <Badge variant="outline" className="text-xs">{taxRegimeLabels[client.taxRegime]}</Badge>
                    <Badge variant="outline" className="text-xs">{getClientSize(client.serviceFee)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Responsável: {client.responsibleUserName}</p>
                  <p className="text-xs text-muted-foreground">Desde {new Date(client.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div><p className="font-semibold">R$ {client.serviceFee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground">{client.city}/{client.state}</p></div>
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
