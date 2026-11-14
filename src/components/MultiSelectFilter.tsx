import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectFilterOption {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectFilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  emptyLabel?: string;
  className?: string;
}

export const MultiSelectFilter = ({
  label,
  options,
  value,
  onChange,
  emptyLabel = "Todos",
  className,
}: MultiSelectFilterProps) => {
  const selectedLabels = options.filter((option) => value.includes(option.value)).map((option) => option.label);
  const triggerLabel = selectedLabels.length === 0
    ? emptyLabel
    : selectedLabels.length === 1
      ? selectedLabels[0]
      : `${selectedLabels.length} selecionados`;

  const toggleValue = (optionValue: string, checked: boolean) => {
    onChange(checked ? [...value, optionValue] : value.filter((item) => item !== optionValue));
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-9 w-full justify-between rounded-lg px-3 text-xs font-normal">
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(260px,calc(100vw-2rem))] rounded-xl p-1.5">
          <div className="space-y-1">
            {options.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/70",
                  option.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <Checkbox
                  checked={value.includes(option.value)}
                  disabled={option.disabled}
                  onCheckedChange={(checked) => toggleValue(option.value, checked === true)}
                  aria-label={option.label}
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {typeof option.count === "number" && (
                  <span className="text-xs tabular-nums text-muted-foreground">{option.count}</span>
                )}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
