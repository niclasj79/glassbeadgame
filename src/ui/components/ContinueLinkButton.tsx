import { useEffect, useState } from "react";
import { buildContinueUrl, makeSharedProgress } from "@/game/progress";
import { useStore } from "@/state/store";
import { Button } from "./Button";

interface Props {
  className?: string;
  variant?: "primary" | "ghost";
}

export function ContinueLinkButton({ className, variant = "ghost" }: Props) {
  const codex = useStore((s) => s.codex);
  const lifetimeStats = useStore((s) => s.lifetimeStats);
  const hintsSeen = useStore((s) => s.settings.hintsSeen);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copyUrl = async () => {
    const progress = makeSharedProgress({
      codex,
      lifetimeStats,
      settings: { hintsSeen },
    });
    const url = buildContinueUrl(progress, window.location);

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy your continue URL", url);
    }
    setCopied(true);
  };

  return (
    <Button variant={variant} className={className} onClick={copyUrl}>
      {copied ? "Continue URL copied" : "Copy continue URL"}
    </Button>
  );
}
