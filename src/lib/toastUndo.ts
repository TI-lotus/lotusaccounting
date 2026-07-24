import { toast } from "sonner";

/**
 * toastWithUndo — toast padrão para ações reversíveis.
 * Exibe botão "Desfazer" por 5s antes de confirmar a ação.
 */
export function toastWithUndo(opts: {
  message: string;
  description?: string;
  onUndo: () => void | Promise<void>;
  onConfirm?: () => void | Promise<void>;
  duration?: number;
}) {
  const { message, description, onUndo, onConfirm, duration = 5000 } = opts;
  let undone = false;

  const id = toast(message, {
    description,
    duration,
    action: {
      label: "Desfazer",
      onClick: () => {
        undone = true;
        toast.dismiss(id);
        void onUndo();
        toast.success("Ação desfeita");
      },
    },
  });

  if (onConfirm) {
    window.setTimeout(() => {
      if (!undone) void onConfirm();
    }, duration);
  }
}
