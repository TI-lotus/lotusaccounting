import { useState, useRef, useEffect } from "react";
import { X, Send, User, Paperclip, Image, FileText, Sheet, FileType } from "lucide-react";
import liaIconImage from "@/assets/lia-icon.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

const initialMessages: Message[] = [
  {
    id: "1",
    content: "Olá! Sou sua assistente de contabilidade com IA. Como posso ajudar você hoje? Posso auxiliar com análises financeiras, relatórios, consultas fiscais e muito mais.",
    role: "assistant",
    timestamp: new Date(),
  },
];

const mockResponses = [
  "Baseado nos seus dados financeiros, posso ver que a receita do último trimestre aumentou 12.5%. Posso detalhar por cliente ou categoria?",
  "Encontrei 3 faturas vencidas totalizando R$ 23.450. Deseja que eu envie lembretes automáticos aos clientes?",
  "O fluxo de caixa projetado para o próximo mês mostra um saldo positivo de R$ 45.200. Posso preparar um relatório detalhado.",
  "Analisando seus pagamentos recentes, identifiquei uma oportunidade de otimizar despesas em 8%. Quer saber mais?",
  "Seu CNPJ está regular na Receita Federal. Próximas obrigações fiscais: DCTF (dia 15) e EFD (dia 20).",
];

interface AIAgentChatProps {
  open: boolean;
  onClose: () => void;
}

export const AIAgentChat = ({ open, onClose }: AIAgentChatProps) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: randomResponse,
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  if (!open) return null;

  return (
    <div className={cn(
      "fixed bottom-24 right-6 z-50",
      "w-[380px] h-[520px]",
      "bg-card border border-border rounded-2xl shadow-xl",
      "flex flex-col overflow-hidden",
      "animate-fade-in"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-accent/30">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-xl bg-primary/10">
            <img src={liaIconImage} alt="Lia" className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Lia</h3>
            <p className="text-xs text-muted-foreground">Assistente Contábil</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-lg hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                message.role === "assistant" 
                  ? "bg-accent" 
                  : "bg-primary"
              )}>
                {message.role === "assistant" ? (
                  <img src={liaIconImage} alt="Lia" className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4 text-primary-foreground" />
                )}
              </div>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                message.role === "assistant"
                  ? "bg-accent/50 text-foreground rounded-tl-md"
                  : "bg-primary text-primary-foreground rounded-tr-md"
              )}>
                {message.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-accent">
                <Droplet className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="bg-accent/50 rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <input ref={fileInputRef} type="file" className="hidden" />
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl shrink-0 h-10 w-10">
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
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Digite sua pergunta..."
            className="flex-1 rounded-xl bg-accent/30 border-0 focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            size="icon"
            className="rounded-xl shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
