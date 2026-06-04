import LegalPage, {
  LegalSection,
  ToComplete,
} from '@/components/shop/legal-page'
import { formatPickupPoint, pickupPoints } from '@/lib/pickup-points'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CGV - Les Cocottes de Diane',
}

export default function CgvPage() {
  return (
    <LegalPage
      title="Conditions générales de vente"
      description="Ces conditions encadrent les commandes passées sur la boutique en ligne."
    >
      <LegalSection title="Vendeur">
        <p>
          Les produits sont vendus par <strong>Les Cocottes de Diane</strong>,
          dont les informations complètes figurent dans les mentions légales.
        </p>
      </LegalSection>

      <LegalSection title="Produits">
        <p>
          Les produits proposés sont présentés avec leurs caractéristiques
          essentielles, leur prix TTC et leur disponibilité. Les photographies
          sont fournies à titre indicatif.
        </p>
      </LegalSection>

      <LegalSection title="Prix">
        <p>
          Les prix sont indiqués en euros, toutes taxes comprises. Les prix
          applicables sont ceux affichés au moment de la validation de la
          commande.
        </p>
      </LegalSection>

      <LegalSection title="Commande">
        <p>
          Le client sélectionne les produits, renseigne ses informations de
          retrait, puis valide sa commande par le paiement en ligne. La commande
          n&apos;est considérée comme confirmée qu&apos;après validation du paiement.
        </p>
      </LegalSection>

      <LegalSection title="Paiement">
        <p>
          Le paiement est effectué en ligne via Stripe. Les informations de
          carte bancaire sont traitées par Stripe et ne sont pas stockées par
          Les Cocottes de Diane.
        </p>
      </LegalSection>

      <LegalSection title="Retrait des commandes">
        <p>
          Les commandes sont à retirer au lieu et à la date choisis lors de la
          commande, sous réserve de confirmation.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {pickupPoints.map((point) => (
            <li key={formatPickupPoint(point)}>{formatPickupPoint(point)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title="Droit de rétractation">
        <p>
          Certains produits alimentaires, notamment les produits périssables ou
          confectionnés selon les spécifications du client, peuvent être exclus
          du droit de rétractation. Cette partie doit être adaptée aux produits
          réellement vendus.
        </p>
        <p>
          Conditions applicables : <ToComplete>à vérifier et compléter</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Réclamations et médiation">
        <p>
          Pour toute réclamation, le client peut contacter Les Cocottes de Diane
          aux coordonnées indiquées dans les mentions légales.
        </p>
        <p>
          Médiateur de la consommation : <ToComplete>à compléter</ToComplete>
        </p>
      </LegalSection>
    </LegalPage>
  )
}
