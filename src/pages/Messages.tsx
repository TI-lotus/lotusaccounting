import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Bot,
  Building2,
  FileText,
  FileType,
  Image,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Sheet,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import whatsappLogo from "@/assets/whatsapp-logo.png";
import gmailLogo from "@/assets/gmail-logo.png";
import messengerLogo from "@/assets/messenger-logo.png";

type ChatRole = "client" | "staff" | "ai";
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

interface ConversationView {
  id: string;
  companyId: string | null;
  name: string;
  role: string;
  chatRole: ChatRole;
  message: string;
  time: string;
  online: boolean;
  phone?: string;
  email?: string;
}

const roleConfig: Record<ChatRole, { label: string; icon: React.ElementType }> =
  {
    client: { label: "Clientes", icon: Building2 },
    staff: { label: "Equipe", icon: Users },
    ai: { label: "Agente IA", icon: Bot },
  };

const relativeTime = (value?: string | null) =>
  value
    ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })
    : "Sem data";

const initials = (value: string) =>
  value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "LT";

const Messages = () => {
  const { viewMode } = useViewMode();
  const { user } = useAuth();
  const { tenantId, clients } = useData();
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeRoleFilter, setActiveRoleFilter] = useState<ChatRole | "all">(
    "all",
  );
  const [contactOpen, setContactOpen] = useState(false);
  const [conversationRows, setConversationRows] = useState<ConversationRow[]>(
    [],
  );
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

  const loadMessages = async () => {
    setLoading(true);
    const [conversationRes, messageRes] = await Promise.all([
      supabase
        .from("conversations")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

    if (conversationRes.error) {
      toast.error(
        "Erro ao carregar conversas: " + conversationRes.error.message,
      );
    }
    if (messageRes.error) {
      toast.error("Erro ao carregar mensagens: " + messageRes.error.message);
    }

    setConversationRows((conversationRes.data ?? []) as ConversationRow[]);
    setMessages((messageRes.data ?? []) as MessageRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!tenantId) {
      setConversationRows([]);
      setMessages([]);
      setLoading(false);
      return;
    }
    void loadMessages();
  }, [tenantId]);

  const conversations = useMemo<ConversationView[]>(() => {
    return conversationRows
      .map((conversation) => {
        const client = conversation.company_id
          ? clientById.get(conversation.company_id)
          : null;
        const threadMessages = messages.filter(
          (message) => message.conversation_id === conversation.id,
        );
        const lastMessage = threadMessages.at(-1);
        const chatRole: ChatRole =
          conversation.channel === "ai"
            ? "ai"
            : conversation.company_id
              ? "client"
              : "staff";
        return {
          id: conversation.id,
          companyId: conversation.company_id,
          name:
            conversation.title ||
            client?.name ||
            (chatRole === "ai" ? "Lia" : "Conversa interna"),
          role:
            chatRole === "client"
              ? "Cliente"
              : chatRole === "ai"
                ? "Assistente"
                : "Equipe",
          chatRole,
          message: lastMessage?.message || "Nenhuma mensagem enviada ainda",
          time: relativeTime(
            lastMessage?.created_at ?? conversation.created_at,
          ),
          online: chatRole !== "client",
          phone: client?.phone,
          email: client?.email,
        };
      })
      .filter((conversation) =>
        viewMode === "client" ? conversation.chatRole !== "staff" : true,
      );
  }, [clientById, conversationRows, messages, viewMode]);

  const filteredConversations = conversations.filter((conversation) => {
    const roleMatch =
      activeRoleFilter === "all" || conversation.chatRole === activeRoleFilter;
    const query = searchTerm.trim().toLowerCase();
    const searchMatch =
      !query ||
      conversation.name.toLowerCase().includes(query) ||
      conversation.message.toLowerCase().includes(query);
    return roleMatch && searchMatch;
  });

  const effectiveSelectedId =
    selectedConversation ?? filteredConversations[0]?.id ?? null;
  const currentConversation = conversations.find(
    (conversation) => conversation.id === effectiveSelectedId,
  );
  const currentMessages = messages.filter(
    (message) => message.conversation_id === effectiveSelectedId,
  );

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !tenantId || !currentConversation) return;
    setNewMessage("");
    const { data, error } = await supabase
      .from("messages")
      .insert({
        tenant_id: tenantId,
        company_id: currentConversation.companyId,
        conversation_id: currentConversation.id,
        sender_id: user?.id ?? null,
        message: content,
      })
      .select("*")
      .maybeSingle();

    if (error) {
      toast.error("Erro ao enviar mensagem: " + error.message);
      setNewMessage(content);
      return;
    }
    if (data) setMessages((current) => [...current, data as MessageRow]);
  };

  const handleAttach = (type: string) => {
    const acceptMap: Record<string, string> = {
      image: "image/*",
      pdf: ".pdf",
      spreadsheet: ".xlsx,.xls,.csv",
      document: ".doc,.docx",
    };
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptMap[type] || "*";
      fileInputRef.current.click();
    }
  };

  const roles: ChatRole[] = ["staff", "client", "ai"];
  const availableRoles = roles.filter((role) =>
    conversations.some((conversation) => conversation.chatRole === role),
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
          <p className="text-muted-foreground">
            Comunicações internas e notificações
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:gap-6 min-h-[620px] xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
          <div className="glass rounded-2xl p-3 sm:p-4 animate-fade-in overflow-hidden flex flex-col min-h-0">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar mensagens..."
                className="pl-10 rounded-xl"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="flex gap-1 mb-3 flex-wrap">
              <Button
                variant={activeRoleFilter === "all" ? "default" : "ghost"}
                size="sm"
                className="rounded-lg text-xs h-7 px-2"
                onClick={() => setActiveRoleFilter("all")}
              >
                Todas
              </Button>
              {availableRoles.map((role) => {
                const config = roleConfig[role];
                const Icon = config.icon;
                return (
                  <Button
                    key={role}
                    variant={activeRoleFilter === role ? "default" : "ghost"}
                    size="sm"
                    className="rounded-lg text-xs h-7 px-2 gap-1"
                    onClick={() => setActiveRoleFilter(role)}
                  >
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </Button>
                );
              })}
            </div>

            <div className="space-y-1 overflow-y-auto flex-1 sidebar-scroll">
              {loading && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Carregando conversas...
                </p>
              )}
              {!loading && filteredConversations.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <MessageSquare className="mx-auto mb-3 h-8 w-8 opacity-60" />
                  <p className="text-sm font-medium text-foreground">
                    Nenhuma conversa encontrada
                  </p>
                  <p className="mt-1 text-xs">
                    As mensagens aparecerão aqui quando houver conversas no
                    workspace.
                  </p>
                </div>
              )}
              {filteredConversations.map((conversation, index) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors text-left",
                    effectiveSelectedId === conversation.id
                      ? "bg-gilver/20"
                      : "hover:bg-accent/50",
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback
                      className={cn(
                        "font-medium text-sm",
                        conversation.chatRole === "ai"
                          ? "bg-blue-500/10 text-blue-500"
                          : conversation.chatRole === "client"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-gilver/20 text-gilver",
                      )}
                    >
                      {conversation.chatRole === "ai" ? (
                        <Bot className="h-4 w-4" />
                      ) : (
                        initials(conversation.name)
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">
                        {conversation.name}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {conversation.time}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conversation.message}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-6 animate-fade-in flex flex-col min-w-0 min-h-[520px]">
            {!currentConversation ? (
              <div className="grid flex-1 place-items-center text-center text-muted-foreground">
                <div>
                  <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-60" />
                  <p className="text-sm font-medium text-foreground">
                    Selecione uma conversa
                  </p>
                  <p className="mt-1 text-xs">
                    Quando houver mensagens reais, o histórico será exibido
                    aqui.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      className="h-10 w-10 cursor-pointer shrink-0"
                      onClick={() => setContactOpen(true)}
                    >
                      <AvatarFallback
                        className={cn(
                          "font-medium",
                          currentConversation.chatRole === "ai"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-gilver/20 text-gilver",
                        )}
                      >
                        {currentConversation.chatRole === "ai" ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          initials(currentConversation.name)
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {currentConversation.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1.5"
                        >
                          {roleConfig[currentConversation.chatRole].label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {currentConversation.online ? "Online" : "Offline"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl h-8 w-8"
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl h-8 w-8"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                  <DialogContent className="overflow-hidden p-0 sm:max-w-[460px] rounded-2xl">
                    <div className="h-32 bg-accent" />
                    <div className="px-6 pb-6 text-center">
                      <Avatar className="mx-auto -mt-12 h-24 w-24 border-4 border-background">
                        <AvatarFallback className="text-xl bg-gilver/20 text-gilver">
                          {currentConversation.chatRole === "ai" ? (
                            <Bot className="h-8 w-8" />
                          ) : (
                            initials(currentConversation.name)
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <DialogHeader className="mt-3">
                        <DialogTitle className="text-center">
                          {currentConversation.name}
                        </DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        {currentConversation.phone ?? "Telefone não cadastrado"}
                      </p>
                      <div className="mt-5 grid grid-cols-3 gap-2">
                        {[
                          { logo: whatsappLogo, label: "WhatsApp" },
                          { logo: gmailLogo, label: "Email" },
                          { logo: messengerLogo, label: "Messenger" },
                        ].map((item) => (
                          <Button
                            key={item.label}
                            variant="outline"
                            className="h-20 flex-col rounded-xl gap-2"
                          >
                            <img
                              src={item.logo}
                              alt=""
                              className="h-6 w-6 object-contain"
                            />
                            <span className="text-xs">{item.label}</span>
                          </Button>
                        ))}
                      </div>
                      <div className="mt-5 space-y-2 text-left text-sm">
                        <div className="rounded-xl border border-border p-3">
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p>
                            {currentConversation.email ??
                              "Email não cadastrado"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="flex-1 py-4 sm:py-6 space-y-4 overflow-y-auto sidebar-scroll min-h-0 max-h-full">
                  {currentMessages.length === 0 && (
                    <div className="grid h-full place-items-center text-center text-muted-foreground">
                      <div>
                        <MessageSquare className="mx-auto mb-3 h-9 w-9 opacity-60" />
                        <p className="text-sm font-medium text-foreground">
                          Nenhuma mensagem enviada ainda
                        </p>
                      </div>
                    </div>
                  )}
                  {currentMessages.map((message) => {
                    const isMe = message.sender_id === user?.id;
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          isMe ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 max-w-[88%] sm:max-w-[80%] break-words",
                            isMe
                              ? "bg-gilver text-[hsl(0,0%,9%)] rounded-tr-md"
                              : "bg-muted rounded-tl-md",
                          )}
                        >
                          <p className="text-sm">{message.message}</p>
                          <span
                            className={cn(
                              "text-[10px] mt-1 block",
                              isMe
                                ? "text-[hsl(0,0%,9%)]/60"
                                : "text-muted-foreground",
                            )}
                          >
                            {relativeTime(message.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-border">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl h-10 w-10 shrink-0"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="rounded-xl z-[99999]"
                    >
                      <DropdownMenuItem
                        onClick={() => handleAttach("image")}
                        className="gap-2"
                      >
                        <Image className="h-4 w-4" /> Imagem
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleAttach("pdf")}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" /> PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleAttach("spreadsheet")}
                        className="gap-2"
                      >
                        <Sheet className="h-4 w-4" /> Planilha
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleAttach("document")}
                        className="gap-2"
                      >
                        <FileType className="h-4 w-4" /> Documento Word
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Input
                    placeholder="Digite uma mensagem..."
                    className="rounded-xl flex-1"
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    onKeyDown={(event) =>
                      event.key === "Enter" && void handleSendMessage()
                    }
                  />
                  <Button
                    size="icon"
                    className="rounded-xl h-10 w-10 shrink-0"
                    onClick={() => void handleSendMessage()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
