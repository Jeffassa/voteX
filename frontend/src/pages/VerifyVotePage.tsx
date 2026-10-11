import { useState } from "react";
import { AlertCircle, Hash } from "lucide-react";

import { useReveal } from "@/hooks/useReveal";
import { AppHeader } from "@/components/AppHeader";
import { Stamp, WaveBand } from "@/components/SecurityPattern";
import { verifyVoteHash } from "@/lib/queries";
import type { VoteVerification } from "@/types/api";

export default function VerifyVotePage() {
  // Page publique : l'entrée doit être immédiate, un vérificateur arrive
  // souvent d'un lien externe avec une question précise.
  const pageRef = useReveal<HTMLDivElement>({ selector: ":scope > *", rise: 12 });
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
        ref={pageRef}
        className="container container-narrow scene"
        style={{ padding: "56px 32px 120px" }}
      >
        <div className="text-center">
          <div className="sv-ref">Vérification publique</div>
          <h1 className="h-title" style={{ fontSize: 44, marginTop: 8 }}>
            Vérifier un vote
          </h1>
          <p
            className="muted"
            style={{
              fontSize: 16, maxWidth: 540,
              margin: "12px auto 0", lineHeight: 1.6,
            }}
          >
            Collez l'empreinte de votre reçu pour vérifier que votre bulletin a bien
            été enregistré, sans révéler pour qui vous avez voté.
          </p>
        </div>

        <form
          className="sv-ticket"
          style={{ maxWidth: 680 }}
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <WaveBand height={18} />
          <div style={{ padding: "22px 26px 26px" }}>
            <label className="label" htmlFor="verify-vote-f1">Empreinte du bulletin</label>
            <div className="row gap-3" style={{ flexWrap: "wrap" }}>
              <div className="input-wrap" style={{ flex: "1 1 280px" }}>
                <span className="input-icon"><Hash size={16} aria-hidden="true" /></span>
                <input id="verify-vote-f1"
                  className="input has-icon mono"
                  value={hash}
                  onChange={(e) => {
                    setHash(e.target.value);
                    setState("idle");
                  }}
                  placeholder="0x4f8a92c61b3d…"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                className="btn btn-navy btn-lg"
                disabled={!hash || state === "loading"}
              >
                {state === "loading" ? "Vérification…" : "Vérifier"}
              </button>
            </div>

            <div aria-live="polite">
              {state === "found" && result && (
                <div className="fade-in sv-certificate">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="sv-display" style={{ margin: 0, fontSize: 22, fontWeight: 560, color: "var(--success-600)" }}>
                      Vote authentique
                    </p>
                    <dl className="sv-certificate-fields">
                      {result.election_title && (
                        <>
                          <dt>Élection</dt>
                          <dd>{result.election_title}</dd>
                        </>
                      )}
                      {result.block_number && (
                        <>
                          <dt>Bloc</dt>
                          <dd className="mono">#{result.block_number.toLocaleString("fr-FR")}</dd>
                        </>
                      )}
                    </dl>
                    <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--ink-500)", lineHeight: 1.5 }}>
                      Pour préserver l'anonymat, le contenu du bulletin n'est pas révélé.
                      Seule son existence est confirmée.
                    </p>
                  </div>
                  <Stamp small style={{ color: "var(--success-600)", alignSelf: "center" }}>Compté</Stamp>
                </div>
              )}
              {state === "notfound" && (
                <div
                  className="fade-in row items-center gap-2"
                  style={{
                    marginTop: 18, padding: 14,
                    background: "var(--danger-50)", border: "1px solid var(--danger-200)",
                    color: "var(--danger-600)",
                    borderRadius: "var(--r-md)", fontSize: 13.5,
                  }}
                >
                  <AlertCircle size={16} aria-hidden="true" /> Empreinte introuvable. Vérifiez le format
                  (elle commence par <span className="mono">0x</span>).
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
