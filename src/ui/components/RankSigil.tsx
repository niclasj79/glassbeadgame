import { rankFor, nextRank, rankProgress } from "@/game/ranks";

interface Props {
  codexCount: number;
  totalCount: number;
  size?: number;
}

/** Rank name inside a progress ring — the player's standing in the Order. */
export function RankSigil({ codexCount, totalCount, size = 120 }: Props) {
  const rank = rankFor(codexCount);
  const next = nextRank(codexCount);
  const progress = rankProgress(codexCount);
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--line) / 0.5)"
            strokeWidth="2"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--glow))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ filter: "drop-shadow(0 0 6px hsl(var(--glow) / 0.6))" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-2xl text-bright">✦</span>
        </div>
      </div>
      <div>
        <p className="font-ui text-[10px] uppercase tracking-[0.4em] text-dim">Rank</p>
        <p className="mt-1 font-display text-2xl font-medium text-bright">{rank.name}</p>
        <p className="mt-1 font-ui text-[11px] text-dim">
          {codexCount} of {totalCount} connections
          {next && (
            <>
              {" "}
              · <span className="text-dim/80">{next.threshold - codexCount} to {next.name}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
