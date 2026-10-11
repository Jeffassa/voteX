import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

import { Brand } from "@/components/Brand";
import { Microtext, Rosette, Stamp, WaveBand } from "@/components/SecurityPattern";
import { HERO_POSTER, loadBallotBoxScene, wantsHero3d } from "@/components/three/heroScene";
import { Reveal } from "@/components/Reveal";
import { useConsentStore } from "@/lib/consent";

/**
 * Scène 3D chargée à la demande : Three.js n'est téléchargé que par la page
 * d'accueil, jamais par la salle de vote ni par l'administration. En attendant,
 * l'image fixe de sa première image tient la place (voir heroScene.ts).
 */
const BallotBoxScene = lazy(loadBallotBoxScene);

const STEPS = [
  {
    title: "Connectez-vous",
    text: "Avec votre matricule ESATIC et votre mot de passe, ou avec l'adresse Google enregistrée par l'école.",
  },
  {
    title: "Cochez",
    text: "Le bulletin présente les candidats de votre classe. Tracez votre croix, puis maintenez le bouton pour la confirmer. Le vote blanc est possible.",
  },
  {
    title: "Vérifiez",
    text: "Vous recevez un reçu avec une empreinte unique. Elle prouve que votre bulletin est compté, sans révéler votre choix.",
  },
];

