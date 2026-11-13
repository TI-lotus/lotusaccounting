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
      <div className="mx-auto w-full max-w-[1100px] space-y-8">
        <div className="page-header">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-gilver">Assistente da plataforma</p>
          <h1 className="text-[30px] font-normal leading-tight tracking-[-0.035em]">Lia</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">Sua assistente contábil inteligente, disponível sobre a página para orientar decisões e acelerar tarefas.</p>
      </div>

        <Card className="page-section">
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-gilver" aria-hidden="true" title="Lia" />
              <p className="text-base font-medium">Converse enquanto trabalha</p>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              A janela da Lia aparece sobre a página, no canto direito, para você continuar navegando enquanto conversa. Ela pode responder perguntas sobre seus dados, gerar relatórios rápidos e acionar automações no n8n.
            </p>
          </CardContent>
        </Card>

      <div className="grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2">
        {capabilities.map(c => {
          const Icon = c.icon;
          return (
            <Card key={c.title} className="rounded-none border-0">
              <CardContent className="min-h-36 space-y-3 p-5 sm:p-6">
                <Icon className="h-5 w-5 text-gilver" aria-hidden="true" title={c.title} />
                <p className="font-medium">{c.title}</p>
                <p className="text-sm leading-6 text-muted-foreground">{c.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  </DashboardLayout>
);

export default Lia;
