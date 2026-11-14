import { useEffect, useState } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useData } from "@/contexts/DataContext";
import { cn } from "@/lib/utils";

export const CompanySelector = () => {
  const { clients } = useData();
  const activeClients = clients.filter((client) => client.status === "active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = activeClients.find((client) => client.id === selectedId) ?? activeClients[0];

  useEffect(() => {
    if (selected?.id && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected?.id, selectedId]);

  if (!selected) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs",
            "bg-muted/50 transition-colors hover:bg-muted",
          )}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="text-muted-foreground">{selected.cnpj || "CNPJ não informado"}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[232px]">
        {activeClients.map((client) => (
          <DropdownMenuItem
            key={client.id}
            onClick={() => setSelectedId(client.id)}
            className="flex cursor-pointer items-center gap-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{client.name}</p>
              <p className="text-xs text-muted-foreground">{client.cnpj || "CNPJ não informado"}</p>
            </div>
            {selected.id === client.id && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
