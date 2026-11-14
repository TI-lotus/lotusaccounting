import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Archive, ArchiveRestore, AlertCircle, CheckCheck, MessageSquare, Mic, MoreHorizontal, Paperclip, Pin, Plus, RefreshCw, Search, Send, Smile, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { IconTooltipButton } from "@/components/IconTooltipButton";

type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type Recipient = { userId: string; name: string; role: "Administrador" | "Colaborador" | "Responsavel"; avatarUrl: string | null };

const relativeTime = (value?: string | null) => value
  ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })
  : "Sem data";

const messageTime = (value?: string | null) => value
  ? format(new Date(value), "HH:mm")
  : "";

const initials = (value: string) => value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "LT";

const Messages = () => {
  const { user, profile } = useAuth();
  const { tenantId, clients } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [conversationRows, setConversationRows] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastMessageRefreshAt = useRef(0);
  const { members } = useWorkspaceMembers();

  const isClient = profile?.account_type === "client";
  const ownCompany = clients.find((client) => client.id === profile?.company_id);

  const loadMessages = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [conversationRes, messageRes] = await Promise.all([
        supabase.from("conversations").select("*").eq("tenant_id", tenantId).eq("channel", "internal").order("created_at", { ascending: false }),
        supabase.from("messages").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: true }),
      ]);
      const requestError = conversationRes.error ?? messageRes.error;
      if (requestError) {
        const message = "Não foi possível atualizar as conversas. Seus dados anteriores continuam disponíveis.";
        setLoadError(message);
        toast.error(requestError.message);
        return;
      }
      setLoadError(null);
      setConversationRows((conversationRes.data ?? []) as ConversationRow[]);
      setMessages((messageRes.data ?? []) as MessageRow[]);
    } catch (error) {
      const message = "Não foi possível atualizar as conversas. Verifique sua conexão e tente novamente.";
      setLoadError(message);
      toast.error(error instanceof Error ? error.message : message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setConversationRows([]);
      setMessages([]);
      setLoading(false);
      return;
    }
    void loadMessages();
  }, [loadMessages, tenantId]);

  useEffect(() => {
    if (!tenantId || !user) return;
    const channel = supabase
      .channel(`messages:${tenantId}:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        const message = payload.new as MessageRow;
        if (payload.eventType === "INSERT" && message.sender_id !== user.id) toast.info("Nova mensagem recebida");
        void loadMessages();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `tenant_id=eq.${tenantId}` }, () => {
        void loadMessages();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadMessages, tenantId, user]);

  useEffect(() => {
    if (!tenantId || !user) return;
    const refreshWhenActive = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastMessageRefreshAt.current < 10_000) return;
      lastMessageRefreshAt.current = now;
      void loadMessages();
    };

    window.addEventListener("online", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);
    return () => {
      window.removeEventListener("online", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [loadMessages, tenantId, user]);

  useEffect(() => {
    if (!tenantId || !user) {
      setOnlineUserIds(new Set());
      return;
    }

    const presenceChannel = supabase.channel(`workspace-presence:${tenantId}`, {
      config: { presence: { key: user.id } },
    });
    const syncPresence = () => {
      try {
        setOnlineUserIds(new Set(Object.keys(presenceChannel.presenceState())));
      } catch {
        setOnlineUserIds(new Set());
      }
    };

    presenceChannel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void presenceChannel
          .track({ online_at: new Date().toISOString() })
          .then(syncPresence)
          .catch(() => setOnlineUserIds(new Set()));
      });

    return () => {
      void supabase.removeChannel(presenceChannel);
    };
  }, [tenantId, user]);

  const recipients = useMemo<Recipient[]>(() => {
    if (isClient) {
      if (!ownCompany?.responsibleUserId) return [];
      const responsible = members.find((member) => member.userId === ownCompany.responsibleUserId);
      return [{
        userId: ownCompany.responsibleUserId,
        name: responsible?.fullName || ownCompany.responsibleUserName || "Responsavel da conta",
        role: "Responsavel",
        avatarUrl: responsible?.avatarUrl ?? null,
      }];
    }
    return members.filter((member) => member.userId !== user?.id && member.accountType !== "client").map((member) => ({
      userId: member.userId,
      name: member.fullName,
      role: member.accountType === "admin" ? "Administrador" : "Colaborador",
      avatarUrl: member.avatarUrl,
    }));
  }, [isClient, members, ownCompany?.responsibleUserId, ownCompany?.responsibleUserName, user?.id]);

  const recipientById = useMemo(() => new Map(recipients.map((recipient) => [recipient.userId, recipient])), [recipients]);
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const conversationIds = useMemo(() => new Set(conversationRows.map((conversation) => conversation.id)), [conversationRows]);
  const messagesByConversation = useMemo(() => {
    const grouped = new Map<string, MessageRow[]>();
    messages.filter((message) => message.conversation_id && conversationIds.has(message.conversation_id)).forEach((message) => {
      const list = grouped.get(message.conversation_id as string) ?? [];
      list.push(message);
      grouped.set(message.conversation_id as string, list);
    });
    return grouped;
  }, [conversationIds, messages]);

  const conversations = useMemo(() => conversationRows.map((conversation) => {
    const otherUserId = conversation.created_by === user?.id ? conversation.recipient_id : conversation.created_by;
    const recipient = otherUserId ? recipientById.get(otherUserId) : undefined;
    const otherMember = otherUserId ? members.find((member) => member.userId === otherUserId) : undefined;
    const client = conversation.company_id ? clientById.get(conversation.company_id) : undefined;
    const threadMessages = messagesByConversation.get(conversation.id) ?? [];
    return {
      ...conversation,
      name: recipient?.name || otherMember?.fullName || client?.name || conversation.title || "Conversa interna",
      role: recipient?.role || (client ? "Cliente" : "Colaborador"),
      otherUserId,
      avatarUrl: recipient?.avatarUrl || otherMember?.avatarUrl || null,
      lastMessage: threadMessages.at(-1),
    };
  }), [clientById, conversationRows, members, messagesByConversation, recipientById, user?.id]);

  const visibleConversations = conversations.filter((conversation) => Boolean(conversation.is_archived) === showArchived);
  const filteredConversations = visibleConversations.filter((conversation) => {
    const query = searchTerm.trim().toLowerCase();
    return !query || conversation.name.toLowerCase().includes(query) || (conversation.lastMessage?.message || "").toLowerCase().includes(query);
  });
  const orderedConversations = [...filteredConversations].sort((a, b) => {
    if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) return a.is_pinned ? -1 : 1;
    return new Date(b.lastMessage?.created_at ?? b.created_at ?? 0).getTime() - new Date(a.lastMessage?.created_at ?? a.created_at ?? 0).getTime();
  });
  const requestedConversationId = searchParams.get("conversation");
  useEffect(() => {
    if (!requestedConversationId || !conversationRows.some((conversation) => conversation.id === requestedConversationId)) return;
    setSelectedConversation(requestedConversationId);
    setSearchParams({}, { replace: true });
  }, [conversationRows, requestedConversationId, setSearchParams]);
  const effectiveSelectedId = selectedConversation ?? orderedConversations[0]?.id ?? null;
  const currentConversation = conversations.find((conversation) => conversation.id === effectiveSelectedId);
  const currentMessages = effectiveSelectedId ? messagesByConversation.get(effectiveSelectedId) ?? [] : [];
  const currentContactOnline = Boolean(currentConversation?.otherUserId && onlineUserIds.has(currentConversation.otherUserId));

  useEffect(() => {
    if (!effectiveSelectedId || !user) return;
    void supabase
      .rpc("mark_internal_conversation_read", { target_conversation_id: effectiveSelectedId })
      .then(({ error }) => {
        if (error) console.error("Could not mark messages as read", error);
      });
  }, [currentMessages.length, effectiveSelectedId, user]);

  const startConversation = async () => {
    if (!tenantId || !user || !recipientId) return;
    const existing = conversationRows.find((conversation) =>
      (conversation.created_by === user.id && conversation.recipient_id === recipientId)
      || (conversation.created_by === recipientId && conversation.recipient_id === user.id),
    );
    if (existing) {
      setSelectedConversation(existing.id);
      setContactOpen(false);
      return;
    }
    const { data, error } = await supabase
      .from("conversations")
      .insert({ tenant_id: tenantId, company_id: isClient ? profile?.company_id ?? null : null, channel: "internal", created_by: user.id, recipient_id: recipientId })
      .select("*")
      .maybeSingle();
    if (error || !data) {
      toast.error(error?.message ?? "Nao foi possivel iniciar a conversa.");
      return;
    }
    setConversationRows((current) => [data as ConversationRow, ...current]);
    setSelectedConversation(data.id);
    setContactOpen(false);
    setRecipientId("");
  };

  const updateConversationPreference = async (
    conversationId: string,
    updates: Pick<Database["public"]["Tables"]["conversations"]["Update"], "is_pinned" | "is_archived">,
  ) => {
    const { data, error } = await supabase.rpc("set_internal_conversation_preference", {
      target_conversation_id: conversationId,
      next_is_pinned: updates.is_pinned ?? null,
      next_is_archived: updates.is_archived ?? null,
    });
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível atualizar a conversa.");
      return false;
    }
    setConversationRows((current) => current.map((conversation) => conversation.id === conversationId ? data : conversation));
    return true;
  };

  const toggleConversationPinned = async (conversation: ConversationRow) => {
    await updateConversationPreference(conversation.id, { is_pinned: !conversation.is_pinned });
  };

  const toggleConversationArchived = async (conversation: ConversationRow) => {
    const archived = await updateConversationPreference(conversation.id, { is_archived: !conversation.is_archived });
    if (archived && !conversation.is_archived && selectedConversation === conversation.id) {
      setSelectedConversation(null);
    }
  };

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !tenantId || !currentConversation || !user) return;
    setNewMessage("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ tenant_id: tenantId, company_id: currentConversation.company_id, conversation_id: currentConversation.id, sender_id: user.id, message: content })
      .select("*")
      .maybeSingle();
    if (error || !data) {
      toast.error("Erro ao enviar mensagem: " + (error?.message ?? "acesso negado"));
      setNewMessage(content);
      return;
    }
    setMessages((current) => [...current, data as MessageRow]);
  };

  return (
    <DashboardLayout className="min-h-0 overflow-hidden !p-0 lg:!pl-[3.75rem] lg:!pr-0">
      <div className="flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden bg-card lg:flex-row">
          <aside className="flex h-[42%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-border bg-card lg:h-auto lg:w-[340px] lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-3 sm:px-4">
              <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                <DialogTrigger asChild>
                  <Button type="button" size="icon" aria-label="Nova conversa" title="Nova conversa" className="h-10 w-10 shrink-0 rounded-full" disabled={!recipients.length}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="dialog-window new-conversation-dialog">
                  <DialogHeader className="dialog-header">
                    <DialogTitle>Nova conversa</DialogTitle>
                    <DialogDescription>{isClient ? "Seu responsável é o único contato disponível." : "Selecione um colaborador ou administrador ativo."}</DialogDescription>
                  </DialogHeader>
                  <div className="dialog-body space-y-2">
                    <Label htmlFor="new-conversation-recipient">Destinatário</Label>
                    <Select value={recipientId} onValueChange={setRecipientId}>
                      <SelectTrigger id="new-conversation-recipient" className="h-11 rounded-xl">
                        <SelectValue placeholder="Selecione o destinatário" />
                      </SelectTrigger>
                      <SelectContent>
                        {recipients.map((recipient) => <SelectItem key={recipient.userId} value={recipient.userId}>{recipient.name} · {recipient.role}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter className="dialog-footer">
                    <Button variant="outline" onClick={() => setContactOpen(false)}>Cancelar</Button>
                    <Button onClick={() => void startConversation()} disabled={!recipientId}>Iniciar conversa</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar conversas" className="rounded-xl pl-10" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
            </div>
            <div className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 sm:px-4">
              {loading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando conversas...</p>}
              {!loading && loadError && <div className="space-y-3 py-12 text-center text-muted-foreground" role="alert"><AlertCircle className="mx-auto h-8 w-8 text-gilver" aria-hidden="true" /><p className="text-sm font-medium text-foreground">Não foi possível atualizar</p><p className="px-3 text-xs leading-5">{loadError}</p><Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void loadMessages()}><RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />Tentar novamente</Button></div>}
              {!loading && !loadError && orderedConversations.length === 0 && <div className="py-12 text-center text-muted-foreground"><MessageSquare className="mx-auto mb-3 h-8 w-8 opacity-60" /><p className="text-sm font-medium text-foreground">{showArchived ? "Nenhuma conversa arquivada" : "Nenhuma conversa ainda"}</p><p className="mt-1 text-xs">{showArchived ? "As conversas arquivadas aparecerão aqui." : "Inicie uma conversa com um contato autorizado."}</p></div>}
              {!loading && !loadError && orderedConversations.map((conversation) => <div key={conversation.id} className={cn("flex w-full items-center gap-1 rounded-xl p-1.5 text-left transition-colors", effectiveSelectedId === conversation.id ? "bg-gilver/20" : "hover:bg-accent/50")}>
                <button type="button" onClick={() => setSelectedConversation(conversation.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={conversation.avatarUrl ?? undefined} /><AvatarFallback className="bg-gilver/20 text-sm font-medium text-gilver">{initials(conversation.name)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-medium">{conversation.name}</p>{conversation.is_pinned && <Pin className="h-3 w-3 shrink-0 text-gilver" fill="currentColor" aria-label="Conversa fixada" />}<span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{relativeTime(conversation.lastMessage?.created_at ?? conversation.created_at)}</span></div><p className="truncate text-xs text-muted-foreground">{conversation.lastMessage?.message || "Nenhuma mensagem enviada"}</p></div>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`Ações da conversa com ${conversation.name}`} title="Ações da conversa" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={6} className="min-w-[190px]">
                    <DropdownMenuItem onSelect={() => void toggleConversationPinned(conversation)}><Pin className="mr-2 h-4 w-4" />{conversation.is_pinned ? "Desafixar conversa" : "Fixar conversa"}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void toggleConversationArchived(conversation)}>{conversation.is_archived ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}{conversation.is_archived ? "Desarquivar conversa" : "Arquivar conversa"}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>)}
            </div>
            <div className="shrink-0 border-t border-border/70 px-3 py-3 sm:px-4">
              <button type="button" onClick={() => setShowArchived((current) => !current)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {showArchived ? <ArchiveRestore className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />}
                <span>{showArchived ? "Conversas ativas" : "Arquivadas"}</span>
                {!showArchived && conversations.filter((conversation) => conversation.is_archived).length > 0 && <span className="ml-auto text-xs">{conversations.filter((conversation) => conversation.is_archived).length}</span>}
              </button>
            </div>
          </aside>

          <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
            {!currentConversation ? <div className="grid flex-1 place-items-center text-center text-muted-foreground"><div><MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-60" /><p className="text-sm font-medium text-foreground">Selecione uma conversa</p></div></div> : <>
              <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6"><Avatar className="h-9 w-9"><AvatarImage src={currentConversation.avatarUrl ?? undefined} /><AvatarFallback className="bg-gilver/20 font-medium text-gilver">{initials(currentConversation.name)}</AvatarFallback></Avatar><div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><p className="truncate text-sm font-medium">{currentConversation.name}</p><Badge variant="outline" className="h-4 px-1.5 text-[10px]">{currentConversation.role}</Badge></div><p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", currentContactOnline ? "bg-emerald-500" : "bg-muted-foreground/50")} aria-hidden="true" />{currentContactOnline ? "Online" : "Offline"}</p></div></div>
              <div className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain bg-background px-4 py-4 pb-40 sm:px-6 sm:py-6 sm:pb-44">{currentMessages.length === 0 && <div className="grid h-full place-items-center text-center text-muted-foreground"><div><Users className="mx-auto mb-3 h-8 w-8 opacity-60" /><p className="text-sm">Envie a primeira mensagem.</p></div></div>}{currentMessages.map((message, index) => { const isMe = message.sender_id === user?.id; const isRead = Boolean(message.read_at); const previous = currentMessages[index - 1]; const next = currentMessages[index + 1]; const sameAsPrevious = previous?.sender_id === message.sender_id; const sameAsNext = next?.sender_id === message.sender_id; return <div key={message.id} className={cn("flex", isMe ? "justify-end" : "justify-start", index > 0 && !sameAsPrevious && "pt-3")}><div className={cn("max-w-[40%] break-words rounded-2xl px-4 py-2.5", isMe ? "bg-primary text-primary-foreground" : "bg-gilver text-white", isMe ? (sameAsPrevious ? "rounded-t-md" : "rounded-tr-md") : (sameAsPrevious ? "rounded-t-md" : "rounded-tl-md"), sameAsNext && "rounded-b-md")}><p className="text-sm">{message.message}</p><div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", isMe ? "text-primary-foreground/65" : "text-white/70")}><span>{messageTime(message.created_at)}</span>{isMe && <CheckCheck className={cn("h-3.5 w-3.5", isRead ? "text-sky-300" : "text-primary-foreground/70")} aria-label={isRead ? "Lida" : "Entregue"} />}</div></div></div>; })}</div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-background/95 sm:h-12" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-1 sm:px-5 sm:pb-2">
                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/80 bg-card/95 px-3 py-1.5 shadow-[0_10px_30px_hsl(var(--foreground)/0.12)] backdrop-blur-xl transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                  <Paperclip className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <Input placeholder="Digite uma mensagem" className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0" value={newMessage} onChange={(event) => setNewMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void handleSendMessage(); } }} />
                  <Smile className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
                  <IconTooltipButton icon={newMessage.trim() ? Send : Mic} label={newMessage.trim() ? "Enviar mensagem" : "Gravar áudio"} className="h-9 w-9 shrink-0 bg-transparent text-muted-foreground hover:bg-foreground/10 hover:text-foreground" onClick={() => { if (newMessage.trim()) void handleSendMessage(); }} disabled={!newMessage.trim()} />
                </div>
              </div>
            </>}
          </section>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
