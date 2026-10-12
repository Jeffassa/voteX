import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Copy, Lock } from "lucide-react";

import { Brand } from "@/components/Brand";
import { BrandEcho, CheckMark, Stamp } from "@/components/SecurityPattern";
import { HERO_POSTER, loadBallotBoxScene, wantsHero3d } from "@/components/three/heroScene";
import { Reveal } from "@/components/Reveal";
import { api } from "@/lib/api";
import { useConsentStore } from "@/lib/consent";
import { timeLeft } from "@/lib/dates";

/**
 * Scène 3D chargée à la demande : Three.js n'est téléchargé que par la page
 * d'accueil, jamais par la salle de vote ni par l'administration. En attendant,
 * l'image fixe de sa première image tient la place (voir heroScene.ts).
 */
const BallotBoxScene = lazy(loadBallotBoxScene);

/** Les garanties, comme une fiche technique : un numéro, un énoncé, une preuve. */
const GUARANTEES = [
  {
    title: "Vote secret",
    text: "Le bulletin est enregistré sans votre identité ni l'heure du vote. Rien ne relie un électeur à son choix, pas même pour l'administration.",
  },
  {
    title: "Reçu vérifiable",
    text: "Chaque bulletin reçoit une empreinte SHA-256, que vous contrôlez sur ce site à tout moment.",
  },
  {
    title: "Résultats à la clôture",
    text: "Pendant le scrutin, seule la participation est visible, pour ne pas influencer les derniers votants.",
  },
  {
    title: "Empreintes sur blockchain",
    text: "Les empreintes sont inscrites sur Ethereum (réseau de test Sepolia), où personne ne peut les effacer.",
  },
  {
    title: "Une voix par étudiant",
    text: "Un bulletin par électeur et par scrutin, garanti par la base de données elle-même.",
  },
  {
    title: "Sur votre téléphone",
    text: "Aucune application à installer : le site fonctionne sur mobile, tablette et ordinateur.",
  },
];

const SECURITY = [
  "Votre choix n'est visible par personne, administration comprise.",
  "Un compte Google n'ouvre que le compte attribué par l'école.",
  "Le code source est public et peut être audité.",
  "Les scores ne sont publiés qu'à la fermeture du scrutin.",
];

interface LiveStatus {
  open_elections: number;
  turnout_percent: number | null;
  next_close_at: string | null;
}

/** État réel des scrutins (totaux seulement) ; rien ne s'affiche si l'API ne répond pas. */
function useLiveStatus() {
  return useQuery<LiveStatus>({
    queryKey: ["public", "live-status"],
    queryFn: async () => (await api.get("/api/live-status")).data,
    staleTime: 30_000,
    retry: false,
  });
}

