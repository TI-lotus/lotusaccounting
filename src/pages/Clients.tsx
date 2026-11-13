import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Search, MoreHorizontal, Mail, Edit, Trash2, Eye, Grid2X2, List, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { ClientData } from "@/types";
import type { ClientPeriodStatus } from "@/types";
import { cn } from "@/lib/utils";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { FilterPopover } from "@/components/FilterPopover";
import { IconTooltipButton } from "@/components/IconTooltipButton";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { SortToggle } from "@/components/SortToggle";
import { getBentoGridClass } from "@/components/dashboard/bentoGrid";

const taxRegimeLabels: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
};

const serviceAreaOptions: { value: ClientData["serviceAreas"][number]; label: string }[] = [
  { value: "fiscal", label: "Fiscal" },
  { value: "contabil", label: "Contábil" },
  { value: "folha", label: "Folha" },
  { value: "financeiro_bpo", label: "Financeiro/BPO" },
  { value: "societario", label: "Societário" },
];

const periodStatusLabels: Record<ClientPeriodStatus | "not_created", string> = {
  not_created: "Sem competência",
  not_started: "Não iniciada",
  waiting_documents: "Aguardando documentos",
  in_progress: "Em execução",
  in_review: "Em revisão",
  delivered: "Entregue",
  closed: "Fechada",
  blocked: "Bloqueada",
};

