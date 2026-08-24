"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface Provider {
  id: "github" | "google";
  name: string;
  className: string;
}

// 需要在 Supabase 里启用对应 provider（并配置 OAuth 凭据）才会生效。
const PROVIDERS: Provider[] = [
  { id: "github", name: "GitHub", className: "bg-[#24292e] hover:bg-[#1b1f23]" },
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
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60",
            p.className,
          )}
        >
          {p.id === "github" && <GitHubIcon className="h-4 w-4" />}
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
