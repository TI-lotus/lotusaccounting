import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Users, Plus, Search, MoreHorizontal, Mail, Phone, Edit, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: "active" | "pending" | "inactive";
  revenue: string;
  invoices: number;
}

const initialClients: Client[] = [
  { id: 1, name: "Acme Corporation", email: "billing@acme.com", phone: "(11) 99999-1234", status: "active", revenue: "R$ 45.200", invoices: 12 },
  { id: 2, name: "TechStart Inc", email: "finance@techstart.io", phone: "(11) 98888-5678", status: "active", revenue: "R$ 32.100", invoices: 8 },
  { id: 3, name: "Global Finance Ltd", email: "accounts@globalfinance.com", phone: "(21) 97777-9012", status: "pending", revenue: "R$ 28.500", invoices: 15 },
  { id: 4, name: "Innovation Labs", email: "hello@innovationlabs.co", phone: "(11) 96666-3456", status: "active", revenue: "R$ 18.900", invoices: 5 },
  { id: 5, name: "Sunrise Media", email: "billing@sunrisemedia.net", phone: "(31) 95555-7890", status: "inactive", revenue: "R$ 12.400", invoices: 3 },
  { id: 6, name: "DataFlow Systems", email: "contato@dataflow.com.br", phone: "(11) 94444-1234", status: "active", revenue: "R$ 67.800", invoices: 21 },
  { id: 7, name: "Verde Soluções", email: "financeiro@verdesolucoes.com", phone: "(19) 93333-5678", status: "active", revenue: "R$ 23.100", invoices: 7 },
  { id: 8, name: "Nexus Tecnologia", email: "admin@nexustec.io", phone: "(11) 92222-9012", status: "pending", revenue: "R$ 41.500", invoices: 11 },
];

const Clients = () => {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "" });

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddClient = () => {
    if (!newClient.name || !newClient.email) {
      toast.error("Preencha nome e email do cliente");
      return;
    }

    const client: Client = {
      id: Date.now(),
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone || "(00) 00000-0000",
      status: "pending",
      revenue: "R$ 0",
      invoices: 0,
    };

    setClients([client, ...clients]);
    setNewClient({ name: "", email: "", phone: "" });
    setDialogOpen(false);
    toast.success("Cliente adicionado com sucesso!");
  };

  const handleDeleteClient = (id: number) => {
    setClients(clients.filter((c) => c.id !== id));
    toast.success("Cliente removido com sucesso!");
  };

  const handleStatusChange = (id: number, status: Client["status"]) => {
    setClients(clients.map((c) => (c.id === id ? { ...c, status } : c)));
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
                  <Input
                    id="name"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="Empresa Ltda"
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="contato@empresa.com"
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
                  Cancelar
                </Button>
                <Button onClick={handleAddClient} className="rounded-xl">
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl"
              />
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
                </div>
                <div className="hidden md:block text-right">
                  <p className="font-semibold">{client.revenue}</p>
                  <p className="text-xs text-muted-foreground">{client.invoices} faturas</p>
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
                    <DropdownMenuItem className="gap-2">
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
