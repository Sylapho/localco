import LegalPage, {
  LegalSection
} from '@/components/shop/legal-page'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité - Les Cocottes de Diane',
}

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      description="Informations relatives à la collecte et à l’utilisation des données personnelles lors d’une commande Click & Collect."
    >
      <LegalSection title="Responsable du traitement">
        <p>
          Le responsable du traitement est <strong>Les Cocottes de Diane</strong>,
          immatriculée sous le numéro SIRET <strong>90136070100014</strong>, située à{' '}
          <strong>46 Rue de la Muette, 27490 Clef Vallée d’Eure</strong>.
        </p>
        <p>
          Contact données personnelles : <strong>contact@lescocottesdediane.fr</strong>.
        </p>
      </LegalSection>

      <LegalSection title="Données collectées">
        <p>
          Lors d’une commande, les données suivantes peuvent être collectées :
          nom, prénom, adresse e-mail, numéro de téléphone, point de retrait,
          date de retrait souhaitée, détails de la commande, informations de
          paiement et échanges éventuels avec le service client.
        </p>
      </LegalSection>

      <LegalSection title="Finalités du traitement">
        <p>
          Ces données sont utilisées pour traiter les commandes, gérer le
          paiement, organiser le retrait en Click & Collect, contacter le client
          en cas de besoin, gérer les réclamations, assurer le suivi client et
          respecter les obligations légales, comptables et fiscales.
        </p>
      </LegalSection>

      <LegalSection title="Base légale">
        <p>
          Les traitements liés à la commande reposent principalement sur
          l’exécution du contrat conclu avec le client. Certains traitements
          peuvent également être nécessaires au respect d’obligations légales ou
          reposer sur l’intérêt légitime de <strong>Les Cocottes de Diane</strong>,
          notamment pour la gestion de la relation client et la sécurité du site.
        </p>
      </LegalSection>

      <LegalSection title="Paiement">
        <p>
          Les paiements sont traités par le prestataire de paiement utilisé sur
          le site. <strong>Les Cocottes de Diane</strong> ne conserve pas les
          données complètes de carte bancaire.
        </p>
      </LegalSection>

      <LegalSection title="Destinataires des données">
        <p>
          Les données peuvent être transmises uniquement aux prestataires
          nécessaires au traitement de la commande, notamment le prestataire de
          paiement, l’hébergeur, les outils de gestion commerciale ou les
          prestataires techniques intervenant pour le fonctionnement du site.
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <p>
          Les données liées aux commandes sont conservées pendant la durée nécessaire au traitement de la commande, 
          puis archivées pendant une durée maximale de <strong>10 ans</strong> à compter de la clôture de l’exercice comptable concerné,
          afin de respecter les obligations légales, comptables et fiscales applicables.
        </p>
      </LegalSection>

      <LegalSection title="Droits des personnes">
        <p>
          Le client dispose d’un droit d’accès, de rectification, d’effacement,
          d’opposition, de limitation du traitement et de portabilité de ses
          données, dans les conditions prévues par la réglementation applicable.
        </p>
        <p>
          Pour exercer ses droits, le client peut contacter{' '}
          <strong>Les Cocottes de Diane</strong> à l’adresse suivante :{' '}
          <strong>contact@lescocottesdediane.fr</strong>.
        </p>
        <p>
          Le client peut également introduire une réclamation auprès de la CNIL.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Le site peut utiliser des cookies nécessaires à son fonctionnement,
          notamment pour gérer le panier, la sécurité, la session utilisateur et
          le paiement. Les cookies non nécessaires ne sont utilisés qu’avec votre
          consentement lorsque celui-ci est requis.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
