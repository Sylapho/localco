# LocalCo Shop

Boutique publique Next.js de LocalCo.

Cette application permet aux clients de consulter les produits, composer un panier, créer une commande Click & Collect et payer via Stripe Checkout.

## Rôle de l’application

La boutique permet de :

- afficher les produits disponibles ;
- consulter les informations produit ;
- ajouter des articles au panier ;
- créer une commande ;
- rediriger vers Stripe Checkout ;
- afficher les pages de succès ou d’annulation ;
- permettre un parcours client simple pour du retrait physique.

## Stack technique

- Next.js
- React
- TypeScript
- Tailwind CSS
- Stripe Checkout
- API LocalCo NestJS
- pnpm

## Port local

```txt
http://localhost:3001
```

## Structure principale

```txt
apps/shop
├── app/                 # App Router Next.js
├── components/          # Composants de la boutique
├── lib/                 # Helpers, panier, client API
├── public/              # Assets statiques
└── README.md
```

## Variables d’environnement

Configuration locale recommandée :

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_SHOP_URL=http://localhost:3001
```

## Installation

Depuis la racine du monorepo :

```bash
pnpm install
```

## Lancer la boutique en développement

```bash
pnpm --filter @localco/shop dev
```

La boutique est ensuite disponible sur :

```txt
http://localhost:3001
```

## Build

```bash
pnpm --filter @localco/shop build
```

## Lancer en production locale

```bash
pnpm --filter @localco/shop start
```

## Tests

```bash
pnpm --filter @localco/shop test
```

## Docker

La boutique peut être lancée avec les autres services depuis la racine du projet :

```bash
pnpm docker:dev
```

Services utilisés en développement :

```txt
API  : http://localhost:4000/api
Web  : http://localhost:3000
Shop : http://localhost:3001
```

## Parcours client

Le parcours principal est le suivant :

1. Le client consulte les produits.
2. Le client ajoute des produits au panier.
3. Le client valide son panier.
4. La boutique demande à l’API de créer une commande.
5. L’API crée une session Stripe Checkout.
6. Le client paie sur Stripe.
7. Stripe notifie l’API via webhook.
8. L’API confirme ou vérifie la commande.
9. Le client revient sur une page de succès ou d’annulation.

## Responsabilités de la boutique

La boutique doit offrir une expérience simple et claire au client.

Elle peut :

- afficher les produits ;
- gérer l’état local du panier ;
- envoyer une demande de commande à l’API ;
- rediriger vers Stripe Checkout ;
- afficher les erreurs compréhensibles.

Elle ne doit pas :

- modifier directement le stock ;
- confirmer elle-même un paiement ;
- faire confiance uniquement au retour navigateur Stripe ;
- appliquer seule les règles métier sensibles ;
- considérer une commande comme payée sans validation côté API.

## Stripe Checkout

La boutique utilise Stripe Checkout via l’API.

La logique de paiement doit rester côté API :

- création de session ;
- association avec une commande ;
- vérification du montant ;
- vérification de la devise ;
- traitement des webhooks ;
- réconciliation des cas incohérents.

## Click & Collect

LocalCo est pensé pour un modèle Click & Collect.

La boutique doit donc rendre clairs :

- les produits disponibles ;
- le fonctionnement du retrait ;
- le paiement ;
- les informations de commande ;
- les conditions d’annulation ou de vérification.

## Qualité attendue

Avant de pousser une modification importante sur la boutique :

```bash
pnpm --filter @localco/shop test
pnpm --filter @localco/shop build
```

## Notes de développement

- Les appels API doivent utiliser `NEXT_PUBLIC_API_URL`.
- Le panier doit rester simple et prévisible.
- Le paiement final doit toujours être validé par l’API.
- Les messages d’erreur doivent être compréhensibles pour un utilisateur non technique.