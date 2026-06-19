# LocalCo Web

Back-office Next.js de LocalCo pour piloter l'activité interne.

## Rôle

- Tableau de bord interne sur `http://localhost:3000`.
- Gestion des commandes Click & Collect et de leur préparation.
- Suivi des articles, matières premières, lots, mouvements de stock et production.
- Caisse du jour, ventes et historique de clôture.
- Administration des utilisateurs, points de retrait et réconciliations Stripe pour les rôles autorisés.

## Variables utiles

Copier `apps/web/.env.example` vers `apps/web/.env.local`.

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
API_INTERNAL_URL=http://localhost:4000/api
NEXT_PUBLIC_AUTH_URL=http://localhost:4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`DATABASE_URL` est nécessaire côté serveur pour Better Auth. Les providers OAuth sont optionnels. Les inscriptions par e-mail sont désactivées ; un compte doit être créé par l'administration Better Auth.

## Commandes

Depuis la racine du monorepo :

```bash
pnpm dev:web
pnpm lint:web
pnpm typecheck:web
pnpm test:web
pnpm build:web
```

Commandes propres au package :

```bash
pnpm --filter @localco/web dev
pnpm --filter @localco/web lint
pnpm --filter @localco/web typecheck
pnpm --filter @localco/web test
pnpm --filter @localco/web build
pnpm --filter @localco/web start
```

## Pages utiles en démo

- `/` : tableau de bord.
- `/commandes` : commandes en ligne.
- `/preparation` : préparation par date et point de retrait.
- `/stock` : stock, lots et mouvements.
- `/caisse` : caisse du jour.
- `/articles` et `/matieres-premieres` : catalogue interne.
- `/admin/stripe-reconciliations` : suivi Stripe pour un compte `gerant`.

## Documentation liée

- [README principal](../../README.md)
- [Démo portfolio](../../docs/DEMO.md)
- [Déploiement](../../docs/DEPLOYMENT.md)
