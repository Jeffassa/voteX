import { useState } from "react";
import { AlertCircle, CheckCircle2, Hash } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { verifyVoteHash } from "@/lib/queries";
import type { VoteVerification } from "@/types/api";

export default function VerifyVotePage() {
  const [hash, setHash] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const [result, setResult] = useState<VoteVerification | null>(null);

  const verify = async () => {
    if (!hash) return;
    setState("loading");
    setResult(null);
    try {
      const data = await verifyVoteHash(hash);
      setResult(data);
      setState(data.valid ? "found" : "notfound");
    } catch {
      setState("notfound");
    }
  };

  return (
    <div>
      <AppHeader />
      <div
        className="container container-narrow scene"
        style={{ padding: "64px 32px 120px" }}
      >
        <div className="text-center">
          <div className="h-eyebrow">Vérification on-chain</div>
          <h1 className="h-title" style={{ fontSize: 40, marginTop: 12 }}>
            Vérifier un vote
          </h1>
          <p
            className="muted"
            style={{
              fontSize: 16, maxWidth: 540,
              margin: "12px auto 0", lineHeight: 1.6,
            }}
          >
            Collez le hash de votre reçu pour vérifier que votre bulletin a bien
            été enregistré sur la blockchain — sans révéler pour qui vous avez voté.
          </p>
        </div>

        <div className="card" style={{ marginTop: 40, padding: 28 }}>
          <label className="label">Hash de vote</label>
          <div className="row gap-3">
            <div className="input-wrap" style={{ flex: 1 }}>
              <span className="input-icon"><Hash size={16} /></span>
              <input
                className="input has-icon mono"
                value={hash}
                onChange={(e) => {
                  setHash(e.target.value);
                  setState("idle");
                }}
                placeholder="0x4f8a92c61b3d…"
              />
            </div>
            <button
              className="btn btn-navy btn-lg"
              onClick={verify}
              disabled={!hash || state === "loading"}
            >
              {state === "loading" ? "Vérification…" : "Vérifier"}
            </button>
          </div>

          {state === "found" && result && (
            <div
              className="fade-in"
              style={{
                marginTop: 20, padding: 20,
                background: "var(--success-50)",
                borderRadius: "var(--r-md)",
                border: "1px solid #BBF7D0",
              }}
            >
              <div className="row items-center gap-3" style={{ marginBottom: 12 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "white",
                    display: "grid", placeItems: "center",
                    color: "var(--success-500)",
                  }}
                >
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "var(--success-600)", fontSize: 15,
                    }}
                  >
                    Vote authentique
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {result.election_title && <>{result.election_title} · </>}
                    {result.created_at &&
                      `enregistré le ${new Date(result.created_at).toLocaleString("fr-FR")}`}
                    {result.block_number && (
                      <>
                        , bloc{" "}
                        <span className="mono">
                          #{result.block_number.toLocaleString("fr-FR")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                Pour des raisons d'anonymat, le contenu du bulletin n'est pas
                révélé. Seule l'existence du vote dans la chaîne est confirmée.
              </div>
            </div>
          )}
          {state === "notfound" && (
            <div
              className="fade-in row items-center gap-2"
              style={{
                marginTop: 20, padding: 14,
                background: "var(--danger-50)",
                color: "var(--danger-600)",
                borderRadius: "var(--r-md)", fontSize: 13,
              }}
            >
              <AlertCircle size={16} /> Hash introuvable. Vérifiez le format
              (commence par <span className="mono">0x</span>).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
