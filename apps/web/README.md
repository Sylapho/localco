# LocalCo Web

Interface interne Next.js de LocalCo.

Cette application sert de back-office pour gérer l’activité interne : articles, commandes, stocks, rôles, opérations métier et suivi administratif.

## Rôle de l’application

Le back-office permet de :

- consulter et gérer les articles ;
- consulter et gérer les commandes ;
- suivre les statuts de commande ;
- visualiser les stocks ;
- accéder aux opérations internes ;
- gérer les rôles et l’accès utilisateur ;
- suivre les cas liés aux paiements Stripe ;
- utiliser l’API LocalCo via des appels HTTP sécurisés.

## Stack technique

- Next.js
- React
- TypeScript
- Tailwind CSS
- Better Auth
- API LocalCo NestJS
- pnpm

## Port local

```txt
http://localhost:3000
```

## Structure principale

```txt
apps/web
├── app/                 # App Router Next.js
├── components/          # Composants UI
├── lib/                 # Helpers, clients et fonctions partagées
├── public/              # Assets statiques
└── README.md
```

## Variables d’environnement

Configuration locale recommandée :

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=change-me
```

## Installation

Depuis la racine du monorepo :

```bash
pnpm install
```

## Lancer l’application en développement

```bash
pnpm --filter @localco/web dev
```

L’interface est ensuite disponible sur :

```txt
http://localhost:3000
```

## Build

```bash
pnpm --filter @localco/web build
```

## Lancer en production locale

```bash
pnpm --filter @localco/web start
```

## Tests

```bash
pnpm --filter @localco/web test
```

## Docker

Le back-office peut être lancé avec les autres services depuis la racine du projet :

```bash
pnpm docker:dev
```

Services utilisés en développement :

```txt
API  : http://localhost:4000/api
Web  : http://localhost:3000
Shop : http://localhost:3001
```

## Responsabilités de l’interface

Le back-office doit rester une interface de pilotage.

Il peut :

- afficher les données ;
- envoyer des actions à l’API ;
- valider les formulaires côté client ;
- améliorer l’expérience utilisateur.

Il ne doit pas :

- recalculer seul les règles de stock ;
- modifier directement les quantités critiques ;
- contourner les transitions de commande ;
- traiter les paiements sans passer par l’API ;
- dupliquer la logique métier sensible.

## Fonctionnalités principales

### Commandes

Le back-office permet de suivre les commandes et leurs statuts.

Les changements sensibles doivent être envoyés à l’API afin de garantir la cohérence entre :

- statut de commande ;
- historique ;
- stock réservé ;
- paiement Stripe ;
- éventuelle annulation.

### Stock

Le back-office peut afficher les stocks, mais les modifications doivent passer par des actions métier dédiées.

Les opérations de stock doivent rester traçables et cohérentes avec les mouvements enregistrés côté API.

### Authentification

L’accès au back-office est protégé par Better Auth.

Les pages internes doivent être réservées aux utilisateurs autorisés.

## Qualité attendue

Avant de pousser une modification importante sur le back-office :

```bash
pnpm --filter @localco/web test
pnpm --filter @localco/web build
```

## Notes de développement

- Les appels API doivent utiliser `NEXT_PUBLIC_API_URL`.
- Les erreurs métier retournées par l’API doivent être affichées clairement.
- Les formulaires doivent rester simples et éviter les mutations directes dangereuses.
- Les règles critiques doivent être centralisées dans l’API.