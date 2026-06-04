import LegalPage, { LegalSection } from '@/components/shop/legal-page'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookies - Les Cocottes de Diane',
}

export default function CookiesPage() {
  return (
    <LegalPage
      title="Gestion des cookies"
      description="Cette page explique l’utilisation des cookies et traceurs sur la boutique en ligne."
    >
      <LegalSection title="Qu’est-ce qu’un cookie ?">
        <p>
          Un cookie est un petit fichier déposé sur votre appareil lors de votre
          navigation. Il peut permettre au site de fonctionner correctement, de
          mémoriser certaines informations ou de mesurer l’utilisation du site.
        </p>
      </LegalSection>

      <LegalSection title="Cookies nécessaires au fonctionnement du site">
        <p>
          La boutique peut utiliser des cookies strictement nécessaires au bon
          fonctionnement du service, notamment pour gérer le panier, sécuriser la
          navigation, maintenir la session utilisateur et permettre le paiement
          en ligne.
        </p>
        <p>
          Ces cookies sont indispensables à l’utilisation du site et ne peuvent
          pas être désactivés depuis notre interface.
        </p>
      </LegalSection>

      <LegalSection title="Cookies de mesure d’audience ou de personnalisation">
        <p>
          Si des outils de mesure d’audience, de personnalisation ou de suivi
          marketing sont ajoutés au site, ils ne seront utilisés qu’avec votre
          consentement lorsque celui-ci est requis.
        </p>
        <p>
          Vous pourrez alors accepter, refuser ou modifier vos préférences depuis
          le bandeau ou le module de gestion des cookies prévu à cet effet.
        </p>
      </LegalSection>

      <LegalSection title="Gestion de vos préférences">
        <p>
          Vous pouvez à tout moment configurer votre navigateur pour bloquer ou
          supprimer les cookies. Toutefois, le blocage de certains cookies
          nécessaires peut empêcher le fonctionnement normal du panier, du compte
          client ou du paiement.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Pour toute question relative aux cookies ou à vos données personnelles,
          vous pouvez contacter <strong>[NOM DE LA SOCIÉTÉ]</strong> à l’adresse
          suivante : <strong>[EMAIL CONTACT]</strong>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
