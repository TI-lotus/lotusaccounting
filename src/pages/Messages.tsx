import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { CheckCheck, MessageSquare, Plus, Search, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";

type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type Recipient = { userId: string; name: string; role: "Administrador" | "Colaborador" | "Responsavel"; avatarUrl: string | null };

const relativeTime = (value?: string | null) => value
  ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })
  : "Sem data";

const initials = (value: string) => value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "LT";

const Messages = () => {
  const { user, profile } = useAuth();
  const { tenantId, clients } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [conversationRows, setConversationRows] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { members } = useWorkspaceMembers();

  const isClient = profile?.account_type === "client";
  const ownCompany = clients.find((client) => client.id === profile?.company_id);

  const loadMessages = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [conversationRes, messageRes] = await Promise.all([
      supabase.from("conversations").select("*").eq("channel", "internal").order("created_at", { ascending: false }),
      supabase.from("messages").select("*").order("created_at", { ascending: true }),
    ]);
    if (conversationRes.error) toast.error("Erro ao carregar conversas: " + conversationRes.error.message);
    if (messageRes.error) toast.error("Erro ao carregar mensagens: " + messageRes.error.message);
    setConversationRows((conversationRes.data ?? []) as ConversationRow[]);
    setMessages((messageRes.data ?? []) as MessageRow[]);
    setLoading(false);
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
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadMessages, tenantId, user]);

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
      avatarUrl: recipient?.avatarUrl || otherMember?.avatarUrl || null,
      lastMessage: threadMessages.at(-1),
    };
  }), [clientById, conversationRows, members, messagesByConversation, recipientById, user?.id]);

  const filteredConversations = conversations.filter((conversation) => {
    const query = searchTerm.trim().toLowerCase();
    return !query || conversation.name.toLowerCase().includes(query) || (conversation.lastMessage?.message || "").toLowerCase().includes(query);
  });
  const requestedConversationId = searchParams.get("conversation");
  useEffect(() => {
    if (!requestedConversationId || !conversationRows.some((conversation) => conversation.id === requestedConversationId)) return;
    setSelectedConversation(requestedConversationId);
    setSearchParams({}, { replace: true });
  }, [conversationRows, requestedConversationId, setSearchParams]);
  const effectiveSelectedId = selectedConversation ?? filteredConversations[0]?.id ?? null;
  const currentConversation = conversations.find((conversation) => conversation.id === effectiveSelectedId);
  const currentMessages = effectiveSelectedId ? messagesByConversation.get(effectiveSelectedId) ?? [] : [];

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
    <DashboardLayout className="h-[calc(100vh-4rem)] overflow-hidden p-4 md:p-6">
      <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(180px,0.42fr)_minmax(280px,1fr)] gap-4 overflow-hidden lg:gap-6 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] xl:grid-rows-1">
          <aside className="glass flex min-h-0 flex-col overflow-hidden rounded-2xl p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2">
              <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={() => setContactOpen(true)} disabled={!recipients.length} aria-label="Nova conversa" title="Nova conversa"><Plus className="h-4 w-4" /></Button>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Nova conversa</DialogTitle><DialogDescription>{isClient ? "Seu responsavel e o unico contato disponivel." : "Selecione um colaborador ou administrador ativo."}</DialogDescription></DialogHeader>
                  <Select value={recipientId} onValueChange={setRecipientId}><SelectTrigger><SelectValue placeholder="Selecione o destinatario" /></SelectTrigger><SelectContent>{recipients.map((recipient) => <SelectItem key={recipient.userId} value={recipient.userId}>{recipient.name} - {recipient.role}</SelectItem>)}</SelectContent></Select>
                  <DialogFooter><Button variant="outline" onClick={() => setContactOpen(false)}>Cancelar</Button><Button onClick={() => void startConversation()} disabled={!recipientId}>Iniciar conversa</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar conversas" className="rounded-xl pl-10" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
            </div>
            <div className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto">
              {loading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando conversas...</p>}
              {!loading && filteredConversations.length === 0 && <div className="py-12 text-center text-muted-foreground"><MessageSquare className="mx-auto mb-3 h-8 w-8 opacity-60" /><p className="text-sm font-medium text-foreground">Nenhuma conversa ainda</p><p className="mt-1 text-xs">Inicie uma conversa com um contato autorizado.</p></div>}
              {filteredConversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedConversation(conversation.id)} className={cn("flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors", effectiveSelectedId === conversation.id ? "bg-gilver/20" : "hover:bg-accent/50")}><Avatar className="h-10 w-10 shrink-0"><AvatarImage src={conversation.avatarUrl ?? undefined} /><AvatarFallback className="bg-gilver/20 text-sm font-medium text-gilver">{initials(conversation.name)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{conversation.name}</p><span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(conversation.lastMessage?.created_at ?? conversation.created_at)}</span></div><p className="truncate text-xs text-muted-foreground">{conversation.lastMessage?.message || "Nenhuma mensagem enviada"}</p></div></button>)}
            </div>
          </aside>

          <section className="glass flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl p-4 sm:p-6">
            {!currentConversation ? <div className="grid flex-1 place-items-center text-center text-muted-foreground"><div><MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-60" /><p className="text-sm font-medium text-foreground">Selecione uma conversa</p></div></div> : <>
              <div className="flex shrink-0 items-center gap-3 border-b border-border pb-4"><Avatar className="h-10 w-10"><AvatarImage src={currentConversation.avatarUrl ?? undefined} /><AvatarFallback className="bg-gilver/20 font-medium text-gilver">{initials(currentConversation.name)}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate font-medium">{currentConversation.name}</p><Badge variant="outline" className="mt-1 h-4 px-1.5 text-[10px]">{currentConversation.role}</Badge></div></div>
              <div className="sidebar-scroll min-h-0 flex-1 space-y-4 overflow-y-auto py-4 sm:py-6">{currentMessages.length === 0 && <div className="grid h-full place-items-center text-center text-muted-foreground"><div><Users className="mx-auto mb-3 h-8 w-8 opacity-60" /><p className="text-sm">Envie a primeira mensagem.</p></div></div>}{currentMessages.map((message) => { const isMe = message.sender_id === user?.id; const isRead = Boolean(message.read_at); return <div key={message.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}><div className={cn("max-w-[82%] break-words rounded-2xl px-4 py-2.5", isMe ? "rounded-tr-md bg-gilver text-[hsl(0,0%,9%)]" : "rounded-tl-md bg-muted")}><p className="text-sm">{message.message}</p><div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", isMe ? "text-[hsl(0,0%,9%)]/60" : "text-muted-foreground")}><span>{relativeTime(message.created_at)}</span>{isMe && <CheckCheck className={cn("h-3.5 w-3.5", isRead ? "text-sky-600 dark:text-sky-300" : "text-slate-500")} aria-label={isRead ? "Lida" : "Entregue"} />}</div></div></div>; })}</div>
              <div className="flex shrink-0 items-center gap-2 border-t border-border pt-4"><Input placeholder="Digite uma mensagem" className="flex-1 rounded-xl" value={newMessage} onChange={(event) => setNewMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void handleSendMessage(); } }} /><Button size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label="Enviar mensagem" title="Enviar mensagem" onClick={() => void handleSendMessage()} disabled={!newMessage.trim()}><Send className="h-4 w-4" aria-hidden="true" /></Button></div>
            </>}
          </section>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
