import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Mail, Loader2, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  needs_human?: boolean;
}

const SUPPORT_EMAIL = "support@dishloopr.com";
const HIDDEN_PREFIXES = ["/admin", "/login", "/auth", "/email-confirm", "/reset-password", "/forgot-password"];
const STORAGE_KEY = "dishloopr_support_session";

function getSessionId() {
  if (typeof window === "undefined") return "";
  let s = localStorage.getItem(STORAGE_KEY);
  if (!s) {
    s = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, s);
  }
  return s;
}

export function SupportChat() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hoi! 👋 Ik ben de AI-assistent van Dishloopr. Stel gerust je vraag — over zoeken, je account, restaurants claimen of iets anders.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [escalateCount, setEscalateCount] = useState(0);
  const [showMailCta, setShowMailCta] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  if (hidden) return null;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMsg: ChatMessage = { role: "user", content: text };
    setMessages((m) => [...m, newMsg]);
    setLoading(true);

    try {
      const sessionId = getSessionId();
      const history = messages.filter((m) => m.role !== "assistant" || !m.content.startsWith("Hoi! 👋"));

      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: {
          conversationId,
          sessionId,
          message: text,
          history,
        },
      });

      if (error) throw error;
      if (data?.error === "rate_limit") {
        toast.error("Even rustig — te veel berichten. Probeer over een minuut opnieuw.");
        return;
      }
      if (data?.error === "ai_credits_exhausted") {
        toast.error("AI tijdelijk niet beschikbaar. Mail ons direct.");
        setShowMailCta(true);
        return;
      }
      if (!data?.answer) throw new Error("no answer");

      if (data.conversationId) setConversationId(data.conversationId);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.answer,
        needs_human: data.needs_human,
      };
      setMessages((m) => [...m, assistantMsg]);

      if (data.needs_human) {
        const next = escalateCount + 1;
        setEscalateCount(next);
        if (next >= 2) setShowMailCta(true);
      }

      // Detect explicit user request for human contact
      const lower = text.toLowerCase();
      if (/(mail|email|menselijk|medewerker|support|contact opnemen|spreek iemand|echt persoon)/i.test(lower)) {
        setShowMailCta(true);
      }
    } catch (err) {
      console.error(err);
      const next = escalateCount + 1;
      setEscalateCount(next);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Er ging iets mis bij het ophalen van een antwoord. Probeer het nog eens of mail ons direct.",
        },
      ]);
      if (next >= 2) setShowMailCta(true);
    } finally {
      setLoading(false);
    }
  };

  const buildMailto = () => {
    const transcript = messages
      .map((m) => `${m.role === "user" ? "Ik" : "AI"}: ${m.content}`)
      .join("\n\n");
    const subject = encodeURIComponent("Vraag aan Dishloopr support");
    const body = encodeURIComponent(
      `Hoi Dishloopr,\n\n[Beschrijf hier je vraag]\n\n---\nGesprek met AI-assistent:\n\n${transcript}`
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <>
      {/* Floating launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            aria-label="Open hulp chat"
            className="fixed z-50 bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-shadow"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed z-50 bottom-20 right-4 md:bottom-6 md:right-6 w-[calc(100vw-2rem)] sm:w-96 h-[32rem] max-h-[calc(100vh-6rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Dishloopr Hulp</p>
                  <p className="text-xs opacity-80">AI-assistent · meestal direct antwoord</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Sluit chat" className="p-1 rounded-md hover:bg-primary-foreground/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-muted/30">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 max-w-[80%] text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-background border border-border rounded-bl-sm"
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_a]:text-primary">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-background border border-border rounded-2xl rounded-bl-sm px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}

              {showMailCta && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-primary/5 border border-primary/20 rounded-xl p-3 mt-2"
                >
                  <p className="text-sm text-foreground mb-2">
                    Lukt het niet? Mail ons team direct — we reageren binnen 24 uur.
                  </p>
                  <Button asChild size="sm" className="w-full">
                    <a href={buildMailto()}>
                      <Mail className="w-4 h-4 mr-2" />
                      Mail support@dishloopr.com
                    </a>
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border p-3 bg-card">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Typ je vraag…"
                  rows={1}
                  maxLength={2000}
                  className="min-h-[40px] max-h-32 resize-none text-sm"
                  disabled={loading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  size="icon"
                  aria-label="Verstuur"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}