/** Les garanties, rédigées comme les articles d'une charte du scrutin. */
const ARTICLES = [
  {
    title: "Vote secret",
    text: "Le bulletin est enregistré sans votre identité ni l'heure du vote. Rien ne relie un électeur à son choix.",
  },
  {
    title: "Reçu vérifiable",
    text: "Chaque bulletin reçoit une empreinte SHA-256, que vous pouvez contrôler sur ce site à tout moment.",
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

const GUARANTEES = [
  "Votre choix n'est visible par personne, administration comprise.",
  "Un compte Google ne peut ouvrir que le compte que l'école vous a attribué.",
  "Le code source est public et peut être audité.",
  "Les scores ne sont publiés qu'à la fermeture du scrutin.",
];

export default function LandingPage() {
  const reopenConsent = useConsentStore((s) => s.reopen);
  const [want3d] = useState(wantsHero3d);
  const [sceneReady, setSceneReady] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="ESATIC SmartVote, accueil">
            <Brand />
          </Link>
          <nav aria-label="Navigation principale" className="flex items-center gap-1 text-sm">
            <a href="#fonctionnement" className="hidden rounded-[5px] px-3 py-2 text-[var(--ink-700)] hover:bg-muted sm:inline-block">
              Fonctionnement
            </a>
            <a href="#securite" className="hidden rounded-[5px] px-3 py-2 text-[var(--ink-700)] hover:bg-muted sm:inline-block">
              Sécurité
            </a>
            <Link to="/verify" className="hidden rounded-[5px] px-3 py-2 text-[var(--ink-700)] hover:bg-muted md:inline-block">
              Vérifier un vote
            </Link>
            <Link to="/login" className="btn btn-primary btn-sm ml-2">
              Se connecter
            </Link>
          </nav>
        </div>
      </header>

      {/* Héros */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-20 lg:pt-20">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-[3px] border border-[var(--border-strong)] bg-white px-2.5 py-1 font-mono text-[12px] text-[var(--ink-700)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-[1px] bg-[var(--orange-500)]" />
              Élections des chefs de classe 2026
            </p>
            <h1 className="mt-6 text-[44px] font-[540] leading-[1.02] tracking-[-0.02em] text-[var(--navy-900)] sm:text-[60px] lg:text-[72px]">
              Le vote des chefs de classe, en ligne.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--ink-700)]">
              Votez en une minute depuis votre téléphone, puis vérifiez vous-même que votre
              bulletin a été compté. Personne ne voit votre choix, pas même l'administration.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="btn btn-primary btn-lg">
                Voter maintenant <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/verify" className="btn btn-outline btn-lg">
                Vérifier un vote
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--ink-500)]">
              {["Vote secret", "Reçu vérifiable", "Résultats à la clôture"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check size={15} aria-hidden="true" className="text-[var(--navy-700)]" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="relative h-[300px] sm:h-[380px] lg:h-[460px]">
            {/* Rosace guillochée derrière l'urne : le fond des documents
                infalsifiables, en écho au vote vérifiable. */}
            <Rosette
              size={520}
              opacity={0.1}
              style={{ color: "var(--navy-900)", left: "50%", top: "50%", transform: "translate(-50%, -50%)", maxWidth: "none" }}
            />
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
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    sceneReady ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Suspense>
            )}
          </div>
        </div>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement" className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal onScroll>
            <p className="sv-ref">Fonctionnement</p>
            <h2 className="sv-display mt-2 max-w-xl text-[36px] font-[540] leading-[1.1] text-[var(--navy-900)] sm:text-[44px]">
              Trois étapes, une minute.
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" onScroll delay={i * 0.08} key={s.title} className="border-t-[1.5px] border-[var(--navy-900)] pt-5">
                <span aria-hidden="true" className="sv-display block text-[60px] font-[480] leading-[0.9] text-[var(--orange-600)]">
                  {i + 1}
                </span>
                <h3 className="sv-display mt-4 text-[26px] font-[560] leading-tight text-[var(--navy-900)]">
                  <span className="sr-only">Étape {i + 1} : </span>
                  {s.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-700)]">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Charte du scrutin */}
      <section className="border-y border-border bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal onScroll>
            <p className="sv-ref">Charte du scrutin</p>
            <h2 className="sv-display mt-2 max-w-2xl text-[36px] font-[540] leading-[1.1] text-[var(--navy-900)] sm:text-[44px]">
              Conçue pour qu'un vote en ligne mérite la même confiance qu'une urne.
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
            {ARTICLES.map((a, i) => (
              <Reveal as="li" onScroll delay={(i % 3) * 0.06} key={a.title} className="border-t border-[var(--border-strong)] py-6">
                <p className="sv-ref m-0">Article {i + 1}</p>
                <h3 className="sv-display mt-2 text-[23px] font-[560] leading-tight text-[var(--navy-900)]">{a.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-700)]">{a.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Sécurité et vérification */}
      <section id="securite" className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal onScroll>
            <p className="sv-ref">Sécurité</p>
            <h2 className="sv-display mt-2 text-[36px] font-[540] leading-[1.1] text-[var(--navy-900)] sm:text-[44px]">
              Vous pouvez vérifier, sans avoir à nous croire sur parole.
            </h2>
            <ul className="mt-6 space-y-3">
              {GUARANTEES.map((g) => (
                <li key={g} className="flex gap-3 text-[15px] leading-relaxed text-[var(--ink-700)]">
                  <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--navy-700)]" />
                  {g}
                </li>
              ))}
            </ul>
            <Link to="/verify" className="btn btn-outline mt-8">
              Vérifier un reçu <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Reveal>

          <Reveal onScroll delay={0.1}>
            <figure className="relative m-0 overflow-hidden rounded-[7px] border border-border bg-white shadow-[var(--shadow-lg)]">
              <WaveBand height={18} />
              <div className="relative px-6 pb-5 pt-5">
                <Stamp small style={{ position: "absolute", right: 22, top: 18 }}>A voté</Stamp>
                <figcaption className="sv-ref">Exemple de reçu</figcaption>
                <p className="sv-display m-0 mt-1 text-[22px] font-[560] text-[var(--navy-900)]">Chef de classe, L3 Génie Logiciel</p>
                <Microtext style={{ marginTop: 12 }} />
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-[var(--ink-500)]">Empreinte du bulletin</dt>
                    <dd className="mt-1 break-all rounded-[3px] border border-dashed border-[#b4c4da] bg-[var(--navy-50)] px-3 py-2 font-mono text-[12.5px] text-[var(--navy-800)]">
                      0x8f3a51c0e9d7b4a2f6e1c3d5b7a9e0f2c4d6b8a0e2f4c6d8b0a2e4f6c8d0c21e
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--ink-500)]">Statut</dt>
                    <dd className="flex items-center gap-1.5 text-[var(--success-600)]">
                      <Check size={14} aria-hidden="true" /> Bulletin compté
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--ink-500)]">Candidat choisi</dt>
                    <dd className="text-[var(--ink-900)]">Jamais affiché</dd>
                  </div>
                </dl>
              </div>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* Appel à l'action */}
      <section className="px-4 pb-16 sm:px-6 sm:pb-24">
        <Reveal onScroll className="sv-navy-panel mx-auto max-w-6xl rounded-[10px] px-6 py-12 text-center sm:px-12 sm:py-16">
          <Rosette size={520} opacity={0.12} style={{ left: -160, top: -170 }} />
          <Rosette size={420} opacity={0.1} style={{ right: -140, bottom: -180 }} />
          <h2 className="sv-display text-[34px] font-[540] leading-tight sm:text-[44px]">Le scrutin de votre classe est ouvert ?</h2>
          <p className="mx-auto mt-3 max-w-md text-[16px] text-white/80">
            Connectez-vous pour voter. Cela prend moins d'une minute.
          </p>
          <Link to="/login" className="btn btn-accent btn-lg mt-8">
            Se connecter <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Brand />
            <p className="mt-2 text-[13px] text-[var(--ink-500)]">
              Projet de soutenance, L3 Génie Logiciel, ESATIC Abidjan, 2026.
            </p>
          </div>
          <nav aria-label="Liens du pied de page" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[var(--ink-500)]">
            <Link to="/verify" className="hover:text-[var(--ink-900)]">Vérifier un vote</Link>
            <Link to="/confidentialite" className="hover:text-[var(--ink-900)]">Confidentialité</Link>
            <Link to="/cgu" className="hover:text-[var(--ink-900)]">CGU</Link>
            <button type="button" className="sv-link-button" onClick={reopenConsent}>
              Gérer les cookies
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
}
