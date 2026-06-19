# LocalCo

![CI](https://github.com/Sylapho/localco/actions/workflows/ci.yml/badge.svg)

LocalCo est un monorepo TypeScript pour gérer une activité de commerce local, avec une API métier, une interface interne et une boutique Click & Collect.

Le projet regroupe :

- une API NestJS dans `apps/api` ;
- une application web interne Next.js dans `apps/web` ;
- une boutique Next.js Click & Collect dans `apps/shop` ;
- PostgreSQL, Docker Compose, Prisma, Better Auth, Stripe, Resend et pnpm.

## Stack technique

| Partie | Technologie |
| --- | --- |
| Monorepo | pnpm workspaces |
| API | NestJS, TypeScript |
| Interface interne | Next.js, React, TypeScript, Tailwind CSS |
| Boutique | Next.js, React, TypeScript, Tailwind CSS |
| Base de données | PostgreSQL |
| ORM / migrations | Prisma côté API |
| Authentification | Better Auth |
| Paiement | Stripe Checkout + webhooks |
| E-mails | Resend |
| Services locaux | Docker Compose |
| Tests API | Jest |
| CI | GitHub Actions |

## Structure du monorepo

```txt
localco/
├── apps/
│   ├── api/        # API NestJS, Prisma, paiements, e-mails, logique métier
│   ├── web/        # Application interne Next.js pour la gestion
│   └── shop/       # Boutique Next.js Click & Collect
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Le workspace pnpm inclut tous les packages `apps/*`.

## Prérequis

- Node.js 22, comme dans la CI.
- pnpm 10.33.0, déclaré par `packageManager`.
- Docker Desktop ou Docker Engine pour PostgreSQL en local.
- Git.

## Installation

```bash
git clone https://github.com/Sylapho/localco.git
cd localco
pnpm install
```

## Démo rapide

Cette séquence lance une démonstration locale complète pour présenter le projet.

```bash
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/shop/.env.example apps/shop/.env.local
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

URLs locales :

- Boutique client : `http://localhost:3001`
- Back-office : `http://localhost:3000`
- API : `http://localhost:4000/api`
- Health API : `http://localhost:4000/api/health`
- Readiness API : `http://localhost:4000/api/health/ready`

Commandes de contrôle :

```bash
pnpm test
pnpm build
```

Notes pour la démo :

- `pnpm db:seed` existe et charge un catalogue boutique, des stocks, des lots et un historique de caisse.
- Stripe doit être configuré avec des clés de test dans `apps/api/.env` pour aller jusqu'au paiement Checkout. Sans clé Stripe, le parcours reste compréhensible jusqu'à la préparation du paiement.
- Le back-office est protégé par Better Auth. Les inscriptions sont désactivées ; utilisez un compte existant ou créez-en un via les outils d'administration prévus avant une démonstration complète.
- Le scénario détaillé à montrer à un recruteur est documenté dans [`docs/DEMO.md`](docs/DEMO.md).

## Variables d'environnement

Les fichiers `.env`, `.env.local` et les secrets réels ne doivent jamais être commit.

Des exemples sont fournis dans :

- `.env.example`
- `.env.docker.example`
- `apps/api/.env.example`
- `apps/web/.env.example`
- `apps/shop/.env.example`

### API

Créer `apps/api/.env` à partir de l'exemple :

```bash
cp apps/api/.env.example apps/api/.env
```

Variables utilisées côté API :

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE

BETTER_AUTH_SECRET=replace-with-a-long-random-string
BETTER_AUTH_URL=http://localhost:4000

FRONTEND_URL=http://localhost:3000
SHOP_PUBLIC_URL=http://localhost:3001
API_CORS_ORIGINS=http://localhost:3000,http://localhost:3001
CHECKOUT_RATE_LIMIT_WINDOW_MS=60000
CHECKOUT_RATE_LIMIT_MAX=10

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

### Web

Créer `apps/web/.env.local` à partir de l'exemple :

```bash
cp apps/web/.env.example apps/web/.env.local
```

Variables publiques utilisées par l'interface web :

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
API_INTERNAL_URL=http://localhost:4000/api
NEXT_PUBLIC_AUTH_URL=http://localhost:4000
```

L'application web contient aussi la configuration Better Auth côté serveur. Pour lancer le back-office complet, elle nécessite aussi :

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
GITHUB_CLIENT_ID=replace_me
GITHUB_CLIENT_SECRET=replace_me
GOOGLE_CLIENT_ID=replace_me
GOOGLE_CLIENT_SECRET=replace_me
```

Les variables OAuth sont optionnelles : les providers GitHub et Google ne sont activés que si leur couple `CLIENT_ID` / `CLIENT_SECRET` est présent.

### Shop

Créer `apps/shop/.env.local` à partir de l'exemple :

```bash
cp apps/shop/.env.example apps/shop/.env.local
```

Variable utilisée par la boutique :

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
API_INTERNAL_URL=http://localhost:4000/api
```

## Développement

Démarrer PostgreSQL :

```bash
pnpm db:up
```

Démarrer tout le workspace en parallèle :

```bash
pnpm dev
```

Ou lancer les applications séparément :

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:shop
```

### Docker

Pour lancer l'environnement complet en conteneurs :

```bash
pnpm docker:dev
```

Services lancés :

| Service | URL |
| --- | --- |
| API | `http://localhost:4000/api` |
| Web | `http://localhost:3000` |
| Shop | `http://localhost:3001` |
| PostgreSQL | `localhost:5432` |

Commandes utiles :

```bash
pnpm docker:dev:detached
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
pnpm docker:down:volumes
```

Le guide détaillé est dans `docs/DOCKER.md`.

Ports locaux par défaut :

| Application | URL |
| --- | --- |
| API | `http://localhost:4000/api` |
| Web | `http://localhost:3000` |
| Shop | `http://localhost:3001` |

## Build, lint et tests

Commandes racine :

```bash
pnpm check
pnpm build
pnpm build:api
pnpm build:web
pnpm build:shop
pnpm lint
pnpm lint:api
pnpm lint:web
pnpm lint:shop
pnpm typecheck
pnpm typecheck:api
pnpm typecheck:web
pnpm typecheck:shop
pnpm test
pnpm test:api
pnpm test:web
pnpm test:api:e2e
pnpm test:shop:e2e
pnpm test:shop:smoke
```

Commandes par package :

```bash
pnpm --filter @localco/api build
pnpm --filter @localco/api lint
pnpm --filter @localco/api typecheck
pnpm --filter @localco/api test
pnpm --filter @localco/api test:e2e

pnpm --filter @localco/web dev
pnpm --filter @localco/web build
pnpm --filter @localco/web start
pnpm --filter @localco/web lint
pnpm --filter @localco/web typecheck
pnpm --filter @localco/web test

pnpm --filter @localco/shop dev
pnpm --filter @localco/shop build
pnpm --filter @localco/shop start
pnpm --filter @localco/shop lint
pnpm --filter @localco/shop typecheck
pnpm --filter @localco/shop test:e2e
pnpm --filter @localco/shop test:e2e:smoke
```

`pnpm check` exécute le lint du workspace, le typecheck, les tests unitaires API et Web, puis le build complet.

## Prisma et base de données

PostgreSQL est lancé via Docker Compose.

```bash
pnpm db:up
pnpm db:down
pnpm db:reset
```

`pnpm db:reset` supprime le volume PostgreSQL local avant de redémarrer la base. Cette commande efface les données locales.

Configuration locale usuelle :

```txt
Host: localhost
Port: 5432
Database: localco_db
User: localco
Password: localco_dev
```

Commandes Prisma exposées à la racine :

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:seed
pnpm prisma:generate
pnpm prisma:migrate
```

Le schéma Prisma est dans `apps/api/prisma/schema.prisma`. Il couvre notamment les articles, matières premières, nomenclatures, ventes, commandes, lignes de commandes, historique de statuts, lots de stock et événements webhook Stripe.

Les montants financiers sont stockés et échangés en centimes avec des champs `*Cents` (`prixCents`, `totalTtcCents`, `prixUnitCents`, etc.). Les taux de TVA sont stockés en basis points avec `tvaBps` (`550` = 5,5 %). Les interfaces web et shop convertissent ces valeurs uniquement pour l'affichage en euros lisibles.

## Parcours Click & Collect

La boutique `apps/shop` consomme l'API via `NEXT_PUBLIC_API_URL`.

Parcours principal :

1. Le client consulte les articles en ligne.
2. Il ajoute des produits au panier.
3. Il renseigne ses coordonnées et un créneau de retrait.
4. La boutique appelle `POST /api/commandes/checkout`.
5. L'API crée une commande en attente, applique les mouvements de stock et retourne une session Stripe Checkout.
6. Après paiement, le client revient sur la boutique pour consulter le récapitulatif public de sa commande.
7. L'équipe suit et met à jour les commandes depuis l'application interne.

### Stock négatif et précommandes

Le stock négatif est un comportement métier volontaire. Il ne doit pas être interprété comme une erreur technique ni comme une raison de bloquer le checkout.

Dans LocalCo, une commande qui dépasse le stock disponible représente une précommande. Le stock négatif sert à mesurer les quantités à produire ou à préparer pour honorer les commandes déjà passées.

Le back-office doit donc afficher clairement ces besoins de production et de préparation au lieu de les empêcher. Les écrans internes doivent aider l'équipe à repérer les articles en déficit, prioriser la production et traiter les commandes concernées.

Les quantités à produire sont recalculées depuis le stock courant et les commandes encore ouvertes. Les paiements en attente réservent du stock dans cette allocation, mais seuls les statuts opérationnels (`nouvelle`, `preparee`, `paiement_a_verifier`) affichent un besoin de production.

#### Stock physique, stock réservé et déficit de précommande

LocalCo distingue les notions suivantes :

- Le stock physique par lot est représenté par
  `StockLot.remainingQuantity`. Un lot périmé conserve une quantité physique
  tant qu'il n'a pas été explicitement passé en perte.
- Le stock comptable d'un article est représenté par `Article.stock`. Il tient
  compte des entrées, des sorties et des réservations de commandes.
- Le stock réservé n'est pas stocké dans un champ séparé. Une réservation est
  représentée par un mouvement négatif de commande et est déjà déduite de
  `Article.stock`.
- Lorsque `Article.stock` est négatif, sa valeur absolue représente le déficit
  de précommande, donc la quantité restant à produire ou à préparer.
- La quantité physique passée en perte est toujours strictement positive.
  Le mouvement de stock correspondant utilise un delta négatif.
- Une perte diminue toujours le stock comptable. Lorsque le stock est déjà
  négatif, la perte augmente le déficit de production et ne doit jamais
  augmenter artificiellement le stock.

Les commandes internes sont protégées par Better Auth et des rôles métier.

## Stripe et webhooks

Stripe est utilisé pour le paiement des commandes Click & Collect.

- `POST /api/commandes/checkout` crée la session Stripe Checkout.
- `POST /api/commandes/stripe/webhook` reçoit les événements Stripe.
- Les événements `checkout.session.completed` confirment les commandes payées.
- Les événements `checkout.session.expired` expirent les commandes en attente et libèrent le stock réservé.
- Le modèle `StripeWebhookEvent` suit le cycle `processing` / `processed` / `failed` pour dédupliquer les événements déjà réussis, permettre le retry des échecs et reprendre un traitement `processing` bloqué.

En local, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS` et `SHOP_PUBLIC_URL` doivent être configurés côté API. `STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS` vaut `300000` par défaut et autorise une nouvelle tentative Stripe à reprendre atomiquement un événement resté en `processing` au-delà de ce délai.

Les réconciliations Stripe sont stockées dans `StripeCheckoutReconciliation` avec un historique durable dans `StripeCheckoutReconciliationAttempt`. Le worker périodique est désactivé par défaut et s'active avec `STRIPE_RECONCILIATION_WORKER_ENABLED=true`. Les retries utilisent `STRIPE_RECONCILIATION_MAX_ATTEMPTS`, `STRIPE_RECONCILIATION_BACKOFF_BASE_MS`, `STRIPE_RECONCILIATION_BACKOFF_MAX_MS`, `STRIPE_RECONCILIATION_LEASE_MS`, `STRIPE_RECONCILIATION_BATCH_SIZE` et `STRIPE_RECONCILIATION_WORKER_INTERVAL_MS`. Les cas payés, ambigus ou sans commande passent en revue manuelle dans le back-office `Admin > Stripe`.

La procédure de test manuel avec Stripe CLI est documentée dans `docs/STRIPE_CLI_CHECKOUT.md`. Elle couvre le forwarding local des webhooks, un paiement confirmé et une session Checkout expirée.

## Better Auth

Better Auth gère l'authentification et les sessions.

- L'application web configure Better Auth côté serveur avec PostgreSQL.
- L'API vérifie les sessions via `BetterAuthGuard`.
- Les routes internes sensibles utilisent aussi des rôles : `gerant`, `vendeur`, `production`, `stock`, `comptable`.
- Les inscriptions par e-mail et mot de passe sont désactivées côté web ; les utilisateurs sont administrés via Better Auth.

La matrice des roles, les routes publiques/protegees et la separation `User` / `AuthUser` sont documentees dans `docs/AUTH_ROLES.md`.

Les secrets Better Auth et les secrets OAuth ne doivent pas être exposés côté client.

## Rate limit checkout

`POST /api/commandes/checkout` est limite par IP avec :

- `CHECKOUT_RATE_LIMIT_WINDOW_MS`
- `CHECKOUT_RATE_LIMIT_MAX`

Le stockage actuel est en memoire et reste adapte au local ou a une instance API unique. Pour une production distribuee, la limite doit etre appliquee par une infrastructure partagee ou par un store distribue decide avec l'hebergement. La strategie est documentee dans `docs/CHECKOUT_RATE_LIMITING.md`.

## Nettoyage des commandes abandonnées

Les commandes `paiement_en_attente` trop anciennes deviennent candidates à une commande planifiable externe. Le délai est configuré avec `ABANDONED_ORDER_DELAY_MINUTES` et vaut `60` minutes par défaut. Avant toute annulation locale, le nettoyage relit la commande sous verrou, vérifie ou expire la session Stripe Checkout, puis libère le stock uniquement si la session est neutralisée. Une session déjà payée, introuvable ou une erreur Stripe conserve la réservation et crée une réconciliation durable.

La procédure, les scripts et les garanties d'idempotence multi-instance sont documentés dans `docs/ABANDONED_ORDERS_CLEANUP.md`.

### Tests E2E API

La suite E2E API utilise le vrai `AppModule`, Prisma et une base PostgreSQL dediee. Elle mocke uniquement Stripe, Resend et la verification de session Better Auth dans les fichiers de test.

La configuration locale et CI est documentee dans `docs/API_E2E_TESTS.md`.

## Resend

Resend est utilisé côté API pour les e-mails transactionnels liés aux commandes.

Variables concernées :

```env
RESEND_API_KEY=re_replace_me
RESEND_FROM_EMAIL="Les Cocottes de Diane <commande@example.com>"
```

## CI

La CI GitHub Actions se déclenche sur :

- les pull requests vers `main` ;
- les pushes sur `main`.

Elle utilise Node.js 22 et pnpm 10.33.0.

Workflows actifs :

- `CI` : lint, typecheck, tests unitaires API/Web, builds API/Web/Shop, E2E API PostgreSQL 16, E2E Shop Playwright, smoke full-stack, audit pnpm, build Docker et publication GHCR sur `main`.
- `Dependency Review` : analyse des changements de dépendances sur pull request.
- `CodeQL` : analyse JavaScript/TypeScript sur pull request, push `main` et planification hebdomadaire.
- `Dependabot` : mises à jour hebdomadaires pnpm/npm, GitHub Actions et Docker.

Les rapports de couverture API et Playwright sont publiés comme artefacts CI. Le détail des jobs, des dépendances et des commandes locales équivalentes est documenté dans `docs/CI.md`.

La CI construit des images de production pour API, Web et Shop. Aucune cible de déploiement n'est automatisée tant qu'un hébergeur réel n'est pas choisi ; le contrat attendu est documenté dans `docs/DEPLOYMENT.md`.

## Roadmap courte

- Stabiliser le parcours Click & Collect de bout en bout.
- Renforcer le suivi des commandes et des statuts côté application interne.
- Clarifier le pilotage stock/précommande : le stock négatif représente la production à prévoir, pas une erreur à bloquer.
- Améliorer la couverture de tests sur les flux critiques : commande, paiement, stock, auth.
- Clarifier les workflows d'e-mails transactionnels.

## Dépannage

### `DATABASE_URL` manquante

Vérifier que `apps/api/.env` existe et contient une URL PostgreSQL valide. L'application web peut aussi nécessiter `DATABASE_URL` pour Better Auth côté serveur.

### Connexion PostgreSQL impossible

Vérifier que Docker est lancé, puis relancer la base :

```bash
pnpm db:up
```

### Prisma ne trouve pas le schéma

Utiliser les scripts racine, qui ciblent le package API :

```bash
pnpm db:generate
```

### Le web ou la boutique ne trouve pas l'API

Vérifier les fichiers d'environnement :

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### Le paiement Stripe échoue

Vérifier côté API :

```env
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS=300000
ABANDONED_ORDER_DELAY_MINUTES=60
SHOP_PUBLIC_URL=http://localhost:3001
```

### Le checkout est bloqué par le CORS

Vérifier que l'origine de la boutique est autorisée côté API :

```env
API_CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Conventions de développement

- Utiliser pnpm pour toutes les commandes du monorepo.
- Garder Prisma et les accès métier à la base côté API.
- Stocker les montants financiers en centimes et les taux en basis points ; convertir en euros uniquement à l'affichage.
- Ne pas mélanger les vues internes de gestion et la boutique client.
- Ne jamais exposer les coûts, marges et données financières internes dans les vues client.
- Préserver le préfixe global `/api` côté backend.
- Valider les entrées utilisateur avec des DTO NestJS.
- Garder les contrôleurs fins et placer la logique métier dans les services.
- Protéger les routes internes avec Better Auth et les rôles appropriés.
- Ne pas ajouter de dépendance sans besoin clair.
- Ne pas modifier les migrations déjà appliquées.
- Ne jamais commit les fichiers `.env`, `.env.local` ou des secrets réels.

## Licence

Projet privé / personnel pour le développement de LocalCo.
