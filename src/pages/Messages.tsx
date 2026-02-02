import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { MessageSquare, Send, Search, Phone, Video, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { useViewMode } from "@/contexts/ViewModeContext";

const officeConversations = [
  { id: 1, name: "Sarah Johnson", role: "Accountant", message: "The quarterly report is ready for review", time: "2m ago", unread: true, online: true },
  { id: 2, name: "Mike Chen", role: "CFO", message: "Can we discuss the budget forecast?", time: "1h ago", unread: true, online: true },
  { id: 3, name: "System", role: "Notification", message: "Invoice #1234 has been paid", time: "3h ago", unread: true, online: false },
  { id: 4, name: "Lisa Williams", role: "Client Manager", message: "New client onboarding complete", time: "Yesterday", unread: false, online: false },
  { id: 5, name: "System", role: "Alert", message: "Bank sync completed successfully", time: "Yesterday", unread: false, online: false },
  { id: 6, name: "Roberto Santos", role: "Auditor", message: "Finished reviewing the Q3 statements", time: "2 days ago", unread: false, online: true },
  { id: 7, name: "Ana Costa", role: "Tax Specialist", message: "Tax deadline reminder sent to clients", time: "3 days ago", unread: false, online: false },
  { id: 8, name: "Carlos Mendes", role: "Partner", message: "Meeting scheduled for next week", time: "4 days ago", unread: false, online: false },
];

const clientConversations = [
  { id: 101, name: "Lotus Contabilidade", role: "Seu Contador", message: "Seus documentos fiscais foram processados com sucesso", time: "1h ago", unread: true, online: true },
  { id: 102, name: "Claison Kepler", role: "Gerente de Conta", message: "Olá! Vi que você tem uma nova fatura pendente", time: "3h ago", unread: true, online: true },
];

const messageThreads: Record<number, Array<{ id: number; sender: string; content: string; time: string; isMe: boolean }>> = {
  1: [
    { id: 1, sender: "Sarah Johnson", content: "Hi John, the quarterly report is ready for your review. I've included all the revenue breakdowns and expense analysis.", time: "10:30 AM", isMe: false },
    { id: 2, sender: "Me", content: "Thanks Sarah! I'll take a look at it this afternoon.", time: "10:32 AM", isMe: true },
    { id: 3, sender: "Sarah Johnson", content: "Great! Let me know if you have any questions or need any clarifications.", time: "10:33 AM", isMe: false },
    { id: 4, sender: "Me", content: "Will do. Also, can you prepare the comparison with last quarter?", time: "10:35 AM", isMe: true },
    { id: 5, sender: "Sarah Johnson", content: "Already included! Check page 5 of the report.", time: "10:36 AM", isMe: false },
  ],
  2: [
    { id: 1, sender: "Mike Chen", content: "John, we need to discuss the Q2 budget forecast.", time: "9:00 AM", isMe: false },
    { id: 2, sender: "Me", content: "Sure, what's on your mind?", time: "9:05 AM", isMe: true },
    { id: 3, sender: "Mike Chen", content: "I'm seeing some discrepancies in the marketing allocation. Can we schedule a call?", time: "9:10 AM", isMe: false },
    { id: 4, sender: "Me", content: "Absolutely. How about tomorrow at 2 PM?", time: "9:15 AM", isMe: true },
    { id: 5, sender: "Mike Chen", content: "Perfect. I'll send a calendar invite.", time: "9:16 AM", isMe: false },
  ],
  6: [
    { id: 1, sender: "Roberto Santos", content: "Good morning! I've finished reviewing the Q3 statements.", time: "Yesterday", isMe: false },
    { id: 2, sender: "Me", content: "That was fast! Any issues found?", time: "Yesterday", isMe: true },
    { id: 3, sender: "Roberto Santos", content: "Everything looks good. Just a minor discrepancy in account 4502 that I've noted.", time: "Yesterday", isMe: false },
    { id: 4, sender: "Me", content: "Thanks for the thorough review. I'll check that account.", time: "Yesterday", isMe: true },
  ],
};

const clientMessageThreads: Record<number, Array<{ id: number; sender: string; content: string; time: string; isMe: boolean }>> = {
  101: [
    { id: 1, sender: "Lotus Contabilidade", content: "Olá! Seus documentos fiscais de janeiro foram processados com sucesso.", time: "1h ago", isMe: false },
    { id: 2, sender: "Me", content: "Obrigado! Posso baixar os relatórios?", time: "1h ago", isMe: true },
    { id: 3, sender: "Lotus Contabilidade", content: "Sim, todos os documentos estão disponíveis na aba Documentos. Qualquer dúvida, estamos aqui!", time: "55m ago", isMe: false },
  ],
  102: [
    { id: 1, sender: "Claison Kepler", content: "Olá! Vi que você tem uma nova fatura pendente de aprovação.", time: "3h ago", isMe: false },
    { id: 2, sender: "Me", content: "Sim, vou verificar agora. Qual é o valor?", time: "2h ago", isMe: true },
    { id: 3, sender: "Claison Kepler", content: "A fatura #INV-2024-0089 é de R$ 1.250,00 referente aos serviços de janeiro.", time: "2h ago", isMe: false },
    { id: 4, sender: "Me", content: "Perfeito, vou aprovar.", time: "1h ago", isMe: true },
    { id: 5, sender: "Claison Kepler", content: "Ótimo! Qualquer dúvida sobre suas tarefas pendentes, me avise.", time: "1h ago", isMe: false },
  ],
};

const Messages = () => {
  const { viewMode } = useViewMode();
  const conversations = viewMode === "office" ? officeConversations : clientConversations;
  const allMessageThreads = viewMode === "office" ? messageThreads : clientMessageThreads;
  
  const [selectedConversation, setSelectedConversation] = useState(conversations[0]?.id || 1);
  const [newMessage, setNewMessage] = useState("");

  const currentConversation = conversations.find(c => c.id === selectedConversation);
  const currentMessages = allMessageThreads[selectedConversation] || [];

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setNewMessage("");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
          <p className="text-muted-foreground">Comunicações internas e notificações</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-220px)]">
          {/* Conversations List */}
          <div className="glass rounded-2xl p-4 animate-fade-in overflow-hidden flex flex-col">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar mensagens..." className="pl-10 rounded-xl" />
            </div>
            <div className="space-y-2 overflow-y-auto flex-1">
              {conversations.map((conv, index) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                    selectedConversation === conv.id 
                      ? "bg-gilver/30 dark:bg-gilver/10" 
                      : conv.unread 
                        ? "bg-primary/5" 
                        : "hover:bg-accent/50"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className={cn(
                        "font-medium",
                        conv.name === "System" 
                          ? "bg-primary/10 text-primary" 
                          : "bg-gilver text-foreground"
                      )}>
                        {conv.name === "System" ? <MessageSquare className="h-4 w-4" /> : conv.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    {conv.online && conv.name !== "System" && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={cn("font-medium text-sm truncate", conv.unread && "text-foreground")}>
                        {conv.name}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">{conv.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{conv.message}</p>
                  </div>
                  {conv.unread && (
                    <div className="w-2 h-2 bg-gilver-dark rounded-full shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Message Thread */}
          <div className="glass rounded-2xl p-6 lg:col-span-2 animate-fade-in flex flex-col">
            {currentConversation && (
              <>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gilver text-foreground">
                          {currentConversation.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      {currentConversation.online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{currentConversation.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {currentConversation.role} • {currentConversation.online ? "Online" : "Offline"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="rounded-xl">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl">
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 py-6 space-y-4 overflow-y-auto">
                  {currentMessages.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.isMe ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "rounded-2xl px-4 py-2 max-w-[80%]",
                        msg.isMe 
                          ? "bg-primary text-primary-foreground rounded-tr-md" 
                          : "bg-gilver/30 dark:bg-gilver/10 rounded-tl-md"
                      )}>
                        <p className="text-sm">{msg.content}</p>
                        <span className={cn(
                          "text-xs mt-1 block",
                          msg.isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>{msg.time}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <Input 
                    placeholder="Digite uma mensagem..." 
                    className="rounded-xl flex-1"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <Button size="icon" className="rounded-xl h-10 w-10" onClick={handleSendMessage}>
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
