import { useState, useRef, useEffect } from "react";
import { Search, Bell, FileText, Users, MessageSquare, BarChart3, CheckSquare, Plug, X, Droplet } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useViewMode } from "@/contexts/ViewModeContext";

interface SearchResult {
  category: string;
  icon: React.ElementType;
  items: { label: string; href: string }[];
}

const officeSearchData: SearchResult[] = [
  {
    category: "Clientes",
    icon: Users,
    items: [
      { label: "Acme Corporation", href: "/clients" },
      { label: "TechStart Inc", href: "/clients" },
      { label: "Global Finance Ltd", href: "/clients" },
      { label: "DataFlow Systems", href: "/clients" },
      { label: "Verde Soluções", href: "/clients" },
      { label: "Nexus Tecnologia", href: "/clients" },
    ],
  },
  {
    category: "Documentos",
    icon: FileText,
    items: [
      { label: "Fatura #1234", href: "/documents" },
      { label: "Fatura #1231", href: "/documents" },
      { label: "Relatório Financeiro Q4", href: "/documents" },
      { label: "Contrato de Serviços", href: "/documents" },
    ],
  },
  {
    category: "Relatórios",
    icon: BarChart3,
    items: [
      { label: "DRE Mensal - Janeiro 2026", href: "/reports" },
      { label: "Análise de Fluxo de Caixa", href: "/reports" },
      { label: "Contas a Receber", href: "/reports" },
      { label: "Resumo Fiscal Anual", href: "/reports" },
    ],
  },
  {
    category: "Mensagens",
    icon: MessageSquare,
    items: [
      { label: "Sarah Johnson - Relatório trimestral", href: "/messages" },
      { label: "Mike Chen - Previsão orçamentária", href: "/messages" },
      { label: "Roberto Santos - Auditoria Q3", href: "/messages" },
    ],
  },
  {
    category: "Integrações",
    icon: Plug,
    items: [
      { label: "Receita Federal", href: "/integrations" },
      { label: "SERPRO", href: "/integrations" },
      { label: "NFSe Municipal", href: "/integrations" },
    ],
  },
];

const clientSearchData: SearchResult[] = [
  {
    category: "Tarefas",
    icon: CheckSquare,
    items: [
      { label: "Enviar documentos fiscais", href: "/tasks" },
      { label: "Revisar relatório mensal", href: "/tasks" },
      { label: "Aprovar fatura pendente", href: "/tasks" },
    ],
  },
  {
    category: "Documentos",
    icon: FileText,
    items: [
      { label: "Balancete Mensal", href: "/documents" },
      { label: "DAS - Janeiro", href: "/documents" },
      { label: "Nota Fiscal #892", href: "/documents" },
    ],
  },
  {
    category: "Relatórios",
    icon: BarChart3,
    items: [
      { label: "Relatório Financeiro", href: "/reports" },
      { label: "Fluxo de Caixa", href: "/reports" },
    ],
  },
  {
    category: "Mensagens",
    icon: MessageSquare,
    items: [
      { label: "Lotus Contabilidade", href: "/messages" },
      { label: "Claison Kepler", href: "/messages" },
    ],
  },
];

// AI assistant trigger keywords
const aiKeywords = ["ia", "assistente", "ajuda", "lótus ia", "lotus ia", "perguntar", "pergunta"];

interface TopBarProps {
  className?: string;
  onOpenAI?: () => void;
}

export const TopBar = ({ className, onOpenAI }: TopBarProps) => {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const { viewMode } = useViewMode();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const searchData = viewMode === "office" ? officeSearchData : clientSearchData;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAIQuery = aiKeywords.some(k => query.toLowerCase().includes(k));

  const filteredResults = query.trim()
    ? searchData
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            item.label.toLowerCase().includes(query.toLowerCase())
          ),
        }))
        .filter((group) => group.items.length > 0)
    : [];

  const handleSelect = (href: string) => {
    navigate(href);
    setQuery("");
    setShowResults(false);
  };

  const handleAIOpen = () => {
    setQuery("");
    setShowResults(false);
    onOpenAI?.();
  };

  const isDropdownVisible = showResults && query.trim().length > 0;

  return (
    <>
      {isDropdownVisible && (
        <div
          className="search-backdrop"
          onClick={() => setShowResults(false)}
        />
      )}
      <header
        className={cn(
          "h-16 border-b border-border bg-background/80 backdrop-blur-xl",
          "flex items-center justify-between px-6 sticky top-0",
          isDropdownVisible ? "z-50" : "z-40",
          className
        )}
      >
        <div className="flex items-center gap-4 flex-1 max-w-md relative ml-2" ref={wrapperRef}>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ou pergunte à Lia..."
              className="pl-10 h-10 bg-muted/50 border-0 focus-visible:ring-1 rounded-xl"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => query.trim() && setShowResults(true)}
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setShowResults(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {isDropdownVisible && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-[99999] max-h-[400px] overflow-y-auto custom-scroll">
                {/* AI suggestion */}
                {isAIQuery && (
                  <button
                    className="w-full text-left px-4 py-3 text-sm hover:bg-accent transition-colors flex items-center gap-3 border-b border-border"
                    onClick={handleAIOpen}
                  >
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <Droplet className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">Perguntar à Lótus IA</p>
                      <p className="text-xs text-muted-foreground">"{query}"</p>
                    </div>
                  </button>
                )}

                {filteredResults.length > 0 && filteredResults.map((group) => {
                  const Icon = group.icon;
                  return (
                    <div key={group.category}>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {group.category}
                      </div>
                      {group.items.map((item) => (
                        <button
                          key={item.label}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                          onClick={() => handleSelect(item.href)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  );
                })}

                {filteredResults.length === 0 && !isAIQuery && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <p>Nenhum resultado encontrado para "{query}"</p>
                    <button className="mt-2 text-xs text-gilver hover:underline flex items-center gap-1 mx-auto" onClick={handleAIOpen}>
                      <Droplet className="h-3 w-3" />
                      Perguntar à Lótus IA
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-xl hover:bg-accent"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
          </Button>
          <ThemeToggle />
        </div>
      </header>
    </>
  );
};
