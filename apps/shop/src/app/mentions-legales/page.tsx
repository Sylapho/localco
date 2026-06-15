import LegalPage, {
  LegalSection,
  ToComplete,
} from '@/components/shop/legal-page'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions légales - Les Cocottes de Diane',
}

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      description="Informations d’identification de l’éditeur de la boutique Click & Collect et coordonnées utiles."
    >
      <LegalSection title="Éditeur du site">
        <p>
          Le présent site est édité par <strong>Les Cocottes de Diane</strong>,
          immatriculée sous le numéro SIRET <strong>90136070100014</strong>, dont le
          siège social est situé à <strong>46 Rue de la Muette, 27490 Clef Vallée d’Eure</strong>.
        </p>
        <p>
          Nom commercial : <strong>Les Cocottes de Diane</strong>.
        </p>
        <p>
          Statut juridique : <strong>Entrepreneur individuel</strong>
          <br />
          Numéro de TVA intracommunautaire :{' '}
            <strong>FR20901360701</strong>
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Pour toute question relative au site, à une commande ou au retrait en
          magasin, vous pouvez nous contacter à l’adresse suivante :{' '}
          <strong>contact@lescocottesdediane.fr</strong>.
        </p>
        <p>
          Téléphone : <ToComplete>à compléter si applicable</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Responsable de la publication">
        <p>
          Le responsable de la publication est{' '}
          <strong>BAUDOIN QUENTIN</strong>, représentant de{' '}
          <strong>Les Cocottes de Diane</strong>.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Le site est hébergé par <strong>[NOM DE L’HÉBERGEUR]</strong>, situé à{' '}
          <strong>[ADRESSE DE L’HÉBERGEUR]</strong>.
        </p>
        <p>
          Contact hébergeur :{' '}
          <ToComplete>[EMAIL DE L’HÉBERGEUR]</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Activité du site">
        <p>
          Le site permet la vente en ligne de produits alimentaires, y compris
          des produits frais, préparés, périssables ou soumis à des conditions
          particulières de conservation.
        </p>
        <p>
          Les commandes sont proposées exclusivement en Click & Collect. Aucune
          livraison à domicile ni expédition n’est proposée depuis cette
          boutique.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Les contenus présents sur ce site, notamment les textes, images,
          photographies, logos, éléments graphiques, icônes, vidéos et éléments
          de mise en page, sont protégés par le droit de la propriété
          intellectuelle.
        </p>
        <p>
          Toute reproduction, représentation, modification ou exploitation,
          totale ou partielle, sans autorisation préalable écrite de{' '}
          <strong>Les Cocottes de Diane</strong>, est interdite.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
