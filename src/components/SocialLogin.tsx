"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface Provider {
  id: "github" | "google";
  name: string;
  className: string; // 背景 / hover
  textClassName: string;
  icon: "github" | "google";
}

// 需要在 Supabase 里启用对应 provider（并配置 OAuth 凭据）才会生效。
const PROVIDERS: Provider[] = [
  {
    id: "github",
    name: "GitHub",
    className: "bg-[#24292e] hover:bg-[#1b1f23]",
    textClassName: "text-white",
    icon: "github",
  },
  {
    id: "google",
    name: "Google",
    className: "bg-white border border-border hover:bg-zinc-100",
    textClassName: "text-zinc-800",
    icon: "google",
  },
];

export function SocialLogin() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function login(provider: Provider["id"]) {
    setError("");
    setLoading(provider);
    try {
      await getSupabaseBrowser().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // signInWithOAuth 成功后浏览器会跳转到供应商授权页，不会回到这里
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "provider_disabled") {
        setError("该登录方式暂未启用，请使用邮箱注册，或稍后再试。");
      } else {
        setError(authErrorMessage(err));
      }
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => login(p.id)}
          disabled={loading !== null}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60",
            p.className,
            p.textClassName,
          )}
        >
          {p.icon === "github" && <GitHubIcon className="h-4 w-4" />}
          {p.icon === "google" && <GoogleIcon className="h-4 w-4" />}
          {loading === p.id ? "跳转中…" : `使用 ${p.name} 登录`}
        </button>
      ))}
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.285 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.28-1.545 3.285-1.23 3.285-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.92 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
      />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
