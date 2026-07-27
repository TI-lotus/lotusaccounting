import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, MessageSquare, FileText, Wallet, Users } from "lucide-react";

const capabilities = [
  { icon: Wallet, title: "Consultas financeiras", desc: "Pergunte sobre receitas, despesas, lucro e recebíveis do mês." },
  { icon: FileText, title: "Documentos", desc: "Encontre notas fiscais, guias e contratos por cliente ou período." },
  { icon: Users, title: "Clientes", desc: "Resumo 360° de qualquer cliente cadastrado." },
  { icon: MessageSquare, title: "Atendimento", desc: "Solicite atendimento humano a qualquer momento pelo chat." },
];

const Lia = () => (
  <DashboardLayout>
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-gilver/20 text-gilver"><Sparkles className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lia</h1>
          <p className="text-muted-foreground">Sua assistente contábil inteligente</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Abra o painel de chat no lado direito para conversar com a Lia. Ela pode responder perguntas sobre seus
            dados, gerar relatórios rápidos e acionar automações no n8n.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {capabilities.map(c => {
          const Icon = c.icon;
          return (
            <Card key={c.title}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-sm text-muted-foreground">{c.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  </DashboardLayout>
);

export default Lia;
