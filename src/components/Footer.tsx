"use client";

import { useLang } from "@/lib/i18n";

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">🐟 {t("home.title")}</p>
        <p className="mt-1">{t("footer.sub")}</p>
      </div>
    </footer>
  );
}
