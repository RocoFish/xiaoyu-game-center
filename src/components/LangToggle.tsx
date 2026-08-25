"use client";

import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-background/60 p-0.5 text-xs font-medium">
      <button
        onClick={() => setLang("zh")}
        className={cn(
          "rounded-full px-2 py-0.5 transition",
          lang === "zh" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        中文
      </button>
      <span className="text-muted-foreground/50">|</span>
      <button
        onClick={() => setLang("en")}
        className={cn(
          "rounded-full px-2 py-0.5 transition",
          lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        English
      </button>
    </div>
  );
}
