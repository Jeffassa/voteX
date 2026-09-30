import { Link } from "react-router-dom";

import { LegalLayout, ToFill } from "./LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout title="Conditions générales d'utilisation" updatedAt="29 septembre 2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions encadrent l'utilisation d'ESATIC SmartVote, plateforme de vote en
        ligne mise à disposition par l'ESATIC pour l'élection des chefs de classe. Utiliser la
        plateforme vaut acceptation de ces conditions.
      </p>

      <h2>2. Éditeur et hébergement</h2>
      <p>
        Éditeur : ESATIC, <ToFill>adresse, téléphone, directeur de la publication</ToFill>.<br />
        Hébergeur : <ToFill>raison sociale, adresse et téléphone de l'hébergeur</ToFill>.
      </p>

      <h2>3. Accès au service</h2>
      <p>
        La plateforme est réservée aux étudiants et aux personnels de l'ESATIC dont le compte a
        été créé par l'administration. L'activation d'un compte suppose de confirmer son
        identité ; une revendication de compte qui ne peut pas être confirmée par un canal
        contrôlé par l'école est soumise à une vérification humaine.
      </p>
      <p>
        L'ESATIC s'efforce d'assurer la disponibilité du service pendant les scrutins, sans
        pouvoir la garantir en toutes circonstances (maintenance, panne, cas de force majeure).
        En cas d'incident affectant un scrutin, les organisateurs peuvent en prolonger ou en
        reporter la période.
      </p>

      <h2>4. Compte et identifiants</h2>
      <ul>
        <li>Votre compte est personnel. Vous ne devez ni le prêter, ni utiliser celui d'un autre.</li>
        <li>Vous êtes responsable de la confidentialité de votre mot de passe. Déconnectez-vous après usage sur un poste partagé.</li>
        <li>En cas de doute sur l'utilisation de votre compte, changez votre mot de passe et utilisez « Déconnecter tous les appareils » depuis votre profil.</li>
      </ul>

      <h2>5. Déroulement du vote</h2>
      <ul>
        <li>Chaque électeur ne peut voter qu'une fois par scrutin, et uniquement pour sa classe.</li>
        <li>Un vote enregistré est définitif : il ne peut être ni modifié, ni annulé.</li>
        <li>Le vote blanc est possible.</li>
        <li>Le vote est secret : ni les administrateurs, ni la plateforme ne peuvent relier un bulletin à son auteur.</li>
        <li>Le reçu fourni après le vote permet de vérifier que votre bulletin a bien été compté, sans révéler votre choix.</li>
      </ul>

      <h2>6. Comportements interdits</h2>
      <p>Il est interdit notamment :</p>
      <ul>
        <li>de voter ou de tenter de voter à la place d'autrui ;</li>
        <li>d'exercer une pression sur un électeur, d'acheter ou de vendre un vote, ou d'exiger la preuve d'un vote ;</li>
        <li>de tenter d'accéder à des données ou fonctions non autorisées, de perturber le service ou d'en contourner les protections ;</li>
        <li>d'automatiser l'utilisation de la plateforme (robots, scripts) hors des usages prévus.</li>
      </ul>
      <p>
        Tout manquement peut entraîner la suspension du compte, l'invalidation des actes
        concernés et des poursuites disciplinaires, sans préjudice d'éventuelles poursuites
        pénales. Une vulnérabilité découverte de bonne foi doit être signalée selon la politique
        de sécurité du projet, et non exploitée.
      </p>

      <h2>7. Contestation des résultats</h2>
      <p>
        Toute contestation d'un résultat est adressée à <ToFill>instance compétente et adresse de contact</ToFill>{" "}
        dans un délai de <ToFill>délai</ToFill> après la publication des résultats.
      </p>

      <h2>8. Propriété intellectuelle</h2>
      <p>
        La plateforme, sa charte graphique et ses contenus sont protégés. Toute reproduction non
        autorisée est interdite, sauf mention contraire (licences des composants libres
        utilisés).
      </p>

      <h2>9. Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans la{" "}
        <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>10. Évolution et droit applicable</h2>
      <p>
        Ces conditions peuvent évoluer ; la version en vigueur est celle publiée sur cette page.
        Elles sont soumises au droit ivoirien. <ToFill>juridiction compétente en cas de litige</ToFill>.
      </p>
    </LegalLayout>
  );
}
