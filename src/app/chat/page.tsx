import type { Metadata } from "next";
import { ChatArea } from "@/components/ChatArea";

export const metadata: Metadata = { title: "聊天区" };

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold sm:text-3xl">💬 聊天区</h1>
        <p className="mt-1 text-sm text-muted-foreground">和所有玩家实时聊天、互动吧</p>
      </div>
      <ChatArea />
    </div>
  );
}
