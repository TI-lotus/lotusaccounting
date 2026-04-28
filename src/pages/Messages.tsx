import { useState, useRef } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { MessageSquare, Send, Search, Phone, Video, MoreVertical, Paperclip, Bot, Building2, Users, Image, FileText, Sheet, FileType, PanelLeftClose, PanelLeftOpen, Mail, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";

type ChatRole = "client" | "staff" | "ai";

interface Conversation {
  id: number;
  name: string;
  role: string;
  chatRole: ChatRole;
  message: string;
  time: string;
  unread: boolean;
  online: boolean;
  phone?: string;
  email?: string;
}

const roleConfig: Record<ChatRole, { label: string; icon: React.ElementType; color: string }> = {
  client: { label: "Clientes", icon: Building2, color: "text-emerald-500" },
  staff: { label: "Equipe", icon: Users, color: "text-gilver" },
  ai: { label: "Agente IA", icon: Bot, color: "text-blue-500" },
};

const officeConversations: Conversation[] = [
  { id: 1, name: "Sarah Johnson", role: "Contadora", chatRole: "staff", message: "O relatório trimestral está pronto para revisão", time: "2m atrás", unread: true, online: true, phone: "(11) 98888-1001", email: "sarah@lotus.com" },
  { id: 2, name: "Mike Chen", role: "CFO", chatRole: "staff", message: "Podemos discutir a previsão orçamentária?", time: "1h atrás", unread: true, online: true },
  { id: 6, name: "Roberto Santos", role: "Auditor", chatRole: "staff", message: "Terminei a revisão dos demonstrativos do Q3", time: "2 dias atrás", unread: false, online: true },
  { id: 7, name: "Ana Costa", role: "Fiscal", chatRole: "staff", message: "Lembrete de prazo enviado aos clientes", time: "3 dias atrás", unread: false, online: false },
  { id: 10, name: "Acme Corporation", role: "Cliente", chatRole: "client", message: "Precisamos da guia DAS deste mês", time: "4h atrás", unread: true, online: false },
  { id: 11, name: "TechStart Inc", role: "Cliente", chatRole: "client", message: "Obrigado pelo relatório!", time: "1 dia atrás", unread: false, online: false },
  { id: 3, name: "Lótus IA", role: "Assistente", chatRole: "ai", message: "3 documentos classificados automaticamente", time: "3h atrás", unread: true, online: true },
  { id: 5, name: "Sistema", role: "Notificação", chatRole: "ai", message: "Sincronização bancária concluída", time: "Ontem", unread: false, online: true },
];

const clientConversations: Conversation[] = [
  { id: 101, name: "Lotus Contabilidade", role: "Seu Contador", chatRole: "staff", message: "Seus documentos fiscais foram processados com sucesso", time: "1h atrás", unread: true, online: true },
  { id: 102, name: "Claison Kepler", role: "Gerente de Conta", chatRole: "staff", message: "Olá! Vi que você tem uma nova fatura pendente", time: "3h atrás", unread: true, online: true },
  { id: 103, name: "Lótus IA", role: "Assistente", chatRole: "ai", message: "Posso ajudar com dúvidas fiscais!", time: "5h atrás", unread: false, online: true },
];

const messageThreads: Record<number, Array<{ id: number; sender: string; content: string; time: string; isMe: boolean }>> = {
  1: [
    { id: 1, sender: "Sarah Johnson", content: "Olá, o relatório trimestral está pronto para sua revisão. Incluí todas as análises de receita e despesas.", time: "10:30", isMe: false },
    { id: 2, sender: "Me", content: "Obrigado, Sarah! Vou revisar esta tarde.", time: "10:32", isMe: true },
    { id: 3, sender: "Sarah Johnson", content: "Ótimo! Me avise se tiver dúvidas.", time: "10:33", isMe: false },
  ],
  2: [
    { id: 1, sender: "Mike Chen", content: "Precisamos discutir a previsão orçamentária do Q2.", time: "9:00", isMe: false },
    { id: 2, sender: "Me", content: "Claro, o que está em mente?", time: "9:05", isMe: true },
    { id: 3, sender: "Mike Chen", content: "Vi algumas discrepâncias na alocação de marketing.", time: "9:10", isMe: false },
  ],
  3: [
    { id: 1, sender: "Lótus IA", content: "Classifiquei automaticamente 3 documentos: 2 Notas Fiscais e 1 DAS.", time: "14:00", isMe: false },
    { id: 2, sender: "Me", content: "Perfeito, quais clientes foram associados?", time: "14:05", isMe: true },
    { id: 3, sender: "Lótus IA", content: "Acme Corporation (2 NFs) e TechStart Inc (1 DAS). Confiança média de 92%.", time: "14:06", isMe: false },
  ],
  10: [
    { id: 1, sender: "Acme Corporation", content: "Bom dia, precisamos da guia DAS deste mês.", time: "08:30", isMe: false },
    { id: 2, sender: "Me", content: "Bom dia! Vou preparar e enviar ainda hoje.", time: "08:45", isMe: true },
  ],
  101: [
    { id: 1, sender: "Lotus Contabilidade", content: "Olá! Seus documentos fiscais de janeiro foram processados com sucesso.", time: "1h atrás", isMe: false },
    { id: 2, sender: "Me", content: "Obrigado! Posso baixar os relatórios?", time: "1h atrás", isMe: true },
    { id: 3, sender: "Lotus Contabilidade", content: "Sim, todos os documentos estão disponíveis na aba Documentos.", time: "55m atrás", isMe: false },
  ],
  102: [
    { id: 1, sender: "Claison Kepler", content: "Olá! Vi que você tem uma nova fatura pendente de aprovação.", time: "3h atrás", isMe: false },
    { id: 2, sender: "Me", content: "Sim, vou verificar agora. Qual é o valor?", time: "2h atrás", isMe: true },
    { id: 3, sender: "Claison Kepler", content: "A fatura #INV-2024-0089 é de R$ 1.250,00 referente aos serviços de janeiro.", time: "2h atrás", isMe: false },
  ],
  103: [
    { id: 1, sender: "Lótus IA", content: "Olá! Sou o assistente inteligente da Lótus. Posso ajudar com dúvidas fiscais, consultas de documentos e muito mais.", time: "5h atrás", isMe: false },
  ],
};

const Messages = () => {
  const { viewMode } = useViewMode();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [activeRoleFilter, setActiveRoleFilter] = useState<ChatRole | "all">("all");
  const [listCollapsed, setListCollapsed] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const conversations = viewMode === "office" ? officeConversations : clientConversations;
  
  const filteredConversations = activeRoleFilter === "all" 
    ? conversations 
    : conversations.filter(c => c.chatRole === activeRoleFilter);

  const effectiveSelectedId = selectedConversation ?? conversations[0]?.id ?? 1;
  const currentConversation = conversations.find(c => c.id === effectiveSelectedId);
  const currentMessages = messageThreads[effectiveSelectedId] || [];

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setNewMessage("");
    }
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
  const availableRoles = roles.filter(r => conversations.some(c => c.chatRole === r));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
          <p className="text-muted-foreground">Comunicações internas e notificações</p>
        </div>

        <div className={cn("grid grid-cols-1 gap-4 lg:gap-6 h-[calc(100vh-150px)] min-h-0", listCollapsed ? "xl:grid-cols-[56px_minmax(0,1fr)]" : "xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]")}>
          {/* Conversations List */}
          <div className="glass rounded-2xl p-3 sm:p-4 animate-fade-in overflow-hidden flex flex-col min-h-0">
            <Button variant="ghost" size="icon" className="mb-2 rounded-xl" onClick={() => setListCollapsed(!listCollapsed)}>
              {listCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            {!listCollapsed && <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar mensagens..." className="pl-10 rounded-xl" />
            </div>

            {/* Role filter tabs */}
            <div className="flex gap-1 mb-3 flex-wrap">
              <Button
                variant={activeRoleFilter === "all" ? "default" : "ghost"}
                size="sm"
                className="rounded-lg text-xs h-7 px-2"
                onClick={() => setActiveRoleFilter("all")}
              >
                Todas
              </Button>
              {availableRoles.map(role => {
                const config = roleConfig[role];
                const Icon = config.icon;
                const count = conversations.filter(c => c.chatRole === role && c.unread).length;
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
                    {count > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">{count}</Badge>
                    )}
                  </Button>
                );
              })}
            </div>

            <div className="space-y-1 overflow-y-auto flex-1 sidebar-scroll">
              {filteredConversations.map((conv, index) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                    effectiveSelectedId === conv.id 
                      ? "bg-gilver/20" 
                      : conv.unread 
                        ? "bg-gilver/5" 
                        : "hover:bg-accent/50"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className={cn(
                        "font-medium text-sm",
                        conv.chatRole === "ai"
                          ? "bg-blue-500/10 text-blue-500"
                          : conv.chatRole === "client"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-gilver/20 text-gilver"
                      )}>
                        {conv.chatRole === "ai" ? <Bot className="h-4 w-4" /> : conv.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {conv.online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-card rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={cn("font-medium text-sm truncate", conv.unread && "text-foreground")}>
                        {conv.name}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{conv.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.message}</p>
                  </div>
                  {conv.unread && (
                    <div className="w-2 h-2 bg-gilver rounded-full shrink-0" />
                  )}
                </div>
              ))}
            </div>
            </>}
          </div>

          {/* Message Thread */}
          <div className="glass rounded-2xl p-4 sm:p-6 animate-fade-in flex flex-col min-w-0 min-h-0">
            {currentConversation && (
              <>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10 cursor-pointer" onClick={() => setContactOpen(true)}>
                        <AvatarFallback className={cn(
                          "font-medium",
                          currentConversation.chatRole === "ai"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-gilver/20 text-gilver"
                        )}>
                          {currentConversation.chatRole === "ai" ? <Bot className="h-4 w-4" /> : currentConversation.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      {currentConversation.online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-card rounded-full" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium truncate max-w-[180px] sm:max-w-none">{currentConversation.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {roleConfig[currentConversation.chatRole].label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {currentConversation.online ? "Online" : "Offline"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8">
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                  <DialogContent className="sm:max-w-[420px] rounded-2xl">
                    <DialogHeader><DialogTitle>{currentConversation.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3 text-sm">
                      {[{ icon: Phone, label: "WhatsApp", value: currentConversation.phone ?? "(11) 99999-0000" }, { icon: Phone, label: "Telefone fixo", value: "(11) 3000-0000" }, { icon: Instagram, label: "Instagram", value: "@lotus.contabil" }, { icon: Mail, label: "Email", value: currentConversation.email ?? "contato@lotus.com" }, { icon: Send, label: "Telegram", value: "@lotuscontabil" }].map((item) => (
                        <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border p-3">
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                          <div><p className="font-medium">{item.label}</p><p className="text-muted-foreground">{item.value}</p></div>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
                
                <div className="flex-1 py-4 sm:py-6 space-y-4 overflow-y-auto sidebar-scroll min-h-0">
                  {currentMessages.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.isMe ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "rounded-2xl px-4 py-2.5 max-w-[88%] sm:max-w-[80%] break-words",
                        msg.isMe 
                          ? "bg-gilver text-[hsl(0,0%,9%)] rounded-tr-md" 
                          : "bg-muted rounded-tl-md"
                      )}>
                        <p className="text-sm">{msg.content}</p>
                        <span className={cn(
                          "text-[10px] mt-1 block",
                          msg.isMe ? "text-[hsl(0,0%,9%)]/60" : "text-muted-foreground"
                        )}>{msg.time}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-border">
                  <input ref={fileInputRef} type="file" multiple className="hidden" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 shrink-0">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="rounded-xl z-[99999]">
                      <DropdownMenuItem onClick={() => handleAttach("image")} className="gap-2">
                        <Image className="h-4 w-4" /> Imagem
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAttach("pdf")} className="gap-2">
                        <FileText className="h-4 w-4" /> PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAttach("spreadsheet")} className="gap-2">
                        <Sheet className="h-4 w-4" /> Planilha
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAttach("document")} className="gap-2">
                        <FileType className="h-4 w-4" /> Documento Word
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Input 
                    placeholder="Digite uma mensagem..." 
                    className="rounded-xl flex-1"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <Button size="icon" className="rounded-xl h-10 w-10 shrink-0" onClick={handleSendMessage}>
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
