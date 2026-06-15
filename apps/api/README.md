# LocalCo API

API NestJS de LocalCo.

Cette application contient la logique métier centrale du projet : commandes, articles, stocks, lots, paiements Stripe, webhooks, rôles et opérations d’administration.

## Rôle de l’application

L’API est responsable de :

- exposer les endpoints utilisés par le back-office et la boutique ;
- gérer les articles et les matières premières ;
- gérer les commandes Click & Collect ;
- réserver, consommer et restituer le stock ;
- gérer les lots, les DLC et les mouvements de stock ;
- traiter les paiements Stripe Checkout ;
- recevoir et vérifier les webhooks Stripe ;
- gérer l’authentification et les rôles via Better Auth ;
- exécuter les tests unitaires et E2E PostgreSQL.

## Stack technique

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Better Auth
- Stripe
- Resend
- Jest
- Supertest
- Docker Compose

## Port local

```txt
http://localhost:4000/api
```

## Structure principale

```txt
apps/api
├── prisma/              # Schéma Prisma et migrations
├── src/                 # Code source NestJS
├── test/                # Tests E2E
├── Dockerfile           # Image Docker de l’API
└── README.md
```

## Variables d’environnement

Exemple de configuration locale :

```env
PORT=4000
DATABASE_URL=postgresql://localco:localco@localhost:5432/localco

BETTER_AUTH_SECRET=change-me
BETTER_AUTH_URL=http://localhost:3000

WEB_APP_URL=http://localhost:3000
SHOP_APP_URL=http://localhost:3001

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

RESEND_API_KEY=re_xxx
MAIL_FROM=no-reply@localco.local
```

## Installation

Depuis la racine du monorepo :

```bash
pnpm install
```

## Lancer l’API en développement

```bash
pnpm --filter @localco/api start:dev
```

## Générer le client Prisma

```bash
pnpm --filter @localco/api exec prisma generate
```

## Appliquer les migrations

```bash
pnpm --filter @localco/api exec prisma migrate dev
```

## Lancer les tests

Tests unitaires :

```bash
pnpm --filter @localco/api test
```

Tests E2E :

```bash
pnpm --filter @localco/api test:e2e
```

Tests avec exécution séquentielle :

```bash
pnpm --filter @localco/api test --runInBand
```

## Build

```bash
pnpm --filter @localco/api build
```

## Docker

L’API est conçue pour fonctionner avec Docker Compose depuis la racine du projet.

```bash
pnpm docker:dev
```

Le service API utilise PostgreSQL et expose les endpoints sur :

```txt
http://localhost:4000/api
```

## Responsabilités métier importantes

L’API concentre les règles critiques du projet.

### Stock

Les modifications de stock doivent passer par des opérations métier dédiées :

- réception ;
- ajustement ;
- production ;
- vente ;
- commande ;
- annulation ;
- perte.

Les mutations directes du champ `stock` via les CRUD génériques doivent être évitées afin de conserver un historique cohérent.

### Commandes

Les commandes Click & Collect peuvent impliquer :

- une réservation de stock ;
- un paiement Stripe ;
- une annulation ;
- une restitution de stock ;
- un historique de statut ;
- une vérification métier en cas de paiement ambigu.

### Stripe

L’API doit garantir que :

- les sessions Stripe sont liées aux commandes locales ;
- les webhooks sont vérifiés ;
- les paiements sont traités de manière idempotente ;
- une commande payée ne peut pas être annulée automatiquement ;
- les cas incohérents sont placés en réconciliation.

### Lots et DLC

La gestion des lots permet de conserver une traçabilité du stock, notamment pour les produits périssables.

Les consommations doivent respecter une logique FEFO afin d’utiliser les lots expirant le plus tôt en premier.

## Qualité attendue

Avant de pousser une modification importante sur l’API :

```bash
pnpm --filter @localco/api test
pnpm --filter @localco/api test:e2e
pnpm --filter @localco/api build
```

## Notes de développement

- La logique métier critique doit rester côté API.
- Les interfaces web ne doivent pas recalculer seules les règles de stock ou de commande.
- Les opérations sensibles doivent être transactionnelles.
- Les tests E2E PostgreSQL sont prioritaires pour les scénarios de stock, commande et paiement.