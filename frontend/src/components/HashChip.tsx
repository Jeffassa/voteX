import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { formatHash } from "@/lib/utils";

interface HashChipProps {
  value: string;
  full?: boolean;
}

export function HashChip({ value, full = false }: HashChipProps) {
  const [copied, setCopied] = useState(false);
  const display = full ? value : formatHash(value, 8, 6);

  const copy = () => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <span className="hash-chip">
      <span>{display}</span>
      <button onClick={copy} title="Copier" type="button">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}
