"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { cn, displayName, formatDateTime } from "@/lib/utils";

interface ChatMessage {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

export function ChatArea() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // 加载最近消息 + 订阅实时新消息
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let active = true;

    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!active) return;
        setMessages(((data as ChatMessage[]) ?? []).reverse());
        setLoading(false);
      });

    const channel = supabase
      .channel("chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (!active) return;
          const row = payload.new as ChatMessage;
          setMessages((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // 新消息自动滚到底部
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !user) return;
    if (text.length > 500) {
      setError("一条消息最多 500 字。");
      return;
    }
    setSending(true);
    setError("");
    try {
      const { error: err } = await getSupabaseBrowser()
        .from("messages")
        .insert({
          user_id: user.id,
          content: text,
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
        });
      if (err) setError("发送失败，请稍后再试。");
      else setInput("");
    } catch {
      setError("网络异常，发送失败。");
    } finally {
      setSending(false);
    }
  }, [input, user, profile]);

  return (
    <div className="flex h-[70vh] flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-bold">💬 聊天区</h2>
        <p className="text-xs text-muted-foreground">所有玩家实时互动 · 登录后即可发言</p>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Spinner /> 加载消息…
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">还没有消息，来说第一句吧！</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex gap-2">
              <Avatar src={m.avatar_url} name={m.username} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      m.user_id === user?.id ? "text-primary" : "text-foreground",
                    )}
                  >
                    {m.user_id === user?.id ? "我" : displayName(m.username)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(m.created_at)}
                  </span>
                </div>
                <p className="break-words text-sm">{m.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-3">
        {user ? (
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="说点什么…"
              maxLength={500}
            />
            <Button onClick={() => void send()} disabled={sending || !input.trim()} aria-label="发送">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">登录后即可参与聊天</p>
        )}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
