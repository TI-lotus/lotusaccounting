import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, MapPin, Building2, Edit, Save, X, FileText, CheckSquare, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { ClientData } from "@/types";

const taxRegimeLabels: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
};

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, updateClient, documents, tasks } = useData();

  const client = clients.find(c => c.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<ClientData>>({});

  if (!client) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cliente não encontrado</p>
          <Button variant="link" onClick={() => navigate("/clients")}>Voltar para Clientes</Button>
        </div>
      </DashboardLayout>
    );
  }

  const clientDocuments = documents.filter(d => d.clientId === client.id);
  const clientTasks = tasks.filter(t => t.clientId === client.id);

  const startEditing = () => {
    setEditData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      cnpj: client.cnpj,
      taxRegime: client.taxRegime,
      serviceFee: client.serviceFee,
      city: client.city,
      state: client.state,
    });
    setIsEditing(true);
  };

  const saveEditing = () => {
    updateClient(client.id, editData);
    setIsEditing(false);
    toast.success("Cliente atualizado com sucesso!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Button variant="ghost" size="icon" onClick={() => navigate("/clients")} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-muted-foreground">{client.cnpj}</p>
          </div>
          <Badge variant={client.status === 'active' ? 'default' : client.status === 'pending' ? 'secondary' : 'outline'}>
            {client.status === 'active' ? 'Ativo' : client.status === 'pending' ? 'Pendente' : 'Inativo'}
          </Badge>
          {isEditing ? (
            <div className="flex gap-2">
              <Button onClick={saveEditing} className="rounded-xl gap-2"><Save className="h-4 w-4" />Salvar</Button>
              <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-xl gap-2"><X className="h-4 w-4" />Cancelar</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={startEditing} className="rounded-xl gap-2"><Edit className="h-4 w-4" />Editar</Button>
          )}
        </div>

        <Tabs defaultValue="info" className="animate-fade-in">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="info" className="gap-2"><Building2 className="h-4 w-4" />Informações</TabsTrigger>
            <TabsTrigger value="documents" className="gap-2"><FileText className="h-4 w-4" />Documentos</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2"><CheckSquare className="h-4 w-4" />Tarefas</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Dados Cadastrais</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Nome da Empresa</Label>
                    {isEditing ? (
                      <Input value={editData.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="rounded-xl" />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">{client.name}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>CNPJ</Label>
                    {isEditing ? (
                      <Input value={editData.cnpj || ""} onChange={(e) => setEditData({ ...editData, cnpj: e.target.value })} className="rounded-xl" />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">{client.cnpj}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>Regime Tributário</Label>
                    {isEditing ? (
                      <Select value={editData.taxRegime} onValueChange={(v: ClientData["taxRegime"]) => setEditData({ ...editData, taxRegime: v })}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                          <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                          <SelectItem value="lucro_real">Lucro Real</SelectItem>
                          <SelectItem value="mei">MEI</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">{taxRegimeLabels[client.taxRegime]}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Contato e Financeiro</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1"><Mail className="h-3 w-3" />Email</Label>
                    {isEditing ? (
                      <Input value={editData.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="rounded-xl" />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">{client.email}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1"><Phone className="h-3 w-3" />Telefone</Label>
                    {isEditing ? (
                      <Input value={editData.phone || ""} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="rounded-xl" />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">{client.phone}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" />Cidade</Label>
                      {isEditing ? (
                        <Input value={editData.city || ""} onChange={(e) => setEditData({ ...editData, city: e.target.value })} className="rounded-xl" />
                      ) : (
                        <p className="text-sm p-2 bg-muted rounded-xl">{client.city}</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Estado</Label>
                      {isEditing ? (
                        <Input value={editData.state || ""} onChange={(e) => setEditData({ ...editData, state: e.target.value })} className="rounded-xl" />
                      ) : (
                        <p className="text-sm p-2 bg-muted rounded-xl">{client.state}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1"><CreditCard className="h-3 w-3" />Honorários</Label>
                    {isEditing ? (
                      <Input type="number" value={editData.serviceFee || 0} onChange={(e) => setEditData({ ...editData, serviceFee: parseFloat(e.target.value) })} className="rounded-xl" />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">R$ {client.serviceFee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-semibold">{clientDocuments.length}</p>
                    <p className="text-sm text-muted-foreground">Documentos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{clientTasks.length}</p>
                    <p className="text-sm text-muted-foreground">Tarefas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">R$ {client.serviceFee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    <p className="text-sm text-muted-foreground">Honorários/mês</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Documentos do Cliente</CardTitle></CardHeader>
              <CardContent>
                {clientDocuments.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhum documento encontrado para este cliente</p>
                ) : (
                  <div className="space-y-2">
                    {clientDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.date}</p>
                        </div>
                        <Badge variant="secondary">{doc.status === 'paid' ? 'Pago' : doc.status === 'pending' ? 'Pendente' : doc.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Tarefas do Cliente</CardTitle></CardHeader>
              <CardContent>
                {clientTasks.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma tarefa encontrada para este cliente</p>
                ) : (
                  <div className="space-y-2">
                    {clientTasks.map(task => (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors">
                        <CheckSquare className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">    {task.dueDate}</p>
                        </div>
                        <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                          {task.status === 'completed' ? '    Concluído' : task.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ClientDetail;
