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
      description="Cette page regroupe les informations d'identification de l'éditeur du site et les coordonnées utiles."
    >
      <LegalSection title="Éditeur du site">
        <p>
          Le site est édité par <strong>Les Cocottes de Diane</strong>.
        </p>
        <p>
          Statut juridique : <ToComplete>à compléter</ToComplete>
          <br />
          Adresse du siège : <ToComplete>à compléter</ToComplete>
          <br />
          SIRET / RCS / RNE : <ToComplete>à compléter</ToComplete>
          <br />
          Numéro de TVA intracommunautaire :{' '}
          <ToComplete>à compléter si applicable</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Email : <ToComplete>à compléter</ToComplete>
          <br />
          Téléphone : <ToComplete>à compléter</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Directeur de la publication">
        <p>
          Responsable de la publication : <ToComplete>à compléter</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Hébergeur du site : <ToComplete>à compléter</ToComplete>
          <br />
          Adresse de l&apos;hébergeur : <ToComplete>à compléter</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Les contenus présents sur ce site, notamment les textes, images,
          photographies, logos et éléments graphiques, sont protégés par le
          droit de la propriété intellectuelle. Toute reproduction ou
          réutilisation non autorisée est interdite.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
