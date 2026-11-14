import { ReactNode, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface BentoTableColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortValue?: (row: Row) => string | number | Date | null | undefined;
}

interface BentoDataTableProps<Row> {
  rows: Row[];
  columns: BentoTableColumn<Row>[];
  getRowKey: (row: Row) => string;
  actions?: (row: Row) => ReactNode;
  empty: ReactNode;
  className?: string;
}

/** Tabela responsiva para listas operacionais, com superfície bento contínua. */
export const BentoDataTable = <Row,>({
  rows,
  columns,
  getRowKey,
  actions,
  empty,
  className,
}: BentoDataTableProps<Row>) => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const column = columns.find((item) => item.key === sortKey);
    if (!column?.sortValue) return rows;
    return [...rows].sort((left, right) => {
      const leftValue = column.sortValue?.(left);
      const rightValue = column.sortValue?.(right);
      if (leftValue == null && rightValue == null) return 0;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      const a = leftValue instanceof Date ? leftValue.getTime() : leftValue;
      const b = rightValue instanceof Date ? rightValue.getTime() : rightValue;
      const comparison = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [columns, rows, sortDirection, sortKey]);

  const toggleSort = (column: BentoTableColumn<Row>) => {
    if (!column.sortValue) return;
    if (sortKey === column.key) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(column.key);
    setSortDirection("asc");
  };

  return (
    <div className={cn("table-surface", className)}>
      <Table className="min-w-[760px]">
        <TableHeader className="bg-secondary/45">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const isSorted = sortKey === column.key;
              const SortIcon = !isSorted ? ChevronsUpDown : sortDirection === "asc" ? ChevronUp : ChevronDown;
              return (
                <TableHead
                  key={column.key}
                  aria-sort={isSorted ? sortDirection === "asc" ? "ascending" : "descending" : undefined}
                  className={cn(
                    "h-11 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
                    column.headerClassName,
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md text-left outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
                      onClick={() => toggleSort(column)}
                    >
                      {column.label}
                      <SortIcon className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : column.label}
                </TableHead>
              );
            })}
            {actions && (
              <TableHead className="h-11 w-[96px] text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Ações
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="h-40 text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            sortedRows.map((row) => (
              <TableRow key={getRowKey(row)} className="group hover:bg-accent/35">
                {columns.map((column) => (
                  <TableCell key={column.key} className={cn("min-w-0", column.className)}>
                    {column.render(row)}
                  </TableCell>
                ))}
                {actions && <TableCell className="text-right">{actions(row)}</TableCell>}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
