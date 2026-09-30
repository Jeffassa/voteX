import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileCheck2,
  Link2,
  Lock,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { Brand } from "@/components/Brand";
import { Reveal } from "@/components/Reveal";
import SpotlightCards, { type SpotlightItem } from "@/components/kokonutui/spotlight-cards";
import { useConsentStore } from "@/lib/consent";

/**
 * Scène 3D chargée à la demande : Three.js n'est téléchargé que par la page
 * d'accueil, jamais par la salle de vote ni par l'administration.
 */
const BallotBoxScene = lazy(() => import("@/components/three/BallotBoxScene"));

const STEPS = [
  {
    title: "Connectez-vous",
    text: "Avec votre matricule ESATIC et votre mot de passe, ou avec l'adresse Google enregistrée par l'école.",
  },
  {
    title: "Choisissez",
    text: "Consultez les candidats de votre classe, puis maintenez le bouton de vote pour confirmer. Le vote blanc est possible.",
  },
  {
    title: "Vérifiez",
    text: "Vous recevez un reçu avec une empreinte unique. Elle prouve que votre bulletin est compté, sans révéler votre choix.",
  },
];

const FEATURES: SpotlightItem[] = [
  {
    icon: Lock,
    title: "Vote secret",
    description: "Le bulletin est enregistré sans votre identité ni l'heure du vote. Rien ne relie un électeur à son choix.",
    color: "#1e4172",
  },
  {
    icon: FileCheck2,
    title: "Reçu vérifiable",
    description: "Chaque bulletin reçoit une empreinte SHA-256, que vous pouvez contrôler sur ce site à tout moment.",
    color: "#15803d",
  },
  {
    icon: BarChart3,
    title: "Résultats à la clôture",
    description: "Pendant le scrutin, seule la participation est visible, pour ne pas influencer les derniers votants.",
    color: "#b55600",
  },
  {
    icon: Link2,
    title: "Empreintes sur blockchain",
    description: "Les empreintes sont inscrites sur Ethereum (réseau de test Sepolia), où personne ne peut les effacer.",
    color: "#6d28d9",
  },
  {
    icon: ShieldCheck,
    title: "Une voix par étudiant",
    description: "Un bulletin par électeur et par scrutin, garanti par la base de données elle-même.",
    color: "#0369a1",
  },
  {
    icon: Smartphone,
    title: "Sur votre téléphone",
    description: "Aucune application à installer : le site fonctionne sur mobile, tablette et ordinateur.",
    color: "#be123c",
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="ESATIC SmartVote, accueil">
            <Brand />
          </Link>
          <nav aria-label="Navigation principale" className="flex items-center gap-1 text-sm">
            <a href="#fonctionnement" className="hidden rounded-lg px-3 py-2 text-[var(--ink-700)] hover:bg-muted sm:inline-block">
              Fonctionnement
            </a>
            <a href="#securite" className="hidden rounded-lg px-3 py-2 text-[var(--ink-700)] hover:bg-muted sm:inline-block">
              Sécurité
            </a>
            <Link to="/verify" className="hidden rounded-lg px-3 py-2 text-[var(--ink-700)] hover:bg-muted md:inline-block">
              Vérifier un vote
            </Link>
            <Link to="/login" className="btn btn-primary btn-sm ml-2">
              Se connecter
            </Link>
          </nav>
        </div>
      </header>

      {/* Héros */}
      <section className="relative overflow-hidden border-b border-border bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(24,24,27,0.07) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(ellipse at 30% 40%, black 10%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-20 lg:pt-20">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-[13px] font-medium text-[var(--ink-700)] shadow-sm">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--orange-500)]" />
              Élections des chefs de classe 2026
            </p>
            <h1 className="mt-6 text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-[var(--ink-900)] sm:text-[56px] lg:text-[64px]">
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
                  <Check size={15} aria-hidden="true" className="text-[#15803d]" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="relative h-[300px] sm:h-[380px] lg:h-[460px]">
            <div
              aria-hidden="true"
              className="absolute inset-6 rounded-full opacity-60 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(74,119,176,0.18), transparent 70%)" }}
            />
            <Suspense fallback={null}>
              <BallotBoxScene className="absolute inset-0" />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement" className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal onScroll>
            <p className="h-eyebrow">Fonctionnement</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-[-0.025em] text-[var(--ink-900)] sm:text-4xl">
              Trois étapes, une minute.
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" onScroll delay={i * 0.08} key={s.title} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <span className="font-mono text-sm text-[var(--ink-500)]">{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-[var(--ink-900)]">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-700)]">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Garanties */}
      <section className="border-y border-border bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal onScroll>
            <p className="h-eyebrow">Ce que la plateforme garantit</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-[-0.025em] text-[var(--ink-900)] sm:text-4xl">
              Conçue pour qu'un vote en ligne mérite la même confiance qu'une urne.
            </h2>
          </Reveal>
          <SpotlightCards items={FEATURES} showHeader={false} className="mt-8 bg-transparent px-0 pt-0 pb-0" />
        </div>
      </section>

      {/* Sécurité et vérification */}
      <section id="securite" className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal onScroll>
            <p className="h-eyebrow">Sécurité</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-[var(--ink-900)] sm:text-4xl">
              Vous pouvez vérifier, sans avoir à nous croire sur parole.
            </h2>
            <ul className="mt-6 space-y-3">
              {GUARANTEES.map((g) => (
                <li key={g} className="flex gap-3 text-[15px] leading-relaxed text-[var(--ink-700)]">
                  <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#15803d]" />
                  {g}
                </li>
              ))}
            </ul>
            <Link to="/verify" className="btn btn-outline mt-8">
              Vérifier un reçu <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Reveal>

          <Reveal onScroll delay={0.1}>
            <figure className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
              <figcaption className="text-sm font-medium text-[var(--ink-700)]">Exemple de reçu</figcaption>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-[var(--ink-500)]">Empreinte du bulletin</dt>
                  <dd className="mt-1 break-all rounded-lg bg-muted px-3 py-2 font-mono text-[13px] text-[var(--ink-900)]">
                    0x8f3a51c0e9d7b4a2f6e1c3d5b7a9e0f2c4d6b8a0e2f4c6d8b0a2e4f6c8d0c21e
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--ink-500)]">Élection</dt>
                  <dd className="text-right text-[var(--ink-900)]">Chef de classe, L3 Génie Logiciel</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--ink-500)]">Statut</dt>
                  <dd className="flex items-center gap-1.5 text-[#15803d]">
                    <Check size={14} aria-hidden="true" /> Bulletin compté
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--ink-500)]">Candidat choisi</dt>
                  <dd className="text-[var(--ink-900)]">Jamais affiché</dd>
                </div>
              </dl>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* Appel à l'action */}
      <section className="px-4 pb-16 sm:px-6 sm:pb-24">
        <Reveal onScroll className="mx-auto max-w-6xl rounded-3xl bg-[var(--navy-900)] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
          <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Le scrutin de votre classe est ouvert ?</h2>
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
