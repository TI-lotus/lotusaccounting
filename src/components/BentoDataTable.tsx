import { ReactNode } from "react";
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
}: BentoDataTableProps<Row>) => (
  <div className={cn("table-surface", className)}>
    <Table className="min-w-[760px]">
      <TableHeader className="bg-secondary/45">
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={cn(
                "h-11 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
                column.headerClassName,
              )}
            >
              {column.label}
            </TableHead>
          ))}
          {actions && (
            <TableHead className="h-11 w-[96px] text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Ações
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="h-40 text-center text-sm text-muted-foreground">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
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
