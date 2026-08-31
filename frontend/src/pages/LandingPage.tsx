import { Suspense, lazy, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Check, ChevronRight, ExternalLink } from "lucide-react";

import { Brand } from "@/components/Brand";
import { Reveal, RevealGroup } from "@/components/Reveal";
import { grow } from "@/lib/motion";
import {
  AnimatedGradientText,
  DotPattern,
  NumberTicker,
  ShimmerButton,
  BorderBeam,
  Marquee,
} from "@/components/magic";
import { Lordicon } from "@/components/icons/Lordicon";
import { LORDICONS, LORDICON_COLORS } from "@/lib/lordicons";

/**
 * Décor 3D du hero, chargé à la demande.
 *
 * `lazy` n'est pas un détail de confort : Three.js pèse une centaine de
 * kilo-octets compressés. La salle de vote et l'espace d'administration ne
 * doivent pas les télécharger pour un décor qu'ils n'affichent jamais.
 */
const BallotScene = lazy(() => import("@/components/three/BallotScene"));

/* ─── Animation helpers ─── */

function FadeSection({
  children,
  className,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  // Conservé pour ne pas réécrire les quinze points d'appel de la page ;
  // c'est désormais une simple façade au-dessus de Reveal.
  return (
    <Reveal onScroll delay={delay} rise={28} className={className} style={style}>
      {children}
    </Reveal>
  );
}

/* ─── Data ─── */

const PILLARS = [
  {
    lord: LORDICONS.shield,
    colors: LORDICON_COLORS.orangeNavy,
    title: "Sécurisé",
    desc: "Authentification par matricule ESATIC, chiffrement de bout en bout. Ton identité reste protégée, ton vote reste secret.",
  },
  {
    lord: LORDICONS.activity,
    colors: LORDICON_COLORS.orangeNavy,
    title: "Temps réel",
    desc: "Les résultats sont publiés en direct dès la clôture. Le taux de participation est visible en continu.",
  },
  {
    lord: LORDICONS.blockchain,
    colors: LORDICON_COLORS.orangeNavy,
    title: "Blockchain",
    desc: "Chaque vote est scellé sur la chaîne Sepolia — auditable par n'importe qui, sans jamais révéler l'identité.",
  },
];

const STEPS = [
  {
    n: "01",
    lord: LORDICONS.vote,
    title: "Connecte-toi",
    desc: "Saisis ton matricule étudiant ESATIC. Aucun mot de passe à retenir — ton identifiant suffit.",
  },
  {
    n: "02",
    lord: LORDICONS.check,
    title: "Choisis ton candidat",
    desc: "Consulte les profils des candidats déclarés pour ta promotion, puis effectue ton choix.",
  },
  {
    n: "03",
    lord: LORDICONS.hash,
    title: "Ton vote est scellé",
    desc: "Une empreinte cryptographique est enregistrée sur la blockchain. Tu peux la vérifier à tout moment.",
  },
];

const STATS: Array<{ value: number; suffix: string; label: string }> = [
  { value: 312, suffix: "+", label: "étudiants éligibles" },
  { value: 4, suffix: "", label: "candidats déclarés" },
  { value: 100, suffix: "%", label: "votes vérifiables on-chain" },
  { value: 0, suffix: "", label: "registre modifiable" },
];

const TRUST_TAGS = [
  "Vote anonyme",
  "Résultats publics",
  "Audit blockchain",
  "ESATIC 2026",
  "FastAPI + PostgreSQL",
  "Sepolia Testnet",
  "Vérification on-chain",
  "Open source",
];

/**
 * Barre de résultat qui s'étire jusqu'à son pourcentage.
 *
 * La largeur finale est posée d'emblée quand les animations sont réduites : un
 * score partiellement dessiné serait une information fausse.
 */
function VoteBar({ percent, delay, highlight }: { percent: number; delay: number; highlight: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => grow(ref.current, percent, delay), [percent, delay]);

  return (
    <div
      ref={ref}
      style={{
        height: "100%",
        width: 0,
        background: highlight ? "var(--orange-500)" : "var(--navy-400, #4a77b0)",
        borderRadius: 99,
      }}
    />
  );
}

/* ─── Mock voting card (hero visual) ─── */

function MockVotingCard() {
  const candidates = [
    { initials: "KB", name: "Konan Brice", votes: 68 },
    { initials: "TD", name: "Touré Djibril", votes: 42 },
    { initials: "AK", name: "Assou Koffi", votes: 31 },
  ];
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 20,
        boxShadow: "var(--shadow-xl)",
        padding: 24,
        width: 340,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <BorderBeam size={110} duration={10} radius={20} />

      {/* header */}
      <div className="row items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--orange-600)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
            Élection ouverte
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--navy-900)", letterSpacing: "-0.02em" }}>
            Chef de classe · L3 GL
          </div>
        </div>
        <span className="badge badge-open">
          <span className="dot" />
          Live
        </span>
      </div>

      {/* candidates */}
      <div className="col gap-3">
        {candidates.map((c, i) => (
          <Reveal
            key={c.name}
            slide={16}
            delay={0.12 + i * 0.07}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${i === 0 ? "var(--orange-500)" : "var(--border)"}`,
              background: i === 0 ? "var(--orange-50)" : "var(--surface-2)",
              cursor: "pointer",
              transition: "all 160ms ease",
            }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: i === 0 ? "var(--orange-500)" : "var(--navy-100)",
                color: i === 0 ? "white" : "var(--navy-700)",
                display: "grid", placeItems: "center",
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}
            >
              {c.initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy-900)", letterSpacing: "-0.01em" }}>
                {c.name}
              </div>
              <div style={{ marginTop: 5 }}>
                <div style={{ height: 4, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                  <VoteBar percent={c.votes} delay={0.3 + i * 0.06} highlight={i === 0} />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? "var(--orange-600)" : "var(--ink-500)", minWidth: 28, textAlign: "right" }}>
              {c.votes}%
            </div>
            {i === 0 && (
              <div style={{ width: 18, height: 18, borderRadius: 99, background: "var(--orange-500)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Check size={11} color="white" strokeWidth={3} />
              </div>
            )}
          </Reveal>
        ))}
      </div>

      {/* footer */}
      <div
        style={{
          marginTop: 16, paddingTop: 16,
          borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 11, color: "var(--ink-500)" }}>
          <span style={{ fontWeight: 600, color: "var(--navy-900)" }}>141</span> votes · participation{" "}
          <span style={{ fontWeight: 600, color: "var(--success-600)" }}>87%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--ink-400)" }}>
          <div style={{ width: 6, height: 6, borderRadius: 99, background: "var(--success-500)", animation: "sv-pulse 2s infinite" }} />
          on-chain
        </div>
      </div>
    </div>
  );
}

/* ─── Section divider ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 3, height: 20, borderRadius: 99, background: "var(--orange-500)" }} />
      <span className="h-eyebrow">{children}</span>
    </div>
  );
}

/* ─── Page ─── */

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* ── NAVBAR ───────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(247,248,250,0.82)",
          backdropFilter: "saturate(180%) blur(16px)",
          WebkitBackdropFilter: "saturate(180%) blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="container row items-center justify-between"
          style={{ padding: "16px 32px" }}
        >
          <Brand />
          <nav className="row items-center gap-2" style={{ fontSize: 13, fontWeight: 500 }}>
            <a className="btn btn-ghost btn-sm" href="#fonctionnement">Comment ça marche</a>
            <a className="btn btn-ghost btn-sm" href="#securite">Sécurité</a>
            <div style={{ width: 1, height: 18, background: "var(--border-strong)", margin: "0 4px" }} />
            <button className="btn btn-navy btn-sm" onClick={() => navigate("/login")}>
              Se connecter
            </button>
          </nav>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section
        style={{ position: "relative", overflow: "hidden", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        {/* background dot pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            maskImage: "radial-gradient(ellipse at 20% 40%, black 20%, transparent 65%)",
            WebkitMaskImage: "radial-gradient(ellipse at 20% 40%, black 20%, transparent 65%)",
            pointerEvents: "none",
          }}
        >
          <DotPattern fill="rgba(10,37,64,0.07)" />
        </div>

        {/* Maillage de bulletins reliés — évoque le registre distribué dont
            parle la page. Purement décoratif : aucun contenu n'en dépend. */}
        <Suspense fallback={null}>
          <BallotScene
            className="hero-scene"
          />
        </Suspense>

        <div
          className="container"
          style={{
            padding: "80px 32px 88px",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 64,
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Left: text */}
          <RevealGroup
            selector=":scope > *"
            onScroll={false}
            className="hero-copy"
          >
            <div className="row items-center gap-2" style={{ marginBottom: 28 }}>
              <span className="badge badge-orange">
                <Lordicon src={LORDICONS.activity} size={13} colors={LORDICON_COLORS.orangeNavy} />
                Élection 2026 — ouverte
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                · Promotion L3 Génie Logiciel · ESATIC
              </span>
            </div>

            <h1
              style={{
                fontSize: "clamp(44px, 6.5vw, 88px)",
                fontWeight: 600,
                letterSpacing: "-0.045em",
                lineHeight: 0.97,
                margin: 0,
                color: "var(--navy-900)",
                maxWidth: 900,
              }}
            >
              Le vote des chefs
              <br />
              de classe,{" "}
              <AnimatedGradientText
                style={{ fontStyle: "italic", fontFamily: "Georgia, serif", fontWeight: 500 }}
              >
                réinventé.
              </AnimatedGradientText>
            </h1>

            <p
              style={{
                fontSize: 18,
                color: "var(--ink-700)",
                maxWidth: 580,
                marginTop: 28,
                lineHeight: 1.6,
                letterSpacing: "-0.005em",
              }}
            >
              Une plateforme de vote en ligne pour l'École Supérieure Africaine des TIC.
              Sécurisée par blockchain, vérifiable par chaque étudiant, conçue à Abidjan.
            </p>

            <div className="row gap-3" style={{ marginTop: 40 }}>
              <ShimmerButton onClick={() => navigate("/login")}>
                Voter maintenant <ArrowRight size={17} />
              </ShimmerButton>
              <button
                className="btn btn-outline btn-xl"
                onClick={() => navigate("/verify")}
              >
                <Shield size={17} /> Vérifier un vote
              </button>
            </div>

            <div
              className="row items-center gap-3"
              style={{ marginTop: 40 }}
            >
              {["Anonyme", "Blockchain Sepolia", "Open source"].map((tag) => (
                <div
                  key={tag}
                  className="row items-center gap-2"
                  style={{ fontSize: 12, color: "var(--ink-500)" }}
                >
                  <Check size={13} color="var(--success-500)" strokeWidth={2.5} />
                  {tag}
                </div>
              ))}
            </div>
          </RevealGroup>

          {/* Right: mock card */}
          <Reveal delay={0.2} rise={20} style={{ flexShrink: 0 }}>
            <MockVotingCard />
          </Reveal>
        </div>
      </section>

      {/* ── TRUST BAR ─────────────────────────────────────── */}
      <section
        style={{ borderBottom: "1px solid var(--border)", padding: "18px 0", overflow: "hidden" }}
      >
        <Marquee gap="24px" duration="28s" style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}>
          {TRUST_TAGS.map((t) => (
            <div
              key={t}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 16px", borderRadius: 99,
                border: "1px solid var(--border-strong)",
                background: "var(--surface)",
                fontSize: 12, fontWeight: 500, color: "var(--ink-600, #475569)",
                whiteSpace: "nowrap",
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 99, background: "var(--orange-500)" }} />
              {t}
            </div>
          ))}
        </Marquee>
      </section>

      {/* ── FEATURES / PILLARS ────────────────────────────── */}
      <section id="fonctionnement" style={{ padding: "104px 0 80px" }}>
        <div className="container" style={{ padding: "0 32px" }}>
          <FadeSection style={{ maxWidth: 580, marginBottom: 60 }}>
            <SectionLabel>Fonctionnalités</SectionLabel>
            <h2 className="h-title" style={{ fontSize: "clamp(28px, 4vw, 44px)", maxWidth: 560 }}>
              Tout ce dont une élection équitable a besoin
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-500)", marginTop: 14, lineHeight: 1.6 }}>
              Conçu pour les étudiants ESATIC, SmartVote garantit que chaque voix compte — et peut être prouvée.
            </p>
          </FadeSection>

          <RevealGroup
            selector=":scope > .card"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 20,
            }}
          >
            {PILLARS.map((p, i) => (
              <div
                key={p.title}
                className="card card-lift"
                style={{
                  padding: 28,
                  position: "relative",
                  overflow: "hidden",
                  transition: "box-shadow 200ms ease, transform 200ms ease",
                }}
              >
                {i === 0 && <BorderBeam size={90} duration={14} delay={0} radius={16} />}
                <div
                  style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "var(--orange-50)",
                    display: "grid", placeItems: "center", marginBottom: 20,
                    flexShrink: 0,
                  }}
                >
                  <Lordicon src={p.lord} size={34} trigger="loop" colors={p.colors} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--navy-900)", marginBottom: 10 }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 14, color: "var(--ink-500)", lineHeight: 1.6 }}>
                  {p.desc}
                </div>
              </div>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "104px 0",
        }}
      >
        <div className="container" style={{ padding: "0 32px" }}>
          <FadeSection style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 72px" }}>
            <SectionLabel>Comment ça marche</SectionLabel>
            <h2 className="h-title" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
              Voter en trois étapes
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-500)", marginTop: 14, lineHeight: 1.6 }}>
              Simple pour l'étudiant, inviolable sous le capot.
            </p>
          </FadeSection>

          <RevealGroup
            selector=".step"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, position: "relative" }}
          >
            {/* connector line */}
            <div
              style={{
                position: "absolute",
                top: 44, left: "16.5%", right: "16.5%",
                height: 1,
                background: "linear-gradient(to right, var(--orange-100), var(--orange-500), var(--orange-100))",
                zIndex: 0,
              }}
            />

            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="step"
                style={{ position: "relative", zIndex: 1 }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                  <div
                    style={{
                      width: 88, height: 88, borderRadius: 24,
                      background: i === 1 ? "var(--navy-900)" : "var(--surface)",
                      border: `1px solid ${i === 1 ? "var(--navy-900)" : "var(--border-strong)"}`,
                      boxShadow: i === 1 ? "var(--shadow-orange)" : "var(--shadow-md)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 4, marginBottom: 24, flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    <Lordicon
                      src={s.lord}
                      size={36}
                      trigger="loop"
                      colors={i === 1 ? LORDICON_COLORS.whiteOrange : LORDICON_COLORS.navyOrange}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                      color: "var(--orange-600)", marginBottom: 8,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    ÉTAPE {s.n}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--navy-900)", marginBottom: 10 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--ink-500)", lineHeight: 1.6, maxWidth: 260 }}>
                    {s.desc}
                  </div>
                </div>
              </div>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────── */}
      <section style={{ padding: "104px 0" }}>
        <div className="container" style={{ padding: "0 32px" }}>
          <FadeSection>
            <div
              className="card"
              style={{
                background: "var(--navy-900)",
                borderColor: "var(--navy-900)",
                padding: "56px 48px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* radial glow */}
              <div
                style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  background: "radial-gradient(circle at 85% 50%, rgba(255,122,0,0.20), transparent 55%)",
                }}
              />
              <div
                style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  background: "radial-gradient(circle at 15% 50%, rgba(78,116,175,0.18), transparent 55%)",
                }}
              />
              <DotPattern fill="rgba(255,255,255,0.03)" />

              <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32, alignItems: "center" }}>
                {STATS.map((s, i) => (
                  <div key={s.label} style={{ textAlign: i === 0 ? "left" : "left" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                      <NumberTicker
                        value={s.value}
                        suffix={s.suffix}
                        delay={0.08 * i}
                        className="stat-num"
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11, marginTop: 8,
                        color: "rgba(255,255,255,0.55)",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        fontWeight: 500,
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── SECURITY DEEP DIVE ────────────────────────────── */}
      <section
        id="securite"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "104px 0",
        }}
      >
        <div
          className="container"
          style={{
            padding: "0 32px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 80,
            alignItems: "center",
          }}
        >
          {/* Left: text */}
          <FadeSection>
            <SectionLabel>Transparence & Confiance</SectionLabel>
            <h2 className="h-title" style={{ fontSize: "clamp(28px, 4vw, 42px)", marginBottom: 20 }}>
              Chaque vote laisse une empreinte que tu peux vérifier
            </h2>
            <p style={{ fontSize: 15, color: "var(--ink-500)", lineHeight: 1.65, marginBottom: 32 }}>
              Après ton vote, un hash SHA-256 unique est généré et enregistré sur la blockchain Sepolia.
              Saisis-le sur la page de vérification — tu verras le bloc, la transaction, et la confirmation que ton vote existe.
            </p>

            <div className="col gap-4">
              {[
                { lord: LORDICONS.shield, text: "Aucun serveur ne peut modifier un vote publié on-chain" },
                { lord: LORDICONS.hash, text: "Ton identité n'est jamais liée à ton choix de candidat" },
                { lord: LORDICONS.check, text: "Le code source est auditable — rien n'est caché" },
              ].map((item) => (
                <div key={item.text} className="row items-start gap-3">
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: "var(--orange-50)",
                      display: "grid", placeItems: "center",
                      flexShrink: 0, marginTop: 2,
                    }}
                  >
                    <Lordicon src={item.lord} size={20} colors={LORDICON_COLORS.orangeNavy} />
                  </div>
                  <p style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.55, margin: 0 }}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 36 }}>
              <button
                className="btn btn-outline"
                onClick={() => navigate("/verify")}
                style={{ fontSize: 13 }}
              >
                Vérifier un vote <ExternalLink size={14} />
              </button>
            </div>
          </FadeSection>

          {/* Right: hash chip visual */}
          <FadeSection delay={0.15}>
            <div
              className="card"
              style={{
                padding: 32, position: "relative", overflow: "hidden",
                background: "linear-gradient(145deg, var(--navy-50) 0%, var(--surface) 100%)",
              }}
            >
              <BorderBeam size={260} duration={16} delay={6} />

              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-500)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 20 }}>
                Preuve cryptographique
              </div>

              <div
                style={{
                  background: "var(--navy-900)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                  lineHeight: 1.8,
                  marginBottom: 20,
                }}
              >
                <span style={{ color: "var(--orange-400)" }}>vote_hash</span>
                {" = sha256("}
                <br />
                <span style={{ paddingLeft: 16 }}>
                  <span style={{ color: "var(--navy-500)" }}>student_id</span>
                  {" | "}
                  <span style={{ color: "var(--navy-500)" }}>election_id</span>
                </span>
                <br />
                <span style={{ paddingLeft: 16 }}>
                  <span style={{ color: "var(--navy-500)" }}>candidate_id</span>
                  {" | "}
                  <span style={{ color: "var(--navy-500)" }}>nonce</span>
                </span>
                <br />
                {")"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "TX Hash", value: "0x4f8e…c3a1", ok: true },
                  { label: "Block", value: "#7 842 091", ok: true },
                  { label: "Status", value: "Confirmé", ok: true },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{row.label}</span>
                    <span
                      style={{
                        fontSize: 12, fontWeight: 600,
                        color: row.label === "Status" ? "var(--success-600)" : "var(--navy-900)",
                        fontFamily: row.label !== "Status" ? "var(--font-mono)" : undefined,
                        display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      {row.label === "Status" && (
                        <Check size={12} color="var(--success-500)" strokeWidth={3} />
                      )}
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section style={{ padding: "104px 0" }}>
        <div className="container" style={{ padding: "0 32px" }}>
          <FadeSection>
            <div
              className="card"
              style={{
                padding: "64px 48px",
                textAlign: "center",
                background: "var(--surface)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  background: "radial-gradient(ellipse at 50% 0%, rgba(255,122,0,0.07), transparent 60%)",
                }}
              />
              <BorderBeam size={340} duration={18} />

              <div style={{ position: "relative" }}>
                <div className="h-eyebrow" style={{ marginBottom: 20 }}>ESATIC SmartVote · 2026</div>
                <h2
                  style={{
                    fontSize: "clamp(32px, 5vw, 56px)",
                    fontWeight: 600, letterSpacing: "-0.04em",
                    color: "var(--navy-900)", margin: "0 auto 20px",
                    maxWidth: 640, lineHeight: 1.05,
                  }}
                >
                  Prêt à faire entendre ta voix ?
                </h2>
                <p style={{ fontSize: 17, color: "var(--ink-500)", maxWidth: 480, margin: "0 auto 40px", lineHeight: 1.6 }}>
                  Connecte-toi avec ton matricule ESATIC et vote pour le chef de classe de ta promotion.
                </p>
                <div className="row justify-center gap-3">
                  <ShimmerButton onClick={() => navigate("/login")}>
                    Se connecter <ChevronRight size={18} />
                  </ShimmerButton>
                </div>
              </div>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "40px 0",
        }}
      >
        <div
          className="container row items-center justify-between"
          style={{ padding: "0 32px" }}
        >
          <div className="col gap-2">
            <Brand />
            <span style={{ fontSize: 12, color: "var(--ink-400)", marginTop: 4 }}>
              Projet de soutenance L3 Génie Logiciel · ESATIC Abidjan · 2026
            </span>
          </div>

          <div className="row items-center gap-6">
            <a
              href="#fonctionnement"
              style={{ fontSize: 13, color: "var(--ink-500)" }}
            >
              Fonctionnement
            </a>
            <a
              href="#securite"
              style={{ fontSize: 13, color: "var(--ink-500)" }}
            >
              Sécurité
            </a>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/verify")}
            >
              Vérifier un vote
            </button>
          </div>
        </div>
      </footer>

      <style>{`
        .stat-num {
          font-family: var(--font-mono);
          font-size: 42px;
          font-weight: 700;
          letter-spacing: -0.04em;
          color: white;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}
