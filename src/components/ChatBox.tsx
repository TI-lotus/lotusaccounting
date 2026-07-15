import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Loader2,
  Minus,
  Paperclip,
  Headset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import liaBg from "@/assets/lotus-insights.png";

interface ChatMessage {
  id: string;
  from: "user" | "bot";
  text: string;
  attachments?: { name: string; size: number }[];
}

const WELCOME: ChatMessage = {
  id: "welcome",
  from: "bot",
  text: "Olá! Sou a Lia, sua assistente da Lotus. Como posso ajudar você hoje?",
};

export type ChatPanelState = "open" | "minimized" | "closed";

interface ChatBoxProps {
  state: ChatPanelState;
  onStateChange: (s: ChatPanelState) => void;
}

export const ChatBox = ({ state, onStateChange }: ChatBoxProps) => {
  const { session } = useAuth();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, state]);

  const send = async () => {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || sending) return;

    if (!session) {
      toast.error("Faça login para conversar com a Lia");
      return;
    }

    const attachments = pendingFiles.map((f) => ({ name: f.name, size: f.size }));
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      from: "user",
      text: text || "(anexos enviados)",
      attachments: attachments.length ? attachments : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingFiles([]);
    setSending(true);

    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));

      const { data, error } = await supabase.functions.invoke("lia-chat", {
        body: { message: text, history },
      });

      if (error) throw error;

      const reply =
        (typeof data === "string" ? data : data?.reply) ??
        "Recebi sua mensagem, mas não consegui formular uma resposta agora.";

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), from: "bot", text: String(reply) },
      ]);
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao falar com a Lia";
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), from: "bot", text: `⚠️ ${msg}` },
      ]);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const requestHuman = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        from: "bot",
        text: "Conectando você a um atendente humano da Lotus. Um especialista entrará em contato em instantes.",
      },
    ]);
    toast.success("Solicitação de atendimento humano registrada");
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setPendingFiles((prev) => [...prev, ...Array.from(files)]);
  };

  // Closed state: floating button to reopen
  if (state === "closed") {
    return (
      <Button
        size="icon"
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-chat text-white border-2 border-white/20 hover:opacity-95"
        style={{
          backgroundImage: `url(${liaBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        onClick={() => onStateChange("open")}
        aria-label="Abrir chat com a Lia"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
    );
  }

  // Minimized state: thin vertical rail on the right
  if (state === "minimized") {
    return (
      <button
        onClick={() => onStateChange("open")}
        className="fixed right-0 top-16 bottom-0 z-40 w-12 flex flex-col items-center justify-start gap-3 pt-4 border-l border-border bg-card shadow-chat hover:bg-accent/50 transition-colors"
        aria-label="Expandir chat com a Lia"
      >
        <div
          className="h-9 w-9 rounded-xl text-white flex items-center justify-center"
          style={{
            backgroundImage: `url(${liaBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <span
          className="text-xs font-semibold tracking-wide text-muted-foreground"
          style={{ writingMode: "vertical-rl" }}
        >
          Lia · Assistente
        </span>
      </button>
    );
  }

  // Open state: full side panel
  return (
    <aside
      className={cn(
        "fixed z-40 flex flex-col border-l border-border bg-card shadow-chat",
        // Mobile: overlay fullscreen; Desktop: fixed right column
        "inset-0 top-16 lg:inset-auto lg:top-16 lg:bottom-0 lg:right-0 lg:w-[380px]"
      )}
    >
      {/* Header */}
      <div
        className="relative flex items-center justify-between px-4 py-3 text-white shrink-0"
        style={{
          backgroundImage: `url(${liaBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/15 text-white backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Lia</p>
            <p className="text-xs text-white/80">
              {sending ? "Digitando…" : "Online"}
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-1">
          <button
            onClick={() => onStateChange("minimized")}
            className="rounded-lg p-1 hover:bg-white/15"
            aria-label="Minimizar chat"
            title="Minimizar"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => onStateChange("closed")}
            className="rounded-lg p-1 hover:bg-white/15"
            aria-label="Fechar chat"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scroll p-3 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                m.from === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {m.text}
              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.attachments.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs bg-black/10 rounded-lg px-2 py-1"
                    >
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{a.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground rounded-2xl px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Lia está pensando…
            </div>
          </div>
        )}
      </div>

      {/* Human handoff */}
      <div className="px-3 pt-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={requestHuman}
          className="w-full gap-2 rounded-xl border-gilver/40 text-gilver hover:bg-gilver/10 hover:text-gilver"
        >
          <Headset className="h-4 w-4" />
          Falar com um atendente humano
        </Button>
      </div>

      {/* Pending attachments */}
      {pendingFiles.length > 0 && (
        <div className="px-3 pt-2 flex flex-wrap gap-1.5 shrink-0">
          {pendingFiles.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 text-xs bg-muted rounded-lg px-2 py-1"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[140px] truncate">{f.name}</span>
              <button
                onClick={() =>
                  setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remover anexo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border p-2 flex items-end gap-2 shrink-0">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          className="rounded-xl shrink-0 h-10 w-10"
          onClick={() => fileRef.current?.click()}
          disabled={sending || !session}
          aria-label="Anexar documento"
          title="Anexar documento"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={session ? "Escreva uma mensagem…" : "Faça login para conversar"}
          disabled={sending || !session}
          rows={1}
          className="rounded-xl min-h-10 max-h-32 resize-none flex-1"
        />
        <Button
          size="icon"
          className="rounded-xl shrink-0 h-10 w-10"
          onClick={send}
          disabled={sending || !session || (!input.trim() && pendingFiles.length === 0)}
          aria-label="Enviar mensagem"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
};