const periodStatusStyles: Record<ClientPeriodStatus | "not_created", string> = {
  not_created: "bg-muted text-muted-foreground",
  not_started: "bg-muted text-muted-foreground",
  waiting_documents: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_review: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-gilver text-[hsl(0,0%,9%)]",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const currentPeriod = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

const Clients = () => {
  const navigate = useNavigate();
  const { clients, clientPeriods, addClient, updateClient, deleteClient, loading, refresh } = useData();
  const { user, profile } = useAuth();
  const { byUserId } = useWorkspaceMembers();
  const [searchTerm, setSearchTerm] = useState("");
  const [feeRange, setFeeRange] = useState({ min: "", max: "" });
  const [contractSort, setContractSort] = useState("contract-desc");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [serviceFilters, setServiceFilters] = useState<string[]>([]);
  const [sizeFilter, setSizeFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "", email: "", phone: "", cnpj: "", taxRegime: "simples_nacional" as ClientData["taxRegime"],
    serviceAreas: ["fiscal", "contabil"] as ClientData["serviceAreas"],
    serviceFee: "", city: "", state: "",
  });

  const toggleNewClientService = (service: ClientData["serviceAreas"][number], checked: boolean) => {
    setNewClient((current) => {
      const next = checked
        ? Array.from(new Set([...current.serviceAreas, service]))
        : current.serviceAreas.filter((item) => item !== service);
      return { ...current, serviceAreas: next.length ? next : current.serviceAreas };
    });
  };

  const handleFetchCNPJ = async () => {
    const clean = newClient.cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.error("CNPJ deve conter 14 dígitos");
      return;
    }
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://open.cnpja.com/office/${clean}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setNewClient((prev) => ({
        ...prev,
        name: data.company?.name ?? data.alias ?? prev.name,
        phone: data.phones?.[0] ? `(${data.phones[0].area}) ${data.phones[0].number}` : prev.phone,
        email: data.emails?.[0]?.address ?? prev.email,
        city: data.address?.city ?? prev.city,
        state: data.address?.state ?? prev.state,
      }));
      toast.success("Dados do CNPJ carregados");
    } catch (e: unknown) {
      toast.error("Não foi possível consultar o CNPJ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setCnpjLoading(false);
    }
  };

  const getClientSize = (client: ClientData) => {
    if (client.taxRegime === "mei") return "MEI";
    if (client.serviceFee >= 5000) return "Grande porte";
    if (client.serviceFee >= 3000) return "Médio porte";
    if (client.serviceFee >= 1500) return "EPP";
    return "ME";
  };
  const responsibles = Array.from(new Set(clients.map((client) => client.responsibleUserName)));
  const activePeriod = currentPeriod();
  const currentPeriodByClient = new Map(
    clientPeriods
      .filter((period) => period.periodMonth === activePeriod.month && period.periodYear === activePeriod.year)
      .map((period) => [period.companyId, period]),
  );

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
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(client.status);
    const matchesServices = serviceFilters.length === 0 || serviceFilters.some((service) => client.serviceAreas.includes(service as ClientData["serviceAreas"][number]));
    return matchesSearch && matchesFee && matchesSize && matchesResponsible && matchesStatus && matchesServices;
  }).sort((a, b) => {
    if (contractSort === "contract-asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleAddClient = async () => {
    if (!newClient.name || !newClient.email) {
      toast.error("Preencha nome e email do cliente");
      return;
    }

    const responsibleName = profile?.full_name || user?.email || "Responsável";

    const saved = await addClient({
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone,
      cnpj: newClient.cnpj,
      taxRegime: newClient.taxRegime,
      serviceAreas: newClient.serviceAreas,
      responsibleUserId: user?.id ?? "",
      responsibleUserName: responsibleName,
      serviceFee: parseFloat(newClient.serviceFee) || 0,
      city: newClient.city,
      state: newClient.state,
      status: "active",
    });
    if (!saved) return;

    setNewClient({ name: "", email: "", phone: "", cnpj: "", taxRegime: "simples_nacional", serviceAreas: ["fiscal", "contabil"], serviceFee: "", city: "", state: "" });
    setDialogOpen(false);
    toast.success("Cliente adicionado com sucesso!");
  };

  const handleDeleteClient = async (id: string) => {
    if (!await deleteClient(id)) return;
    toast.success("Cliente arquivado com sucesso!");
  };

  const handleStatusChange = async (id: string, status: ClientData["status"]) => {
    if (!await updateClient(id, { status })) return;
    toast.success("Status atualizado!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="page-header flex items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-[28px] font-normal tracking-[-0.035em]">Clientes</h1>
            <p className="text-muted-foreground">Gerencie seus relacionamentos com clientes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="dialog-window client-dialog sm:max-w-[425px]">
              <DialogHeader className="dialog-header">
                <DialogTitle>Novo Cliente</DialogTitle>
                <DialogDescription>
                  Adicione as informações do novo cliente abaixo.
                </DialogDescription>
              </DialogHeader>
              <div className="dialog-body custom-scroll grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome da Empresa</Label>
                  <Input id="name" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Empresa Ltda" className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <div className="flex gap-2">
                    <Input id="cnpj" value={newClient.cnpj} onChange={(e) => setNewClient({ ...newClient, cnpj: e.target.value.replace(/\D/g, "") })} placeholder="00000000000100" className="rounded-xl flex-1" />
                    <Button type="button" variant="outline" onClick={handleFetchCNPJ} disabled={cnpjLoading} className="rounded-xl gap-2 shrink-0">
                      {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Buscar
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Somente números — preenche os campos automaticamente.</p>
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
                    <Label htmlFor="client-tax-regime">Regime Tributário</Label>
                    <Select value={newClient.taxRegime} onValueChange={(v: ClientData["taxRegime"]) => setNewClient({ ...newClient, taxRegime: v })}>
                      <SelectTrigger id="client-tax-regime" className="rounded-xl"><SelectValue /></SelectTrigger>
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
                <div className="grid gap-2">
                  <Label>Serviços contratados</Label>
                  <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
                    {serviceAreaOptions.map((service) => (
                      <label key={service.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={newClient.serviceAreas.includes(service.value)}
                          onCheckedChange={(value) => toggleNewClientService(service.value, value === true)}
                        />
                        <span>{service.label}</span>
                      </label>
                    ))}
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
              <DialogFooter className="dialog-footer">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                <Button onClick={handleAddClient} className="rounded-xl">Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="glass page-section animate-fade-in">
          <div className="filter-toolbar mb-6 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                name="client-search"
                autoComplete="off"
                aria-label="Buscar clientes"
                placeholder="Buscar por nome, e-mail ou CNPJ…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <FilterPopover
              title="Filtrar clientes"
              description="Refine por honorários, porte, responsável ou ordem da lista."
              activeCount={[
                Boolean(feeRange.min),
                Boolean(feeRange.max),
                sizeFilter !== "all",
                responsibleFilter !== "all",
                contractSort !== "contract-desc",
                statusFilters.length > 0,
                serviceFilters.length > 0,
              ].filter(Boolean).length}
              onClear={() => {
                setFeeRange({ min: "", max: "" });
                setSizeFilter("all");
                setResponsibleFilter("all");
                setContractSort("contract-desc");
                setStatusFilters([]);
                setServiceFilters([]);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="client-fee-min">Honorários</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="client-fee-min"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={feeRange.min}
                    onChange={(e) => setFeeRange({ ...feeRange, min: e.target.value.replace(/\D/g, "") })}
                    placeholder="Mínimo…"
                    className="rounded-xl"
                  />
                  <Input
                    id="client-fee-max"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={feeRange.max}
                    onChange={(e) => setFeeRange({ ...feeRange, max: e.target.value.replace(/\D/g, "") })}
                    placeholder="Máximo…"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-size-filter">Porte</Label>
                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger id="client-size-filter" className="w-full rounded-xl"><SelectValue placeholder="Todos portes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos portes</SelectItem>
                    <SelectItem value="MEI">MEI</SelectItem>
                    <SelectItem value="ME">ME</SelectItem>
                    <SelectItem value="EPP">EPP</SelectItem>
                    <SelectItem value="Médio porte">Médio porte</SelectItem>
                    <SelectItem value="Grande porte">Grande porte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-sort">Ordenar por</Label>
                <Select value={contractSort} onValueChange={setContractSort}>
                  <SelectTrigger id="client-sort" className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contract-desc">Contrato mais novo</SelectItem>
                    <SelectItem value="contract-asc">Contrato mais antigo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-responsible-filter">Responsável</Label>
                <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                  <SelectTrigger id="client-responsible-filter" className="w-full rounded-xl"><SelectValue placeholder="Todos responsáveis" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos responsáveis</SelectItem>{responsibles.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <MultiSelectFilter
                label="Status"
                options={[{ value: "active", label: "Ativos" }, { value: "pending", label: "Pendentes" }, { value: "inactive", label: "Inativos" }]}
                value={statusFilters}
                onChange={setStatusFilters}
              />
              <MultiSelectFilter
                label="Serviços"
                options={serviceAreaOptions}
                value={serviceFilters}
                onChange={setServiceFilters}
              />
            </FilterPopover>
            <Badge variant="secondary" className="px-3 py-1.5">
              {filteredClients.length} clientes
            </Badge>
            <SortToggle
              label="data de cadastro"
              direction={contractSort === "contract-asc" ? "asc" : "desc"}
              onChange={(direction) => setContractSort(direction === "asc" ? "contract-asc" : "contract-desc")}
            />
            <div className="ml-auto flex rounded-full border border-border bg-card p-1">
              <IconTooltipButton icon={Grid2X2} label="Grade" variant={viewMode === "grid" ? "default" : "ghost"} aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")} />
              <IconTooltipButton icon={List} label="Lista" variant={viewMode === "list" ? "default" : "ghost"} aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")} />
            </div>
          </div>

          {loading && clients.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Carregando clientes...</p>
            </div>
          ) : (
            <div className={cn(
              "overflow-hidden rounded-2xl border border-border/70 bg-border/70",
              viewMode === "grid" ? cn("grid gap-px", getBentoGridClass(filteredClients.length)) : "divide-y divide-border/70",
            )}>
              {filteredClients.map((client, index) => (
              (() => {
                const period = currentPeriodByClient.get(client.id);
                const periodStatus = period?.status ?? "not_created";
                const periodProgress = period?.status === "closed" ? 100 : period?.progressPercent ?? 0;
                return (
              <div
                key={client.id}
                className={cn("flex gap-4 bg-card p-4 transition-colors duration-200 hover:bg-accent/30", viewMode === "grid" ? "flex-col" : "items-center")}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <button
                  type="button"
                  className={cn("min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2", viewMode === "grid" ? "flex flex-col" : "")}
                  onClick={() => setSelectedClient(client)}
                  aria-label={`Abrir detalhes de ${client.name}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{client.name}</p>
                    <Badge variant={client.status === 'active' ? 'default' : client.status === 'pending' ? 'secondary' : 'outline'} className={cn("shrink-0 text-[10px]", client.status === 'active' && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400")}>{client.status === 'active' ? 'Ativo' : client.status === 'pending' ? 'Pendente' : 'Inativo'}</Badge>
                  </div>
                  <div className="mt-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">{taxRegimeLabels[client.taxRegime]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{client.serviceAreas.length} serviço(s)</Badge>
                      <Badge variant="outline" className="text-[10px]">{getClientSize(client)}</Badge>
                      <Badge className={cn("text-[10px]", periodStatusStyles[periodStatus])}>{periodStatusLabels[periodStatus]}</Badge>
                    </div>
                    <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage src={byUserId.get(client.responsibleUserId)?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[9px]">{client.responsibleUserName?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">Resp.: {client.responsibleUserName || "Sem responsável"}</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Competência atual</span>
                        <span>{periodProgress}%</span>
                      </div>
                      <Progress value={periodProgress} className="h-1.5" />
                    </div>
                  </div>
                </button>
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
                  <div><p className="font-semibold text-sm">R$ {client.serviceFee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-[10px] text-muted-foreground">{client.city}/{client.state}</p></div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label={`Ações de ${client.name}`} title={`Ações de ${client.name}`} variant="ghost" size="icon" className="h-8 w-8 rounded-full border-0" onClick={(event) => event.stopPropagation()}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenuItem className="gap-2" onClick={() => setSelectedClient(client)}>
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
                );
              })()
              ))}

              {filteredClients.length === 0 && (
                <div className="col-span-full flex flex-col items-center py-12 text-center text-muted-foreground">
                  <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>Nenhum cliente encontrado</p>
                  <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => void refresh()}>
                    Atualizar lista
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <Dialog open={Boolean(selectedClient)} onOpenChange={(open) => !open && setSelectedClient(null)}>
          <DialogContent className="dialog-window client-dialog sm:max-w-[540px]">
            {selectedClient && (
              <>
                <DialogHeader className="dialog-header">
                  <DialogTitle>{selectedClient.name}</DialogTitle>
                  <DialogDescription>
                    {taxRegimeLabels[selectedClient.taxRegime]} · {getClientSize(selectedClient)}
                  </DialogDescription>
                </DialogHeader>
                <div className="dialog-body custom-scroll grid gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={selectedClient.status === "active" ? "default" : selectedClient.status === "pending" ? "secondary" : "outline"} className={cn(selectedClient.status === "active" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400")}>
                      {selectedClient.status === "active" ? "Ativo" : selectedClient.status === "pending" ? "Pendente" : "Inativo"}
                    </Badge>
                    <Badge variant="outline">Honorários R$ {selectedClient.serviceFee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Badge>
                    {selectedClient.serviceAreas.map((service) => (
                      <Badge key={service} variant="secondary">{serviceAreaOptions.find((option) => option.value === service)?.label ?? service}</Badge>
                    ))}
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><p className="text-xs text-muted-foreground">E-mail</p><p className="font-medium break-words">{selectedClient.email || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Telefone</p><p className="font-medium">{selectedClient.phone || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">CNPJ</p><p className="font-medium">{selectedClient.cnpj || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Localidade</p><p className="font-medium">{selectedClient.city || "—"}/{selectedClient.state || "—"}</p></div>
                    <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Responsável</p><p className="font-medium">{selectedClient.responsibleUserName || "Sem responsável"}</p></div>
                  </div>
                </div>
                <DialogFooter className="dialog-footer flex-col gap-2 sm:flex-row sm:justify-between">
                  <Button variant="destructive" className="rounded-xl" onClick={() => { void handleDeleteClient(selectedClient.id); setSelectedClient(null); }}>
                    <Trash2 className="mr-2 h-4 w-4" />Remover
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleStatusChange(selectedClient.id, selectedClient.status === "active" ? "inactive" : "active")}>
                      {selectedClient.status === "active" ? "Inativar" : "Ativar"}
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/clients/${selectedClient.id}`)}>
                      <Eye className="mr-2 h-4 w-4" />Abrir cadastro
                    </Button>
                    <Button className="rounded-xl" onClick={() => navigate(`/clients/${selectedClient.id}`)}>
                      <Edit className="mr-2 h-4 w-4" />Editar
                    </Button>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Clients;
