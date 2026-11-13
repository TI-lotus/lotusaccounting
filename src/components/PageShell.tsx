import { ReactNode } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { FilterPopover } from "@/components/FilterPopover";
import { KPITrend } from "@/components/dashboard/KPICard";
import { Search } from "lucide-react";

export interface PageShellKPI {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: number[];
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
  filterCount?: number;
  onClearFilters?: () => void;
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
  filterCount = 0,
  onClearFilters,
  children,
}: PageShellProps) => {
  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1280px] space-y-8">
        <div className="page-header flex flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="text-[28px] font-normal leading-tight tracking-[-0.035em] text-foreground sm:text-[30px]">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">{description}</p>}
          </div>
          <div className="page-header-actions flex items-center gap-2">
            {secondaryActions}
            {primaryAction}
          </div>
        </div>

        {kpis && kpis.length > 0 && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            {kpis.map((k, i) => (
              <Card key={i} className="kpi-card">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                      <p className="text-lg font-semibold mt-1">{k.value}</p>
                      {k.hint && <p className="text-xs text-muted-foreground mt-0.5">{k.hint}</p>}
                    </div>
                    <KPITrend values={k.trend} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tabs && tabs.length > 0 && (
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="segmented-tabs">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {(filters || onSearchChange) && (
          <div className="filter-toolbar flex flex-wrap items-center gap-2">
            {onSearchChange && (
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  name="page-search"
                  autoComplete="off"
                  aria-label={searchPlaceholder}
                  className="h-10 rounded-xl border-border/70 bg-card/80 pl-9"
                />
              </div>
            )}
            {filters && (
              <FilterPopover activeCount={filterCount} onClear={onClearFilters}>
                {filters}
              </FilterPopover>
            )}
          </div>
        )}

        {children}
      </div>
    </DashboardLayout>
  );
};
