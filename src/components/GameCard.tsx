import Link from "next/link";
import type { GameDefinition } from "@/games/registry";
import { cn, DIFFICULTY_LABEL } from "@/lib/utils";

export function GameCard({ game }: { game: GameDefinition }) {
  const inner = (
    <>
      <div
        className={cn(
          "flex h-28 items-center justify-center rounded-xl bg-gradient-to-br text-5xl",
          game.accent,
        )}
      >
        {game.emoji}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">{game.title}</h3>
          {game.available ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              可玩
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              敬请期待
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{game.description}</p>
        {game.available && game.difficulty.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {game.difficulty.map((d) => (
              <span
                key={d}
                className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {DIFFICULTY_LABEL[d]}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const cardClass = cn(
    "group block rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-sm transition",
    game.available ? "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg" : "opacity-70",
  );

  if (!game.available) {
    return <div className={cn(cardClass, "cursor-not-allowed")}>{inner}</div>;
  }

  return (
    <Link href={`/games/${game.slug}`} className={cardClass}>
      {inner}
    </Link>
  );
}
