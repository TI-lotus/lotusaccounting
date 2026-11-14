import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SortDirection = "asc" | "desc";

interface SortToggleProps {
  label: string;
  direction: SortDirection;
  onChange: (direction: SortDirection) => void;
}

/** Alterna a direção da ordenação sem ocupar a barra com mais um controle textual. */
export const SortToggle = ({ label, direction, onChange }: SortToggleProps) => {
  const nextDirection: SortDirection = direction === "asc" ? "desc" : "asc";
  const Icon = direction === "asc" ? ChevronUp : ChevronDown;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-9 w-9 rounded-full"
      aria-label={`Ordenação ${label}: ${direction === "asc" ? "crescente" : "decrescente"}`}
      title={`Ordenação ${label}: ${direction === "asc" ? "crescente" : "decrescente"}`}
      onClick={() => onChange(nextDirection)}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
};
