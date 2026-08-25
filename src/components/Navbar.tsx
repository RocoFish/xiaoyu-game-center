"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Medal, Trophy, User, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";
import { Avatar } from "@/components/Avatar";
import { cn, displayName } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", labelKey: "nav.home" },
  { href: "/leaderboard", labelKey: "nav.leaderboard" },
  { href: "/chat", labelKey: "nav.chat" },
];

export function Navbar() {
  const { user, profile, loading, signOut } = useAuth();
  const { t } = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        {/* Logo + 语言切换 */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <span className="text-xl">🏀</span>
            <span className="hidden text-base font-bold sm:inline">{t("home.title")}</span>
            <span className="text-base font-bold sm:hidden">{t("home.short")}</span>
          </Link>
          <LangToggle />
        </div>

        {/* 桌面导航 */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                pathname === l.href
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(l.labelKey)}
            </Link>
          ))}
        </nav>

        {/* 右侧 */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {!loading && user ? (
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-muted/60"
              >
                <Avatar src={profile?.avatar_url} name={profile?.username ?? user.email} size={30} />
                <span className="max-w-[100px] truncate text-sm font-medium">
                  {displayName(profile?.username)}
                </span>
              </Link>
              <button
                onClick={() => void signOut()}
                aria-label={t("nav.logout")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : !loading ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {t("nav.login")}
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                {t("nav.register")}
              </Link>
            </div>
          ) : (
            <span className="hidden h-9 w-20 animate-pulse rounded-lg bg-muted md:inline-block" />
          )}

          {/* 移动端菜单按钮 */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={t("nav.menu")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 移动端面板 */}
      {open && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {t(l.labelKey)}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  <User className="h-4 w-4" /> {t("nav.profile")}
                </Link>
                <Link
                  href="/profile/scores"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  <Medal className="h-4 w-4" /> {t("nav.scores")}
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    void signOut();
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" /> {t("nav.logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  {t("nav.register")}
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
