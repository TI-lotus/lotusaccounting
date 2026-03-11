import { useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const companies = [
  { id: 1, name: "Kepler Tecnologia LTDA", cnpj: "12.345.678/0001-90" },
  { id: 2, name: "KP Consultoria ME", cnpj: "98.765.432/0001-10" },
  { id: 3, name: "CK Investimentos SA", cnpj: "11.222.333/0001-44" },
];

export const CompanySelector = () => {
  const [selected, setSelected] = useState(companies[0]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-xl",
          "bg-muted/50 hover:bg-muted transition-colors text-left text-xs"
        )}>
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{selected.name}</p>
            <p className="text-muted-foreground">{selected.cnpj}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[232px]">
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => setSelected(company)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{company.name}</p>
              <p className="text-xs text-muted-foreground">{company.cnpj}</p>
            </div>
            {selected.id === company.id && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
