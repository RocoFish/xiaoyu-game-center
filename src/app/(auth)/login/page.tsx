import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <Card className="animate-fade-in-up p-6">
        <h1 className="text-2xl font-bold">登录</h1>
        <p className="mt-1 text-sm text-muted-foreground">登录后即可保存成绩、查看排行榜排名</p>
        <div className="mt-6">
          <AuthForm mode="login" />
        </div>
      </Card>
    </div>
  );
}
