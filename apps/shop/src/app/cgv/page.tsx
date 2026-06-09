import LegalPage, { LegalNotice, LegalSection, ToComplete } from '@/components/shop/legal-page'
import { getPickupPoints } from '@/lib/api'
import { formatPickupPoint } from '@/lib/pickup-points'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CGV - Les Cocottes de Diane',
}

export default async function CgvPage() {
  const pickupPoints = await getPickupPoints()

  return (
    <LegalPage
      title="Conditions Générales de Vente"
      description="Conditions applicables aux commandes alimentaires passées sur la boutique en ligne, avec retrait en Click & Collect uniquement."
    >
      <LegalNotice title="Point critique" variant="warning">
        <p>
          Les commandes sont à retirer exclusivement au point de retrait choisi.
          Aucune livraison à domicile ni expédition n’est proposée.
        </p>
      </LegalNotice>

      <LegalSection title="1. Objet">
        <p>
          Les présentes Conditions Générales de Vente définissent les droits et
          obligations de <strong>[NOM DE LA SOCIÉTÉ]</strong> et de tout client
          consommateur effectuant une commande sur la boutique en ligne.
        </p>
        <p>
          La boutique propose la vente de produits alimentaires à retirer
          exclusivement en Click & Collect selon les lieux, dates et créneaux
          proposés au moment de la commande.
        </p>
        <p>
          Toute commande passée sur le site implique l’acceptation pleine et
          entière des présentes Conditions Générales de Vente.
        </p>
      </LegalSection>

      <LegalSection title="2. Produits alimentaires">
        <p>
          Les produits proposés à la vente sont ceux présentés sur le site au
          moment de la commande, dans la limite des stocks disponibles.
        </p>
        <p>
          Chaque fiche produit indique, lorsque cela est applicable, les
          caractéristiques essentielles du produit, son prix, son conditionnement,
          ses ingrédients, ses allergènes, sa disponibilité et ses modalités de
          conservation.
        </p>
        <LegalNotice title="Produits frais et périssables" variant="success">
          <p>
            Certains produits sont frais, périssables ou soumis au respect de la
            chaîne du froid. Le client s’engage à respecter les conditions de
            transport, de conservation et de consommation indiquées sur le site,
            sur l’étiquette du produit ou lors du retrait.
          </p>
        </LegalNotice>
        <p>
          Les photographies sont fournies à titre indicatif. De légères
          variations d’aspect, de poids, de découpe, de présentation ou de
          conditionnement peuvent exister sans remettre en cause les
          caractéristiques essentielles du produit.
        </p>
      </LegalSection>

      <LegalSection title="3. Prix">
        <p>
          Les prix sont indiqués en euros toutes taxes comprises, sauf indication
          contraire.
        </p>
        <p>
          Le prix applicable est celui affiché au moment de la validation de la
          commande. <strong>[NOM DE LA SOCIÉTÉ]</strong> se réserve le droit de
          modifier ses prix à tout moment, sans effet sur les commandes déjà
          validées.
        </p>
      </LegalSection>

      <LegalSection title="4. Commande">
        <p>
          Le client sélectionne les produits souhaités, les ajoute à son panier,
          choisit un point et une date de retrait parmi les options proposées,
          renseigne ses coordonnées, puis valide sa commande après vérification
          du récapitulatif.
        </p>
        <p>
          La commande devient définitive après validation du paiement. Un e-mail
          de confirmation est envoyé à l’adresse indiquée par le client.
        </p>
        <p>
          Le client est responsable de l’exactitude des informations fournies,
          notamment son nom, son adresse e-mail, son numéro de téléphone et les
          informations de retrait choisies.
        </p>
      </LegalSection>

      <LegalSection title="5. Paiement">
        <p>
          Le paiement s’effectue en ligne via le prestataire de paiement proposé
          sur le site. La commande n’est préparée qu’après validation effective
          du paiement.
        </p>
        <p>
          Les informations bancaires sont traitées par le prestataire de paiement
          sécurisé et ne sont pas conservées par <strong>[NOM DE LA SOCIÉTÉ]</strong>.
        </p>
      </LegalSection>

      <LegalSection title="6. Retrait des commandes — Click & Collect">
        <p>
          Les commandes sont à retirer exclusivement au point de retrait choisi
          lors de la commande.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {pickupPoints.map((point) => (
            <li key={formatPickupPoint(point)}>{formatPickupPoint(point)}</li>
          ))}
        </ul>
        <p>
          Pour retirer sa commande, le client peut être invité à présenter son
          numéro de commande, son e-mail de confirmation ou une pièce d’identité
          lorsque cela est nécessaire.
        </p>
        <LegalNotice title="Délai de retrait" variant="warning">
          <p>
            Pour les produits frais, périssables ou soumis à la chaîne du froid,
            le client doit retirer sa commande sur le créneau choisi ou dans le
            délai indiqué dans l’e-mail de confirmation.
          </p>
        </LegalNotice>
      </LegalSection>

      <LegalSection title="7. Non-retrait de commande">
        <p>
          En cas de non-retrait dans le délai prévu,{' '}
          <strong>[NOM DE LA SOCIÉTÉ]</strong> pourra contacter le client afin de
          convenir d’une solution lorsque cela est possible.
        </p>
        <LegalNotice title="Produits périssables non retirés" variant="danger">
          <p>
            Pour les produits frais, périssables ou préparés à la commande,
            aucun remboursement ne pourra être exigé en cas de non-retrait
            imputable au client lorsque les produits ont été préparés ou réservés
            pour lui et ne peuvent plus être remis en vente pour des raisons
            sanitaires, de fraîcheur ou de sécurité alimentaire.
          </p>
        </LegalNotice>
      </LegalSection>

      <LegalSection title="8. Annulation de commande">
        <p>
          Le client peut demander l’annulation de sa commande en contactant{' '}
          <strong>[NOM DE LA SOCIÉTÉ]</strong> à l’adresse{' '}
          <strong>[EMAIL CONTACT]</strong>.
        </p>
        <p>
          L’annulation est possible tant que la commande n’a pas été préparée,
          réservée spécifiquement ou rendue disponible au retrait.
        </p>
        <p>
          Pour les produits périssables, frais, préparés à la demande ou
          personnalisés, l’annulation peut être refusée si la préparation a déjà
          commencé ou si les produits ont été réservés spécialement pour le
          client.
        </p>
      </LegalSection>

      <LegalSection title="9. Droit de rétractation">
        <p>
          Conformément au Code de la consommation, le client consommateur dispose
          en principe d’un délai de 14 jours pour exercer son droit de
          rétractation dans le cadre d’un achat à distance.
        </p>
        <LegalNotice title="Exceptions pour les produits alimentaires" variant="warning">
          <p>
            Le droit de rétractation ne s’applique pas aux biens susceptibles de
            se détériorer ou de se périmer rapidement, aux produits descellés ne
            pouvant être renvoyés pour des raisons d’hygiène ou de protection de
            la santé, ni aux produits confectionnés selon les spécifications du
            client ou nettement personnalisés, conformément à l’article L221-28
            du Code de la consommation.
          </p>
        </LegalNotice>
        <p>
          En conséquence, les produits alimentaires frais, périssables, préparés
          à la commande, découpés, transformés, personnalisés ou nécessitant une
          conservation spécifique peuvent être exclus du droit de rétractation.
        </p>
        <p>
          Pour les produits non périssables éligibles au droit de rétractation,
          le client peut exercer ce droit dans un délai de 14 jours en envoyant
          une déclaration claire à <strong>[EMAIL CONTACT]</strong>.
        </p>
      </LegalSection>

      <LegalSection title="10. Garanties légales">
        <p>
          Le client bénéficie des garanties légales applicables, notamment la
          garantie légale de conformité et la garantie des vices cachés.
        </p>
        <p>
          Toute demande relative à une non-conformité, un produit manquant, une
          erreur de commande ou un problème de qualité doit être adressée
          rapidement à <strong>[EMAIL CONTACT]</strong>, accompagnée si possible
          du numéro de commande, de photographies et d’une description précise du
          problème.
        </p>
      </LegalSection>

      <LegalSection title="11. Responsabilité liée aux produits alimentaires">
        <p>
          <strong>[NOM DE LA SOCIÉTÉ]</strong> s’engage à préparer, conserver et
          remettre les produits dans le respect des règles d’hygiène et de
          sécurité alimentaire applicables.
        </p>
        <p>
          Après le retrait de la commande, le client devient responsable du
          transport, de la conservation et de la consommation des produits.
        </p>
        <LegalNotice title="Chaîne du froid" variant="warning">
          <p>
            Pour les produits frais ou périssables, le client doit prévoir un
            transport adapté, limiter le temps hors réfrigération et respecter les
            indications de conservation et de date limite de consommation.
          </p>
        </LegalNotice>
      </LegalSection>

      <LegalSection title="12. Données personnelles">
        <p>
          Les données personnelles collectées lors de la commande sont nécessaires
          au traitement de celle-ci, à la gestion du Click & Collect, à la
          relation client, à la facturation, au paiement, à la gestion des
          réclamations et au respect des obligations légales de{' '}
          <strong>[NOM DE LA SOCIÉTÉ]</strong>.
        </p>
        <p>
          Le client dispose d’un droit d’accès, de rectification, d’effacement,
          d’opposition, de limitation du traitement et de portabilité de ses
          données, dans les conditions prévues par le RGPD. Pour exercer ses
          droits, il peut écrire à <strong>[EMAIL CONTACT]</strong>.
        </p>
      </LegalSection>

      <LegalSection title="13. Réclamations, médiation et litiges">
        <p>
          Pour toute réclamation, le client peut contacter{' '}
          <strong>[NOM DE LA SOCIÉTÉ]</strong> à l’adresse{' '}
          <strong>[EMAIL CONTACT]</strong>.
        </p>
        <p>
          Médiateur de la consommation : <ToComplete>[NOM DU MÉDIATEUR]</ToComplete>
          <br />
          Adresse : <ToComplete>[ADRESSE DU MÉDIATEUR]</ToComplete>
          <br />
          Site internet : <ToComplete>[SITE DU MÉDIATEUR]</ToComplete>
        </p>
        <p>
          À défaut de solution amiable, le litige pourra être porté devant les
          juridictions compétentes. Les présentes CGV sont soumises au droit
          français.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
