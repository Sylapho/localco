import LegalPage, {
  LegalSection,
  ToComplete,
} from '@/components/shop/legal-page'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité - Les Cocottes de Diane',
}

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      description="Cette page explique quelles données personnelles sont collectées et comment elles sont utilisées."
    >
      <LegalSection title="Responsable du traitement">
        <p>
          Le responsable du traitement est <strong>Les Cocottes de Diane</strong>.
        </p>
        <p>
          Contact données personnelles : <ToComplete>à compléter</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Données collectées">
        <p>
          Lors d&apos;une commande, les données suivantes peuvent être collectées :
          nom, prénom, adresse email, numéro de téléphone, lieu de retrait,
          date de retrait souhaitée et détails de la commande.
        </p>
      </LegalSection>

      <LegalSection title="Finalités">
        <p>
          Ces données sont utilisées pour traiter les commandes, gérer le
          paiement, organiser le retrait, contacter le client en cas de besoin
          et respecter les obligations légales et comptables.
        </p>
      </LegalSection>

      <LegalSection title="Paiement">
        <p>
          Les paiements sont traités par Stripe. Les Cocottes de Diane ne
          stocke pas les numéros de carte bancaire. Stripe peut traiter des
          données nécessaires à la sécurisation et à l&apos;exécution du paiement.
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <p>
          Les données liées aux commandes sont conservées pendant la durée
          nécessaire au traitement de la commande, puis selon les durées
          imposées par les obligations légales, comptables ou fiscales.
        </p>
        <p>
          Durée précise de conservation : <ToComplete>à compléter</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Droits des personnes">
        <p>
          Conformément à la réglementation applicable, le client peut demander
          l&apos;accès, la rectification, l&apos;effacement ou la limitation du
          traitement de ses données personnelles, lorsque ces droits
          s&apos;appliquent.
        </p>
        <p>
          Pour exercer ces droits : <ToComplete>à compléter</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          La boutique n&apos;utilise pas de cookies publicitaires ou analytiques à ce
          stade. Si des outils de mesure d&apos;audience, de publicité ou de suivi
          sont ajoutés plus tard, cette politique devra être mise à jour.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
