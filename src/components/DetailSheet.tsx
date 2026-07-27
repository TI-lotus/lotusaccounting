import { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: string;
}

/**
 * DetailSheet — painel lateral padrão para detalhes de cliente/pagamento/documento/execução.
 * Inclui histórico e ações contextuais nos slots.
 */
export const DetailSheet = ({
  open,
  onOpenChange,
  title,
  description,
  actions,
  children,
  width = "sm:max-w-xl",
}: DetailSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className={`${width} w-full flex flex-col p-0`}>
      <SheetHeader className="p-6 pb-4 border-b">
        <SheetTitle>{title}</SheetTitle>
        {description && <SheetDescription>{description}</SheetDescription>}
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="p-6">{children}</div>
      </ScrollArea>
      {actions && (
        <div className="border-t p-4 flex items-center justify-end gap-2 bg-background">
          {actions}
        </div>
      )}
    </SheetContent>
  </Sheet>
);
