import { useMemo } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/state/store";
import { composeAnnotation } from "@/content/annotations";
import { totalConnections } from "@/game/ranks";
import { RankSigil } from "../components/RankSigil";
import { Button } from "../components/Button";
import { ContinueLinkButton } from "../components/ContinueLinkButton";
import { SessionPlateActions } from "../components/SessionPlateActions";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

export function ConclusionScreen() {
  const session = useStore((s) => s.session);
  const codex = useStore((s) => s.codex);
  const goToSetup = useStore((s) => s.goToSetup);
  const returnToTitle = useStore((s) => s.returnToTitle);
  const setCodexOpen = useStore((s) => s.setCodexOpen);

  const annotation = useMemo(
    () => (session ? composeAnnotation(session) : ""),
    [session]
  );

  if (!session) return null;

  const curated = session.discoveries.filter((d) => d.kind === "curated");
  const faint = session.discoveries.length - curated.length;
  const newEntries = curated.filter((d) => d.newToCodex);
  const codexCount = Object.keys(codex).length;

  return (
    <motion.div
      className="absolute inset-0 z-10 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 1 } }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center px-6 py-8">
        <div className="w-full rounded-3xl border border-line/55 bg-void/60 px-6 py-6 text-center shadow-[0_30px_120px_-28px_rgba(0,0,0,0.92)] backdrop-blur-xl sm:px-9 sm:py-7">
        <motion.p
          {...fadeUp}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="font-ui text-[11px] uppercase tracking-[0.55em] text-dim/80"
        >
          The Game concludes
        </motion.p>

        <motion.h2
          {...fadeUp}
          transition={{ delay: 0.55, duration: 0.8 }}
          className="mt-3 font-display text-4xl font-medium text-bright sm:text-5xl"
        >
          Annotation
        </motion.h2>

        <motion.div
          {...fadeUp}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-4 h-px w-20 bg-gradient-to-r from-transparent via-glow/60 to-transparent"
        />

        <motion.p
          {...fadeUp}
          transition={{ delay: 0.9, duration: 1.1 }}
          className="mt-5 text-center font-display text-lg italic leading-relaxed text-bright/90 text-balance"
        >
          {annotation}
        </motion.p>

        {/* Stats */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 1.15, duration: 0.9 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2"
        >
          <Stat value={session.score} label="Resonance" accent />
          <Stat value={curated.length} label="Connections" />
          <Stat value={faint} label="Faint strands" />
          <Stat value={session.motifs.length} label="Motifs" />
        </motion.div>

        {/* New codex entries */}
        {newEntries.length > 0 && (
          <motion.div
            {...fadeUp}
            transition={{ delay: 1.3, duration: 0.9 }}
            className="mt-5 w-full"
          >
            <p className="text-center font-ui text-[10px] uppercase tracking-[0.4em] text-dim">
              New to your codex
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {newEntries.map((d) => (
                <span
                  key={d.id}
                  className="rounded-full border border-glow/40 bg-glow/10 px-4 py-1.5 font-display text-sm italic text-bright"
                >
                  {d.title}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div {...fadeUp} transition={{ delay: 1.5, duration: 0.9 }} className="mt-6">
          <RankSigil codexCount={codexCount} totalCount={totalConnections()} size={84} />
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ delay: 1.7, duration: 0.9 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
        >
          <Button onClick={goToSetup}>Weave again</Button>
          <ContinueLinkButton />
          <SessionPlateActions session={session} />
          <Button variant="ghost" onClick={() => setCodexOpen(true)}>
            Open the Codex
          </Button>
          <Button variant="ghost" onClick={returnToTitle}>
            Return to title
          </Button>
        </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p
        className={
          accent
            ? "font-display text-2xl font-medium tabular-nums text-resonance"
            : "font-display text-2xl font-medium tabular-nums text-bright"
        }
      >
        {value}
      </p>
      <p className="mt-0.5 font-ui text-[10px] uppercase tracking-[0.3em] text-dim">{label}</p>
    </div>
  );
}
