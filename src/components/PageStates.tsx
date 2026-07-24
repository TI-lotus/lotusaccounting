import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Inbox, Lock } from "lucide-react";

interface StateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: StateProps) => (
  <div className="text-center py-12 text-muted-foreground">
    <div className="mx-auto mb-3 h-10 w-10 flex items-center justify-center opacity-60">
      {icon ?? <Inbox className="h-8 w-8" />}
    </div>
    <p className="text-sm font-medium text-foreground">{title}</p>
    {description && <p className="text-xs mt-1">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState = ({
  title = "Não foi possível carregar",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) => (
  <div className="text-center py-12">
    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
    <p className="text-sm font-medium">{title}</p>
    {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    {onRetry && (
      <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={onRetry}>
        Tentar novamente
      </Button>
    )}
  </div>
);

export const NoPermissionState = ({
  title = "Sem permissão",
  description = "Você não tem acesso a este recurso. Fale com um administrador.",
}: {
  title?: string;
  description?: string;
}) => (
  <div className="text-center py-12 text-muted-foreground">
    <Lock className="h-8 w-8 mx-auto mb-2 opacity-60" />
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="text-xs mt-1">{description}</p>
  </div>
);

export const LoadingState = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-14 w-full rounded-xl" />
    ))}
  </div>
);