export default function LandingPage() {
  const reopenConsent = useConsentStore((s) => s.reopen);
  const [want3d] = useState(wantsHero3d);
  const [sceneReady, setSceneReady] = useState(false);
  const { data: live } = useLiveStatus();

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-wrap lp-header-inner">
          <Link to="/" aria-label="ESATIC SmartVote, accueil">
            <Brand />
          </Link>
          <nav aria-label="Navigation principale" className="lp-nav">
            <a href="#fonctionnement" className="lp-nav-link">Fonctionnement</a>
            <a href="#garanties" className="lp-nav-link">Garanties</a>
            <Link to="/verify" className="lp-nav-link lp-hide-sm">Vérifier un vote</Link>
            <Link to="/login" className="btn btn-primary btn-sm" style={{ marginLeft: 6 }}>
              Se connecter
            </Link>
          </nav>
        </div>
      </header>

      {/* Héros */}
      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <Reveal>
            <p className="sv-kicker">Élections des chefs de classe 2026</p>
            <h1 className="lp-title">Le vote des chefs de classe, en ligne.</h1>
            <p className="lp-lead">
              Votez en une minute depuis votre téléphone, puis vérifiez vous-même que votre
              bulletin a été compté. Personne ne voit votre choix, pas même l'administration.
            </p>
            <div className="lp-actions">
              <Link to="/login" className="btn btn-primary btn-lg">
                Voter maintenant <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/verify" className="btn btn-outline btn-lg">
                Vérifier un vote
              </Link>
            </div>
            <LiveStrip live={live} />
          </Reveal>

          <div className="lp-stage">
            <BrandEcho size={520} style={{ color: "var(--ink-950)", left: "50%", bottom: "6%", transform: "translateX(-50%)" }} />
            {/* Image fixe d'abord, affichée dès le premier rendu ; la 3D se
                fond par-dessus quand sa première image, identique, est prête. */}
            <img
              src={HERO_POSTER.src}
              srcSet={HERO_POSTER.srcSet}
              sizes={HERO_POSTER.sizes}
              width={HERO_POSTER.width}
              height={HERO_POSTER.height}
              alt=""
              aria-hidden="true"
              decoding="async"
              {...{ fetchpriority: "high" }}
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
                sceneReady ? "opacity-0" : "opacity-100"
              }`}
            />
            {want3d && (
              <Suspense fallback={null}>
                <BallotBoxScene
                  onReady={() => setSceneReady(true)}
                  className={`absolute inset-0 transition-opacity duration-500 ${sceneReady ? "opacity-100" : "opacity-0"}`}
                />
              </Suspense>
            )}
          </div>
        </div>
      </section>

      {/* Fonctionnement : la vraie interface, en trois vignettes. */}
      <section id="fonctionnement" className="lp-section">
        <div className="lp-wrap">
          <Reveal onScroll className="lp-section-head">
            <p className="sv-kicker">Fonctionnement</p>
            <h2 className="lp-h2">Trois gestes, moins d'une minute.</h2>
          </Reveal>
          <ol className="lp-steps">
            <Reveal as="li" onScroll className="lp-step">
              <StepHead n={1} title="Connectez-vous" text="Votre matricule ESATIC, ou l'adresse Google enregistrée par l'école." />
              <div className="lp-vignette" aria-hidden="true">
                <span className="lp-v-label">Matricule</span>
                <span className="lp-v-input mono">24-ESATIC0398SB</span>
                <span className="lp-v-label" style={{ marginTop: 12 }}>Mot de passe</span>
                <span className="lp-v-input">••••••••••</span>
                <span className="lp-v-button">Se connecter <ArrowRight size={13} /></span>
              </div>
            </Reveal>
            <Reveal as="li" onScroll delay={0.08} className="lp-step">
              <StepHead n={2} title="Cochez" text="Choisissez votre candidat, puis maintenez le bouton pour confirmer. Le vote blanc est possible." />
              <div className="lp-vignette" aria-hidden="true">
                <span className="lp-v-row">
                  <span className="lp-v-avatar" style={{ background: "#b9764f26", color: "#8a5536" }}>AN</span>
                  <span className="lp-v-name">Aïcha N'Guessan<small>Une classe qui s'écoute</small></span>
                  <span className="lp-v-radio is-on"><CheckMark size={12} /></span>
                </span>
                <span className="lp-v-row">
                  <span className="lp-v-avatar" style={{ background: "#4f6d8f26", color: "#3d5672" }}>YK</span>
                  <span className="lp-v-name">Yao Konan<small>Des TP mieux équipés</small></span>
                  <span className="lp-v-radio" />
                </span>
                <span className="lp-v-hold"><span className="lp-v-hold-fill" />Maintenir pour confirmer</span>
              </div>
            </Reveal>
            <Reveal as="li" onScroll delay={0.16} className="lp-step">
              <StepHead n={3} title="Vérifiez" text="Votre reçu porte une empreinte unique : elle prouve que le bulletin est compté, sans dire pour qui." />
              <div className="lp-vignette" aria-hidden="true">
                <Stamp small>A voté</Stamp>
                <span className="lp-v-label" style={{ marginTop: 14 }}>Empreinte du bulletin</span>
                <span className="lp-v-hash mono">0x8f3a…c21e <Copy size={12} /></span>
                <span className="lp-v-ok"><Check size={13} strokeWidth={3} /> Bulletin compté</span>
              </div>
            </Reveal>
          </ol>
        </div>
      </section>

      {/* Garanties : une fiche technique, pas une grille de cartes. */}
      <section id="garanties" className="lp-section lp-section-alt">
        <div className="lp-wrap lp-spec">
          <Reveal onScroll className="lp-spec-head">
            <p className="sv-kicker">Garanties</p>
            <h2 className="lp-h2">Conçu pour mériter la confiance d'une urne.</h2>
            <p className="lp-muted">
              Six engagements, tenus par le code et vérifiables par chacun, pas seulement promis.
            </p>
          </Reveal>
          <ol className="lp-spec-list">
            {GUARANTEES.map((g, i) => (
              <Reveal as="li" onScroll delay={(i % 3) * 0.05} key={g.title} className="lp-spec-item">
                <span className="lp-spec-no mono">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{g.title}</h3>
                  <p>{g.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Sécurité : panneau ardoise pleine largeur. */}
      <section id="securite" className="sv-navy-panel lp-dark">
        <BrandEcho size={760} style={{ right: -120, bottom: -140 }} />
        <div className="lp-wrap lp-dark-grid">
          <Reveal onScroll>
            <p className="lp-kicker-dark">Sécurité</p>
            <h2 className="lp-h2 lp-h2-dark">Vous vérifiez, sans nous croire sur parole.</h2>
            <ul className="lp-checks">
              {SECURITY.map((g) => (
                <li key={g}>
                  <span aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                  {g}
                </li>
              ))}
            </ul>
            <Link to="/verify" className="btn btn-accent" style={{ marginTop: 30 }}>
              Vérifier un reçu <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Reveal>

          <Reveal onScroll delay={0.1}>
            <figure className="lp-receipt">
              <div className="lp-receipt-head">
                <figcaption className="sv-ref">Exemple de reçu</figcaption>
                <Stamp small>A voté</Stamp>
              </div>
              <p className="lp-receipt-title">Chef de classe, L3 Génie Logiciel</p>
              <dl className="lp-receipt-fields">
                <div className="is-block">
                  <dt>Empreinte du bulletin</dt>
                  <dd className="mono lp-receipt-hash">0x8f3a51c0e9d7b4a2f6e1c3d5b7a9e0f2c4d6b8a0e2f4c6d8b0a2e4f6c8d0c21e</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd style={{ color: "var(--success-600)" }}><Check size={14} aria-hidden="true" /> Bulletin compté</dd>
                </div>
                <div>
                  <dt>Candidat choisi</dt>
                  <dd><Lock size={13} aria-hidden="true" /> Jamais affiché</dd>
                </div>
              </dl>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* Appel à l'action */}
      <section className="lp-section">
        <Reveal onScroll className="lp-wrap lp-cta">
          <h2 className="lp-cta-title">Le scrutin de votre classe est ouvert&nbsp;?</h2>
          <div className="lp-cta-side">
            <p className="lp-muted" style={{ margin: 0 }}>Connectez-vous pour voter. Cela prend moins d'une minute.</p>
            <Link to="/login" className="btn btn-primary btn-lg">
              Se connecter <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <div>
            <Brand />
            <p className="lp-footnote">Projet de soutenance, L3 Génie Logiciel, ESATIC Abidjan, 2026.</p>
          </div>
          <nav aria-label="Liens du pied de page" className="lp-footer-nav">
            <Link to="/verify">Vérifier un vote</Link>
            <Link to="/confidentialite">Confidentialité</Link>
            <Link to="/cgu">CGU</Link>
            <button type="button" className="sv-link-button" onClick={reopenConsent}>
              Gérer les cookies
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function StepHead({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="lp-step-head">
      <span className="lp-step-no mono" aria-hidden="true">{String(n).padStart(2, "0")}</span>
      <h3>
        <span className="sr-only">Étape {n} : </span>
        {title}
      </h3>
      <p>{text}</p>
    </div>
  );
}

/** Bandeau d'état réel : scrutins ouverts, participation agrégée, prochaine clôture. */
function LiveStrip({ live }: { live?: LiveStatus }) {
  if (!live) return null;
  if (live.open_elections === 0) {
    return (
      <p className="lp-live">
        <span className="lp-live-dot is-idle" aria-hidden="true" />
        Aucun scrutin ouvert en ce moment.
      </p>
    );
  }
  return (
    <p className="lp-live">
      <span className="lp-live-dot" aria-hidden="true" />
      <strong>{live.open_elections} scrutin{live.open_elections > 1 ? "s" : ""} ouvert{live.open_elections > 1 ? "s" : ""}</strong>
      {live.turnout_percent !== null && (
        <>
          <span className="lp-live-sep" aria-hidden="true" />
          {live.turnout_percent} % de participation
        </>
      )}
      {live.next_close_at && (
        <>
          <span className="lp-live-sep" aria-hidden="true" />
          clôture dans {timeLeft(live.next_close_at).replace(/^encore /, "")}
        </>
      )}
    </p>
  );
}
