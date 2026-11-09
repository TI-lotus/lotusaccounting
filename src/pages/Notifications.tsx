import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  CheckSquare,
  CreditCard,
  FileText,
  MessageSquare,
  Search,
} from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type UserNotificationRow = Database["public"]["Tables"]["user_notifications"]["Row"];

const notificationMeta = (kind: string) => {
  const map = {
    message: { label: "Mensagens", icon: MessageSquare },
    document_request_overdue: { label: "Documentos", icon: FileText },
    document_request_uploaded: { label: "Documentos", icon: FileText },
    document_request_rejected: { label: "Documentos", icon: FileText },
    fiscal_obligation_due: { label: "Vencimentos", icon: CalendarClock },
    task_overdue: { label: "Tarefas", icon: CheckSquare },
    task_review_rejected: { label: "Revisões", icon: CheckSquare },
    client_period_blocked: { label: "Ciclo mensal", icon: CalendarClock },
    client_period_stale: { label: "Ciclo mensal", icon: CalendarClock },
    invoice_overdue: { label: "Faturas", icon: CreditCard },
  } satisfies Record<string, { label: string; icon: React.ElementType }>;

  return map[kind as keyof typeof map] ?? { label: "Sistema", icon: Bell };
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<UserNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "unread" | "read">("all");
  const [category, setCategory] = useState("all");

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setNotifications((data ?? []) as UserNotificationRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-page:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setNotifications((current) => current.filter((item) => item.id !== payload.old.id));
            return;
          }
          setNotifications((current) => [payload.new as UserNotificationRow, ...current.filter((item) => item.id !== payload.new.id)]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 200));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const categories = useMemo(() => {
    const byKind = new Map<string, string>();
    notifications.forEach((notification) => byKind.set(notification.kind, notificationMeta(notification.kind).label));
    return Array.from(byKind.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return notifications
      .filter((notification) => category === "all" || notification.kind === category)
      .filter((notification) => status === "all" || (status === "unread" ? !notification.read_at : !!notification.read_at))
      .filter((notification) => {
        if (!normalizedQuery) return true;
        return [notification.title, notification.body, notification.kind]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      });
  }, [category, notifications, query, status]);

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const readAt = () => new Date().toISOString();

  const markOneRead = async (notification: UserNotificationRow) => {
    if (notification.read_at) return;
    const value = readAt();
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: value } : item));
    await supabase.from("user_notifications").update({ read_at: value }).eq("id", notification.id);
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (!unreadIds.length) return;
    const value = readAt();
    setNotifications((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, read_at: value } : item));
    await supabase.from("user_notifications").update({ read_at: value }).in("id", unreadIds);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Centro operacional</p>
            <h1 className="text-3xl font-semibold tracking-tight">Notificações</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unreadCount} não lidas em {notifications.length} registros recentes.
            </p>
          </div>
          <Button onClick={markAllRead} disabled={!unreadCount} className="rounded-xl">
            Marcar todas como lidas
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar por título, descrição ou tipo"
              className="h-11 rounded-xl pl-10"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="all">Todas categorias</option>
            {categories.map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | "unread" | "read")}
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="all">Todas</option>
            <option value="unread">Não lidas</option>
            <option value="read">Lidas</option>
          </select>
        </div>

        <div className="space-y-3">
          {loading && (
            <Card className="rounded-2xl">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Carregando notificações...
              </CardContent>
            </Card>
          )}

          {!loading && filteredNotifications.length === 0 && (
            <Card className="rounded-2xl">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma notificação encontrada.
              </CardContent>
            </Card>
          )}

          {filteredNotifications.map((notification) => {
            const meta = notificationMeta(notification.kind);
            const Icon = meta.icon;
            return (
              <Card
                key={notification.id}
                className={cn(
                  "rounded-2xl transition-colors hover:bg-accent/35",
                  !notification.read_at && "border-primary/30 bg-primary/5",
                )}
              >
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
                  <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={async () => {
                      await markOneRead(notification);
                      navigate(notification.href || "/");
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium leading-snug">{notification.title}</h2>
                      {!notification.read_at && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    {notification.body && (
                      <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-lg">
                        {meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(notification.created_at)}</span>
                      {notification.read_at && (
                        <span className="text-xs text-muted-foreground">Lida em {formatDate(notification.read_at)}</span>
                      )}
                    </div>
                  </button>
                  <div className="flex gap-2 md:justify-end">
                    {!notification.read_at && (
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void markOneRead(notification)}>
                        Marcar lida
                      </Button>
                    )}
                    <Button size="sm" className="rounded-xl" onClick={() => void markOneRead(notification).then(() => navigate(notification.href || "/"))}>
                      Abrir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
