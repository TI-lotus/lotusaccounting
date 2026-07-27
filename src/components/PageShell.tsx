import { ReactNode } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export interface PageShellKPI {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

export interface PageShellTab {
  value: string;
  label: string;
}

interface PageShellProps {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  kpis?: PageShellKPI[];
  tabs?: PageShellTab[];
  activeTab?: string;
  onTabChange?: (v: string) => void;
  filters?: ReactNode;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  children: ReactNode;
}

/**
 * PageShell — padrão de página do sistema.
 * Slots: título · descrição · ação principal · KPIs · abas · filtros · busca · conteúdo.
 */
export const PageShell = ({
  title,
  description,
  primaryAction,
  secondaryActions,
  kpis,
  tabs,
  activeTab,
  onTabChange,
  filters,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  children,
}: PageShellProps) => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {secondaryActions}
            {primaryAction}
          </div>
        </div>

        {kpis && kpis.length > 0 && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {kpis.map((k, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-lg font-semibold mt-1">{k.value}</p>
                  {k.hint && <p className="text-xs text-muted-foreground mt-0.5">{k.hint}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tabs && tabs.length > 0 && (
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList>
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {(filters || onSearchChange) && (
          <div className="flex flex-wrap items-center gap-2">
            {onSearchChange && (
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9 rounded-xl"
                />
              </div>
            )}
            {filters}
          </div>
        )}

        {children}
      </div>
    </DashboardLayout>
  );
};
