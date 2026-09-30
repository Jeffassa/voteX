import { Link } from "react-router-dom";

import { useConsentStore } from "@/lib/consent";
import { LegalLayout, ToFill } from "./LegalLayout";

export default function PrivacyPage() {
  const { analytics, reopen } = useConsentStore();

  return (
    <LegalLayout title="Politique de confidentialité" updatedAt="29 septembre 2026">
      <p>
        ESATIC SmartVote est la plateforme de vote en ligne utilisée pour l'élection des chefs
        de classe de l'École Supérieure Africaine des TIC (ESATIC). Cette page explique quelles
        données personnelles sont traitées, pourquoi, combien de temps, et comment exercer vos
        droits. Elle s'appuie sur la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la
        protection des données à caractère personnel et, lorsqu'il s'applique, sur le Règlement
        général sur la protection des données (RGPD, règlement UE 2016/679).
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est l'ESATIC, <ToFill>adresse postale de l'établissement</ToFill>.
        Contact pour toute question relative à vos données :{" "}
        <ToFill>adresse e-mail du délégué ou du référent à la protection des données</ToFill>.
      </p>

      <h2>2. Données traitées et finalités</h2>
      <div className="sv-table-wrap"><table>
        <thead>
          <tr><th scope="col">Données</th><th scope="col">Finalité</th><th scope="col">Base légale</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Matricule, nom, prénom, classe, genre, e-mail, photo (facultative)</td>
            <td>Identifier l'électeur, vérifier qu'il vote dans sa classe, afficher les candidats</td>
            <td>Mission d'organisation des élections de l'établissement</td>
          </tr>
          <tr>
            <td>Mot de passe (stocké sous forme d'empreinte bcrypt, jamais en clair)</td>
            <td>Authentification</td>
            <td>Mission d'organisation des élections</td>
          </tr>
          <tr>
            <td>Adresse e-mail confirmée par Google, si vous utilisez « Continuer avec Google » (aucune autre donnée Google n'est demandée)</td>
            <td>Authentification, en la rapprochant de l'adresse enregistrée par l'école</td>
            <td>Votre demande de connexion</td>
          </tr>
          <tr>
            <td>Participation à un scrutin (le fait d'avoir voté, et quand)</td>
            <td>Empêcher le double vote, établir la liste des non-votants</td>
            <td>Mission d'organisation des élections</td>
          </tr>
          <tr>
            <td>Adresse IP, navigateur, date de connexion, actions sensibles</td>
            <td>Sécurité du service, détection des fraudes, journal d'audit</td>
            <td>Intérêt légitime : intégrité du scrutin</td>
          </tr>
          <tr>
            <td>Pages consultées, sans identifiant (uniquement si vous l'acceptez)</td>
            <td>Mesure d'audience anonyme pour améliorer le service</td>
            <td>Consentement</td>
          </tr>
        </tbody>
      </table></div>

      <h2>3. Secret du vote</h2>
      <p>
        Votre choix n'est relié à votre identité par aucune donnée. La plateforme enregistre
        séparément <em>qui a voté</em> et <em>ce qui a été voté</em> : le bulletin ne porte ni
        votre identifiant, ni l'heure du vote. Le reçu que vous recevez (à l'écran, en PDF et
        par e-mail) ne mentionne jamais le candidat choisi. Les scores ne sont publiés qu'à la
        clôture du scrutin.
      </p>
      <p>
        L'empreinte (hash) de chaque bulletin peut être inscrite sur une blockchain publique
        pour en garantir l'intégrité. Cette empreinte ne permet de retrouver ni votre identité,
        ni votre choix. Une inscription sur une blockchain ne peut pas être effacée.
      </p>

      <h2>4. Destinataires</h2>
      <ul>
        <li>Les administrateurs du scrutin désignés par l'ESATIC (liste des électeurs, participation, résultats, mais jamais le choix individuel).</li>
        <li>Le prestataire d'envoi d'e-mails (Resend), pour les codes d'activation, les liens de réinitialisation et les reçus.</li>
        <li>Google, uniquement si vous choisissez « Continuer avec Google » : Google sait alors que vous vous connectez à SmartVote.</li>
        <li>L'hébergeur de la plateforme : <ToFill>nom et pays de l'hébergeur</ToFill>.</li>
        <li>Le cas échéant, le service de suivi des erreurs techniques (Sentry), sans données de vote.</li>
      </ul>
      <p>
        Certains prestataires peuvent être situés hors de Côte d'Ivoire. Ces transferts sont
        encadrés par des garanties contractuelles appropriées.{" "}
        <ToFill>préciser les garanties retenues et, si requis, la référence de l'autorisation de l'ARTCI</ToFill>
      </p>

      <h2>5. Durées de conservation</h2>
      <ul>
        <li>Compte électeur : pendant la scolarité à l'ESATIC, puis <ToFill>durée</ToFill> après la fin de celle-ci.</li>
        <li>Sessions de connexion : 7 jours au plus.</li>
        <li>Participation aux scrutins et bulletins anonymes : <ToFill>durée, par exemple jusqu'à l'expiration des délais de contestation</ToFill>.</li>
        <li>Journal d'audit (IP, actions sensibles) : <ToFill>durée, recommandée : 12 mois</ToFill>.</li>
        <li>Choix relatif aux cookies : 6 mois, après quoi la question vous est reposée.</li>
      </ul>

      <h2 id="cookies">6. Cookies</h2>
      <div className="sv-table-wrap"><table>
        <thead>
          <tr><th scope="col">Cookie</th><th scope="col">Rôle</th><th scope="col">Durée</th><th scope="col">Consentement</th></tr>
        </thead>
        <tbody>
          <tr><td><code>sv_access</code></td><td>Maintenir votre session (inaccessible au JavaScript)</td><td>15 minutes</td><td>Non requis (strictement nécessaire)</td></tr>
          <tr><td><code>sv_refresh</code></td><td>Renouveler la session sans ressaisir le mot de passe</td><td>7 jours</td><td>Non requis (strictement nécessaire)</td></tr>
          <tr><td><code>sv_oauth</code></td><td>Sécuriser une connexion Google en cours (protection contre la falsification)</td><td>10 minutes</td><td>Non requis (strictement nécessaire)</td></tr>
          <tr><td><code>sv_consent</code></td><td>Mémoriser votre choix concernant la mesure d'audience</td><td>6 mois</td><td>Non requis (strictement nécessaire)</td></tr>
        </tbody>
      </table></div>
      <p>
        La mesure d'audience ne dépose aucun cookie : avec votre accord, chaque page consultée
        incrémente un simple compteur anonyme (nom de la page, sans adresse IP ni identifiant).
        Aucun outil tiers, aucune publicité, aucun traceur de réseau social.
      </p>
      <p>
        Votre choix actuel :{" "}
        <strong>
          {analytics === true ? "mesure d'audience acceptée" : analytics === false ? "mesure d'audience refusée" : "aucun choix enregistré"}
        </strong>
        .{" "}
        <button type="button" className="sv-link-button" onClick={reopen}>
          Modifier mon choix
        </button>
      </p>

      <h2>7. Sécurité</h2>
      <p>
        Connexions chiffrées (HTTPS), mots de passe hachés, sessions dans des cookies
        inaccessibles au JavaScript, verrouillage des comptes après des essais répétés, journal
        d'audit non modifiable, et aucune donnée conservée dans le stockage de votre navigateur.
        Pour signaler une faille, consultez la politique de sécurité du projet.
      </p>

      <h2>8. Vos droits</h2>
      <p>
        Vous disposez d'un droit d'accès, de rectification, d'opposition pour motif légitime, de
        limitation et, dans les limites fixées par la loi, d'effacement de vos données. Vous
        pouvez retirer à tout moment votre consentement à la mesure d'audience. Certaines
        données (matricule, nom, classe) sont gérées par l'administration de l'école : leur
        rectification passe par elle.
      </p>
      <p>
        Pour exercer vos droits : <ToFill>adresse e-mail de contact</ToFill>. Une réponse vous
        sera apportée dans un délai d'un mois. Vous pouvez également saisir l'Autorité de
        Régulation des Télécommunications/TIC de Côte d'Ivoire (ARTCI), autorité de protection
        des données personnelles, ou, si le RGPD s'applique à vous, l'autorité de contrôle de
        votre pays de résidence.
      </p>

      <p>
        Voir aussi les <Link to="/cgu">conditions générales d'utilisation</Link>.
      </p>
    </LegalLayout>
  );
}
