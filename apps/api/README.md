# LocalCo API

API NestJS de LocalCo. Elle concentre la logique métier utilisée par la boutique et le back-office.

## Rôle

- Exposer les endpoints sous `http://localhost:4000/api`.
- Gérer articles, matières premières, commandes, ventes, stock, lots et caisse.
- Créer les sessions Stripe Checkout et traiter les webhooks.
- Envoyer les e-mails transactionnels via Resend.
- Vérifier les sessions Better Auth et les rôles métier.
- Exposer `/api/health` et `/api/health/ready`.

## Variables utiles

Copier `apps/api/.env.example` vers `apps/api/.env`.

```env
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
BETTER_AUTH_SECRET=replace-with-a-long-random-string
BETTER_AUTH_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
SHOP_PUBLIC_URL=http://localhost:3001
API_CORS_ORIGINS=http://localhost:3000,http://localhost:3001
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

Utiliser uniquement des clés Stripe de test en local. Ne jamais commit de secrets réels.

## Commandes

Depuis la racine du monorepo :

```bash
pnpm dev:api
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm lint:api
pnpm typecheck:api
pnpm test:api
pnpm test:api:e2e
pnpm build:api
```

Commandes propres au package :

```bash
pnpm --filter @localco/api start:dev
pnpm --filter @localco/api test
pnpm --filter @localco/api test:e2e
pnpm --filter @localco/api build
```

## Notes métier

- Les mutations de stock doivent passer par les services métier pour garder un historique cohérent.
- Les commandes payées, annulées ou ambiguës doivent rester cohérentes avec Stripe et les réservations de stock.
- Le seed charge un catalogue, des stocks, des lots avec DLC et un historique de caisse.

## Documentation liée

- [README principal](../../README.md)
- [Démo portfolio](../../docs/DEMO.md)
- [Déploiement](../../docs/DEPLOYMENT.md)
- [Tests E2E API](../../docs/API_E2E_TESTS.md)
- [Stripe CLI checkout](../../docs/STRIPE_CLI_CHECKOUT.md)
