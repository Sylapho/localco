import LegalPage, { LegalNotice, LegalSection } from '@/components/shop/legal-page'
import { formatPickupPoint, pickupPoints } from '@/lib/pickup-points'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Click & Collect - Les Cocottes de Diane',
}

export default function ClickAndCollectPage() {
  return (
    <LegalPage
      title="Comment fonctionne le Click & Collect ?"
      description="Commandez vos produits alimentaires en ligne, choisissez votre point de retrait, puis récupérez votre commande localement."
    >
      <LegalNotice title="Retrait uniquement" variant="info">
        <p>
          Aucune livraison à domicile n’est proposée. Toutes les commandes sont à
          retirer au point de retrait sélectionné lors de la commande.
        </p>
      </LegalNotice>

      <LegalSection title="Le principe">
        <p>
          Ajoutez vos produits au panier, choisissez un point et une date de
          retrait, réglez votre commande en ligne, puis présentez-vous au retrait
          avec votre numéro de commande.
        </p>
        <p>
          Nous préparons votre commande avec soin afin de vous remettre vos
          produits dans les meilleures conditions possibles.
        </p>
      </LegalSection>

      <LegalSection title="Les étapes">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Choisissez vos produits depuis la boutique.</li>
          <li>Sélectionnez le point et la date de retrait disponibles.</li>
          <li>Renseignez vos coordonnées et payez en ligne.</li>
          <li>Retirez votre commande avec votre numéro de commande.</li>
        </ol>
      </LegalSection>

      <LegalSection title="Points de retrait">
        <p>
          Les points de retrait disponibles sont proposés automatiquement au
          moment du paiement selon les jours ouverts.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {pickupPoints.map((point) => (
            <li key={formatPickupPoint(point)}>{formatPickupPoint(point)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title="Produits frais et périssables">
        <LegalNotice title="Préserver la fraîcheur" variant="success">
          <p>
            Si votre commande contient des produits frais ou périssables, merci
            de respecter le créneau ou la date de retrait choisi. Après retrait,
            prévoyez un transport rapide et conservez les produits selon les
            indications communiquées.
          </p>
        </LegalNotice>
        <p>
          Certains produits doivent être placés au frais dès que possible après
          le retrait. En cas de doute, demandez conseil à notre équipe lors de la
          remise de la commande.
        </p>
      </LegalSection>

      <LegalSection title="Retard ou impossibilité de retrait">
        <p>
          Si vous ne pouvez pas venir retirer votre commande, contactez-nous le
          plus rapidement possible à l’adresse <strong>[EMAIL CONTACT]</strong>.
        </p>
        <p>
          Pour les produits frais ou périssables déjà préparés, un retrait tardif
          peut empêcher leur conservation ou leur remise en vente pour des raisons
          sanitaires.
        </p>
      </LegalSection>

      <LegalSection title="Commencer une commande">
        <p>
          Vous pouvez consulter les produits disponibles et préparer votre panier
          depuis la boutique.
        </p>
        <Link
          href="/#produits"
          className="inline-flex rounded-full bg-[#b5006e] px-5 py-3 text-sm font-black text-white transition hover:bg-[#8c0055]"
        >
          Voir les produits disponibles
        </Link>
      </LegalSection>
    </LegalPage>
  )
}
