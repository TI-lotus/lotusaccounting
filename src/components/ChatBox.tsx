import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import liaBg from "@/assets/lotus-insights.png";

interface ChatMessage {
  id: string;
  from: "user" | "bot";
  text: string;
}

const WELCOME: ChatMessage = {
  id: "welcome",
  from: "bot",
  text: "Olá! Sou a Lia, sua assistente da Lotus. Como posso ajudar você hoje?",
};

export const ChatBox = () => {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (!session) {
      toast.error("Faça login para conversar com a Lia");
      return;
    }

    const userMsg: ChatMessage = { id: crypto.randomUUID(), from: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
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

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[360px] max-w-[calc(100vw-2.5rem)] h-[480px] flex flex-col rounded-2xl border border-border bg-card shadow-soft-lg overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 bg-sidebar text-sidebar-foreground">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gilver/15 text-gilver">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Lia · Assistente Lotus</p>
                <p className="text-xs text-sidebar-foreground/70">
                  {sending ? "Digitando…" : "Online"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 hover:bg-sidebar-accent"
              aria-label="Fechar chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scroll p-3 space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                    m.from === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {m.text}
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
          <div className="border-t border-border p-2 flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={session ? "Escreva uma mensagem…" : "Faça login para conversar"}
              disabled={sending || !session}
              className="rounded-xl"
            />
            <Button
              size="icon"
              className="rounded-xl"
              onClick={send}
              disabled={sending || !session || !input.trim()}
              aria-label="Enviar mensagem"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
      <Button
        size="icon"
        className="h-12 w-12 rounded-full shadow-soft-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir chat com a Lia"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </div>
  );
};
