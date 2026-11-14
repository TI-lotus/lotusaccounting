import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Plus, RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high" | "urgent";

type ChecklistTemplate = {
  id: string;
  tenant_id: string | null;
  name: string;
  tax_regime: string;
  service_area: string;
  active: boolean;
};

type ChecklistItem = {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  default_priority: Priority;
  default_due_day: number;
  requires_review: boolean;
  requires_document: boolean;
  active: boolean;
  sort_order: number;
};

type FiscalTemplate = {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  tax_regime: string;
  service_area: string;
  recurrence: string;
  default_due_day: number;
  priority: Priority;
  generates_task: boolean;
  requires_evidence: boolean;
  active: boolean;
  sort_order: number;
};

type TemplateClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => TemplateQuery;
    select: (columns?: string) => TemplateQuery;
    update: (values: Record<string, unknown>) => TemplateQuery;
  };
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type TemplateQuery = {
  order: (column: string, options?: { ascending?: boolean }) => TemplateQuery;
  eq: (column: string, value: unknown) => TemplateQuery;
  select: (columns?: string) => TemplateQuery;
  then: PromiseLike<{ data: unknown; error: { message: string } | null }>["then"];
};

const db = supabase as unknown as TemplateClient;

const taxRegimeLabels: Record<string, string> = {
  mei: "MEI",
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

const serviceAreaLabels: Record<string, string> = {
  fiscal: "Fiscal",
  contabil: "Contábil",
  folha: "Folha",
  financeiro_bpo: "Financeiro/BPO",
  societario: "Societário",
};

const priorityLabels: Record<Priority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const priorityOptions: Priority[] = ["low", "medium", "high", "urgent"];
const taxRegimeOptions = Object.keys(taxRegimeLabels);
const serviceAreaOptions = Object.keys(serviceAreaLabels);

const scopeLabel = (tenantId: string | null) => (tenantId ? "Escritório" : "Global");

const OperationalTemplates = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.account_type === "admin";
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [fiscalTemplates, setFiscalTemplates] = useState<FiscalTemplate[]>([]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const [
        checklistTemplatesResult,
        checklistItemsResult,
        fiscalTemplatesResult,
      ] = await Promise.all([
        db
          .from("operational_checklist_templates")
          .select("*")
          .order("tax_regime")
          .order("service_area")
          .order("name"),
        db
          .from("operational_checklist_items")
          .select("*")
          .order("template_id")
          .order("sort_order")
          .order("title"),
        db
          .from("fiscal_obligation_templates")
          .select("*")
          .order("tax_regime")
          .order("service_area")
          .order("sort_order"),
      ]);

      const error =
        checklistTemplatesResult.error ||
        checklistItemsResult.error ||
        fiscalTemplatesResult.error;
      if (error) throw new Error(error.message);

      setChecklistTemplates((checklistTemplatesResult.data ?? []) as ChecklistTemplate[]);
      setChecklistItems((checklistItemsResult.data ?? []) as ChecklistItem[]);
      setFiscalTemplates((fiscalTemplatesResult.data ?? []) as FiscalTemplate[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const itemsByTemplate = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    checklistItems.forEach((item) => {
      const current = map.get(item.template_id) ?? [];
      current.push(item);
      map.set(
        item.template_id,
        current.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)),
      );
    });
    return map;
  }, [checklistItems]);

  const updateChecklistTemplateLocal = (id: string, updates: Partial<ChecklistTemplate>) => {
    setChecklistTemplates((current) =>
      current.map((template) => (template.id === id ? { ...template, ...updates } : template)),
    );
  };

  const updateChecklistItemLocal = (id: string, updates: Partial<ChecklistItem>) => {
    setChecklistItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const updateFiscalTemplateLocal = (id: string, updates: Partial<FiscalTemplate>) => {
    setFiscalTemplates((current) =>
      current.map((template) => (template.id === id ? { ...template, ...updates } : template)),
    );
  };

  const cloneChecklistTemplate = async (templateId: string) => {
    if (!isAdmin) return;
    setSavingId(templateId);
    try {
      const { error } = await db.rpc("clone_operational_checklist_template", {
        source_template_id: templateId,
      });
      if (error) throw new Error(error.message);
      toast.success("Template duplicado para o escritório.");
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível duplicar o template.");
    } finally {
      setSavingId(null);
    }
  };

  const cloneFiscalTemplate = async (templateId: string) => {
    if (!isAdmin) return;
    setSavingId(templateId);
    try {
      const { error } = await db.rpc("clone_fiscal_obligation_template", {
        source_template_id: templateId,
      });
      if (error) throw new Error(error.message);
      toast.success("Obrigação duplicada para o escritório.");
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível duplicar a obrigação.");
    } finally {
      setSavingId(null);
    }
  };

  const createChecklistTemplate = async () => {
    if (!isAdmin || !profile?.tenant_id) return;
    setSavingId("new-checklist-template");
    try {
      const { error } = await db
        .from("operational_checklist_templates")
        .insert({
          tenant_id: profile.tenant_id,
          name: `Novo checklist ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
          tax_regime: "simples_nacional",
          service_area: "fiscal",
          active: true,
        })
        .select("id");
      if (error) throw new Error(error.message);
      toast.success("Checklist criado.");
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o checklist.");
    } finally {
      setSavingId(null);
    }
  };

  const createChecklistItem = async (template: ChecklistTemplate) => {
    if (!isAdmin || !template.tenant_id) return;
    const nextOrder = ((itemsByTemplate.get(template.id) ?? []).at(-1)?.sort_order ?? 0) + 10;
    setSavingId(`new-checklist-item-${template.id}`);
    try {
      const { error } = await db
        .from("operational_checklist_items")
        .insert({
          template_id: template.id,
          title: `Novo item ${nextOrder}`,
          description: null,
          default_priority: "medium",
          default_due_day: 10,
          requires_review: false,
          requires_document: false,
          active: true,
          sort_order: nextOrder,
        })
        .select("id");
      if (error) throw new Error(error.message);
      toast.success("Item criado.");
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o item.");
    } finally {
      setSavingId(null);
    }
  };

  const createFiscalTemplate = async () => {
    if (!isAdmin || !profile?.tenant_id) return;
    setSavingId("new-fiscal-template");
    try {
      const { error } = await db
        .from("fiscal_obligation_templates")
        .insert({
          tenant_id: profile.tenant_id,
          name: `Nova obrigação ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
          description: null,
          tax_regime: "simples_nacional",
          service_area: "fiscal",
          recurrence: "monthly",
          default_due_day: 20,
          priority: "medium",
          generates_task: true,
          requires_evidence: false,
          active: true,
          sort_order: 100,
        })
        .select("id");
      if (error) throw new Error(error.message);
      toast.success("Obrigação criada.");
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a obrigação.");
    } finally {
      setSavingId(null);
    }
  };

  const saveChecklistTemplate = async (template: ChecklistTemplate) => {
    if (!isAdmin || !template.tenant_id) return;
    setSavingId(template.id);
    try {
      const { error } = await db
        .from("operational_checklist_templates")
        .update({
          name: template.name,
          tax_regime: template.tax_regime,
          service_area: template.service_area,
          active: template.active,
        })
        .eq("id", template.id)
        .select("id");
      if (error) throw new Error(error.message);
      toast.success("Template salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o template.");
    } finally {
      setSavingId(null);
    }
  };

  const saveChecklistItem = async (item: ChecklistItem) => {
    const owner = checklistTemplates.find((template) => template.id === item.template_id);
    if (!isAdmin || !owner?.tenant_id) return;
    setSavingId(item.id);
    try {
      const { error } = await db
        .from("operational_checklist_items")
        .update({
          title: item.title,
          description: item.description,
          default_priority: item.default_priority,
          default_due_day: item.default_due_day,
          requires_review: item.requires_review,
          requires_document: item.requires_document,
          active: item.active,
          sort_order: item.sort_order,
        })
        .eq("id", item.id)
        .select("id");
      if (error) throw new Error(error.message);
      toast.success("Item salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o item.");
    } finally {
      setSavingId(null);
    }
  };

  const saveFiscalTemplate = async (template: FiscalTemplate) => {
    if (!isAdmin || !template.tenant_id) return;
    setSavingId(template.id);
    try {
      const { error } = await db
        .from("fiscal_obligation_templates")
        .update({
          name: template.name,
          description: template.description,
          tax_regime: template.tax_regime,
          service_area: template.service_area,
          recurrence: template.recurrence,
          default_due_day: template.default_due_day,
          priority: template.priority,
          generates_task: template.generates_task,
          requires_evidence: template.requires_evidence,
          active: template.active,
          sort_order: template.sort_order,
        })
        .eq("id", template.id)
        .select("id");
      if (error) throw new Error(error.message);
      toast.success("Obrigação salva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a obrigação.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-normal tracking-[-0.035em]">Templates operacionais</h1>
            <p className="text-muted-foreground">
              Configure checklists e obrigações usadas na geração das competências.
            </p>
          </div>
          <Button variant="outline" className="rounded-xl gap-2" disabled={loading} onClick={() => void loadTemplates()}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {!isAdmin && (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Seu usuário pode consultar os templates, mas apenas administradores editam configurações do escritório.
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="checklists" className="space-y-4">
          <TabsList className="segmented-tabs grid w-full max-w-lg grid-cols-2">
            <TabsTrigger value="checklists">Checklists</TabsTrigger>
            <TabsTrigger value="obligations">Obrigações</TabsTrigger>
          </TabsList>

          <TabsContent value="checklists" className="space-y-4">
            <div className="flex justify-end">
              <Button
                className="rounded-xl gap-2"
                disabled={!isAdmin || savingId === "new-checklist-template"}
                onClick={() => void createChecklistTemplate()}
              >
                <Plus className="h-4 w-4" />
                Novo checklist
              </Button>
            </div>
            {checklistTemplates.map((template) => {
              const isWorkspaceTemplate = Boolean(template.tenant_id);
              const templateItems = itemsByTemplate.get(template.id) ?? [];
              return (
                <Card key={template.id}>
                  <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <Badge variant={isWorkspaceTemplate ? "default" : "secondary"}>
                            {scopeLabel(template.tenant_id)}
                          </Badge>
                          {!template.active && <Badge variant="outline">Inativo</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {taxRegimeLabels[template.tax_regime] ?? template.tax_regime} · {serviceAreaLabels[template.service_area] ?? template.service_area}
                        </p>
                      </div>
                      {isWorkspaceTemplate ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg gap-2"
                            disabled={!isAdmin || savingId === `new-checklist-item-${template.id}`}
                            onClick={() => void createChecklistItem(template)}
                          >
                            <Plus className="h-4 w-4" />
                            Novo item
                          </Button>
                          <Button size="sm" className="rounded-lg gap-2" disabled={savingId === template.id} onClick={() => void saveChecklistTemplate(template)}>
                            <Save className="h-4 w-4" />
                            Salvar
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="rounded-lg gap-2" disabled={!isAdmin || savingId === template.id} onClick={() => void cloneChecklistTemplate(template.id)}>
                          <Copy className="h-4 w-4" />
                          Duplicar
                        </Button>
                      )}
                    </div>
                    {isWorkspaceTemplate && (
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_120px]">
                        <div className="grid gap-1.5">
                          <Label>Nome</Label>
                          <Input
                            value={template.name}
                            disabled={!isAdmin}
                            onChange={(event) => updateChecklistTemplateLocal(template.id, { name: event.target.value })}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Regime</Label>
                          <Select
                            value={template.tax_regime}
                            disabled={!isAdmin}
                            onValueChange={(tax_regime) => updateChecklistTemplateLocal(template.id, { tax_regime })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {taxRegimeOptions.map((taxRegime) => (
                                <SelectItem key={taxRegime} value={taxRegime}>
                                  {taxRegimeLabels[taxRegime]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Serviço</Label>
                          <Select
                            value={template.service_area}
                            disabled={!isAdmin}
                            onValueChange={(service_area) => updateChecklistTemplateLocal(template.id, { service_area })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {serviceAreaOptions.map((serviceArea) => (
                                <SelectItem key={serviceArea} value={serviceArea}>
                                  {serviceAreaLabels[serviceArea]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end justify-between gap-3 rounded-xl border border-border px-3 py-2">
                          <Label className="pb-1">Ativo</Label>
                          <Switch
                            checked={template.active}
                            disabled={!isAdmin}
                            onCheckedChange={(active) => updateChecklistTemplateLocal(template.id, { active })}
                          />
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {templateItems.map((item) => {
                      const canEdit = isAdmin && isWorkspaceTemplate;
                      return (
                        <div key={item.id} className="rounded-xl border border-border p-3">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <p className="truncate text-sm font-medium">{item.title}</p>
                            </div>
                            {canEdit && (
                              <Button size="sm" variant="outline" className="h-8 rounded-lg gap-2" disabled={savingId === item.id} onClick={() => void saveChecklistItem(item)}>
                                <Save className="h-3.5 w-3.5" />
                                Salvar item
                              </Button>
                            )}
                          </div>
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_120px_120px]">
                            <div className="grid gap-1.5">
                              <Label>Título</Label>
                              <Input
                                value={item.title}
                                disabled={!canEdit}
                                onChange={(event) => updateChecklistItemLocal(item.id, { title: event.target.value })}
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label>Prazo padrão</Label>
                              <Input
                                type="number"
                                min={1}
                                max={31}
                                value={item.default_due_day}
                                disabled={!canEdit}
                                onChange={(event) => updateChecklistItemLocal(item.id, { default_due_day: Number(event.target.value) })}
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label>Ordem</Label>
                              <Input
                                type="number"
                                value={item.sort_order}
                                disabled={!canEdit}
                                onChange={(event) => updateChecklistItemLocal(item.id, { sort_order: Number(event.target.value) })}
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label>Prioridade</Label>
                              <Select
                                value={item.default_priority}
                                disabled={!canEdit}
                                onValueChange={(default_priority: Priority) => updateChecklistItemLocal(item.id, { default_priority })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {priorityOptions.map((priority) => (
                                    <SelectItem key={priority} value={priority}>{priorityLabels[priority]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_120px_120px]">
                            <Textarea
                              value={item.description ?? ""}
                              disabled={!canEdit}
                              onChange={(event) => updateChecklistItemLocal(item.id, { description: event.target.value || null })}
                              placeholder="Descrição"
                              className="min-h-20 lg:col-span-1"
                            />
                            {[
                              ["requires_review", "Revisão"],
                              ["requires_document", "Documento"],
                              ["active", "Ativo"],
                            ].map(([field, label]) => (
                              <div key={field} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                                <Label>{label}</Label>
                                <Switch
                                  checked={Boolean(item[field as keyof ChecklistItem])}
                                  disabled={!canEdit}
                                  onCheckedChange={(checked) => updateChecklistItemLocal(item.id, { [field]: checked } as Partial<ChecklistItem>)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="obligations" className="space-y-4">
            <div className="flex justify-end">
              <Button
                className="rounded-xl gap-2"
                disabled={!isAdmin || savingId === "new-fiscal-template"}
                onClick={() => void createFiscalTemplate()}
              >
                <Plus className="h-4 w-4" />
                Nova obrigação
              </Button>
            </div>
            {fiscalTemplates.map((template) => {
              const isWorkspaceTemplate = Boolean(template.tenant_id);
              const canEdit = isAdmin && isWorkspaceTemplate;
              return (
                <Card key={template.id}>
                  <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <Badge variant={isWorkspaceTemplate ? "default" : "secondary"}>
                            {scopeLabel(template.tenant_id)}
                          </Badge>
                          {!template.active && <Badge variant="outline">Inativa</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {taxRegimeLabels[template.tax_regime] ?? template.tax_regime} · {serviceAreaLabels[template.service_area] ?? template.service_area}
                        </p>
                      </div>
                      {isWorkspaceTemplate ? (
                        <Button size="sm" className="rounded-lg gap-2" disabled={!canEdit || savingId === template.id} onClick={() => void saveFiscalTemplate(template)}>
                          <Save className="h-4 w-4" />
                          Salvar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="rounded-lg gap-2" disabled={!isAdmin || savingId === template.id} onClick={() => void cloneFiscalTemplate(template.id)}>
                          <Copy className="h-4 w-4" />
                          Duplicar
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_120px_120px_120px]">
                      <div className="grid gap-1.5">
                        <Label>Nome</Label>
                        <Input
                          value={template.name}
                          disabled={!canEdit}
                          onChange={(event) => updateFiscalTemplateLocal(template.id, { name: event.target.value })}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Regime</Label>
                        <Select
                          value={template.tax_regime}
                          disabled={!canEdit}
                          onValueChange={(tax_regime) => updateFiscalTemplateLocal(template.id, { tax_regime })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {taxRegimeOptions.map((taxRegime) => (
                              <SelectItem key={taxRegime} value={taxRegime}>
                                {taxRegimeLabels[taxRegime]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Serviço</Label>
                        <Select
                          value={template.service_area}
                          disabled={!canEdit}
                          onValueChange={(service_area) => updateFiscalTemplateLocal(template.id, { service_area })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {serviceAreaOptions.map((serviceArea) => (
                              <SelectItem key={serviceArea} value={serviceArea}>
                                {serviceAreaLabels[serviceArea]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Vencimento</Label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={template.default_due_day}
                          disabled={!canEdit}
                          onChange={(event) => updateFiscalTemplateLocal(template.id, { default_due_day: Number(event.target.value) })}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Ordem</Label>
                        <Input
                          type="number"
                          value={template.sort_order}
                          disabled={!canEdit}
                          onChange={(event) => updateFiscalTemplateLocal(template.id, { sort_order: Number(event.target.value) })}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Prioridade</Label>
                        <Select
                          value={template.priority}
                          disabled={!canEdit}
                          onValueChange={(priority: Priority) => updateFiscalTemplateLocal(template.id, { priority })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {priorityOptions.map((priority) => (
                              <SelectItem key={priority} value={priority}>{priorityLabels[priority]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_120px_120px]">
                      <Textarea
                        value={template.description ?? ""}
                        disabled={!canEdit}
                        onChange={(event) => updateFiscalTemplateLocal(template.id, { description: event.target.value || null })}
                        placeholder="Descrição"
                        className="min-h-20"
                      />
                      {[
                        ["generates_task", "Gera tarefa"],
                        ["requires_evidence", "Evidência"],
                        ["active", "Ativa"],
                      ].map(([field, label]) => (
                        <div key={field} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                          <Label>{label}</Label>
                          <Switch
                            checked={Boolean(template[field as keyof FiscalTemplate])}
                            disabled={!canEdit}
                            onCheckedChange={(checked) => updateFiscalTemplateLocal(template.id, { [field]: checked } as Partial<FiscalTemplate>)}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>

        {!loading && checklistTemplates.length === 0 && fiscalTemplates.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum template encontrado.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OperationalTemplates;
