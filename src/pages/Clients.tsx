import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Search, MoreHorizontal, Mail, Phone, Edit, Trash2, Eye } from "lucide-react";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "", email: "", phone: "", cnpj: "", taxRegime: "simples_nacional" as ClientData["taxRegime"],
    serviceFee: "", city: "", state: "",
  });

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cnpj.includes(searchTerm)
  );

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
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, email ou CNPJ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 rounded-xl" />
            </div>
            <Badge variant="secondary" className="px-3 py-1.5">
              {filteredClients.length} clientes
            </Badge>
          </div>

          <div className="space-y-3">
            {filteredClients.map((client, index) => (
              <div
                key={client.id}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Avatar className="h-11 w-11 ring-2 ring-accent">
                  <AvatarFallback className="bg-accent text-accent-foreground font-medium">
                    {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{client.name}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {client.email}
                    </span>
                    <span className="hidden md:flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {client.phone}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{client.cnpj}</Badge>
                    <Badge variant="outline" className="text-xs">{taxRegimeLabels[client.taxRegime]}</Badge>
                    <span className="text-xs text-muted-foreground hidden lg:inline">Responsável: {client.responsibleUserName}</span>
                  </div>
                </div>
                <div className="hidden md:block text-right">
                  <p className="font-semibold">R$ {client.serviceFee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">{client.city}/{client.state}</p>
                </div>
                <Badge
                  variant={client.status === 'active' ? 'default' : client.status === 'pending' ? 'secondary' : 'outline'}
                  className="capitalize cursor-pointer"
                  onClick={() => {
                    const nextStatus = client.status === 'active' ? 'inactive' : client.status === 'inactive' ? 'pending' : 'active';
                    handleStatusChange(client.id, nextStatus);
                  }}
                >
                  {client.status === 'active' ? 'Ativo' : client.status === 'pending' ? 'Pendente' : 'Inativo'}
                </Badge>
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
