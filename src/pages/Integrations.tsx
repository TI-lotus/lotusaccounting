import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Check, ExternalLink, Settings, Landmark, Shield, Building2, FileText, KeyRound, Database, Users, Banknote, Plug } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Category = "Governo" | "Fiscal" | "RH" | "Bancos";

const integrations: { id: string; name: string; description: string; connected: boolean; icon: any; category: Category }[] = [
  { id: "receita-federal", name: "Receita Federal", description: "Consulta de situação cadastral, CNPJ e declarações", connected: true, icon: Landmark, category: "Governo" },
  { id: "serpro", name: "SERPRO", description: "Serviços de dados governamentais e certificação digital", connected: true, icon: Shield, category: "Governo" },
  { id: "cnpj-api", name: "Consulta CNPJ", description: "API de consulta de dados cadastrais de empresas", connected: true, icon: Building2, category: "Governo" },
  { id: "nfse", name: "NFSe Municipal", description: "Emissão e consulta de Notas Fiscais de Serviço", connected: false, icon: FileText, category: "Fiscal" },
  { id: "certificado-a1", name: "Certificado Digital A1", description: "Gerenciamento de certificados digitais para assinatura", connected: false, icon: KeyRound, category: "Fiscal" },
  { id: "sped", name: "SPED Fiscal", description: "Integração com o Sistema Público de Escrituração Digital", connected: true, icon: Database, category: "Fiscal" },
  { id: "esocial", name: "eSocial", description: "Transmissão de obrigações trabalhistas e previdenciárias", connected: false, icon: Users, category: "RH" },
  { id: "simples-nacional", name: "Simples Nacional", description: "Consulta e cálculo de DAS e obrigações do Simples", connected: true, icon: Banknote, category: "Fiscal" },
  { id: "itau", name: "Itaú", description: "Conciliação bancária e pagamentos via Itaú", connected: false, icon: Landmark, category: "Bancos" },
  { id: "bradesco", name: "Bradesco", description: "Integração para extratos e pagamentos Bradesco", connected: false, icon: Landmark, category: "Bancos" },
  { id: "santander", name: "Santander", description: "Conciliação e cobranças via Santander", connected: false, icon: Landmark, category: "Bancos" },
  { id: "inter", name: "Banco Inter", description: "Pix, boletos e conciliação automática", connected: true, icon: Landmark, category: "Bancos" },
  { id: "nubank", name: "Nubank", description: "Extratos e conciliação para conta PJ Nubank", connected: false, icon: Landmark, category: "Bancos" },
  { id: "brb", name: "BRB", description: "Integração com o Banco de Brasília", connected: false, icon: Landmark, category: "Bancos" },
];

const categoryOrder: Category[] = ["Governo", "Fiscal", "RH", "Bancos"];

const Integrations = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground">Conecte serviços para otimizar seu fluxo contábil</p>
        </div>

        {categoryOrder.map((category) => {
          const items = integrations.filter((i) => i.category === category);
          if (!items.length) return null;
          return (
            <section key={category} className="space-y-3 animate-fade-in">
              <h2 className="text-lg font-medium">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((integration) => {
                  const Icon = integration.icon;
                  return (
                    <div
                      key={integration.id}
                      className={cn(
                        "rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-soft-lg transition-all",
                        integration.connected && "bg-gilver/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className={cn("p-2.5 rounded-xl", integration.connected ? "bg-gilver/15 text-gilver" : "bg-muted text-muted-foreground")}>
                          <Icon className="h-5 w-5" strokeWidth={1.5} />
                        </div>
                        {integration.connected
                          ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"><Check className="h-3 w-3 mr-1" />Conectado</Badge>
                          : <Badge variant="secondary">Desconectado</Badge>}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{integration.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{integration.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={integration.connected ? "outline" : "default"}
                          size="sm"
                          className="flex-1 rounded-xl gap-1.5"
                          onClick={() => navigate(`/integrations/${integration.id}`)}
                        >
                          {integration.connected ? <><ExternalLink className="h-3.5 w-3.5" />Gerenciar</> : <><Plug className="h-3.5 w-3.5" />Conectar</>}
                        </Button>
                        {integration.connected && (
                          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(`/integrations/${integration.id}`)}>
                            <Settings className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
