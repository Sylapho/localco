# LocalCo Shop

Boutique publique Next.js pour le parcours Click & Collect client.

## Rôle

- Afficher le catalogue client sur `http://localhost:3001`.
- Gérer le panier côté navigateur.
- Collecter les coordonnées et le point/date de retrait.
- Appeler l'API pour créer une commande et une session Stripe Checkout.
- Afficher les pages de succès, annulation et suivi client.

## Variables utiles

Copier `apps/shop/.env.example` vers `apps/shop/.env.local`.

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
API_INTERNAL_URL=http://localhost:4000/api
```

La boutique ne contient pas de secret Stripe. Le paiement est préparé par l'API avec des clés Stripe de test.

## Commandes

Depuis la racine du monorepo :

```bash
pnpm dev:shop
pnpm lint:shop
pnpm typecheck:shop
pnpm test:shop:e2e
pnpm test:shop:smoke
pnpm build:shop
```

Commandes propres au package :

```bash
pnpm --filter @localco/shop dev
pnpm --filter @localco/shop lint
pnpm --filter @localco/shop typecheck
pnpm --filter @localco/shop test:e2e
pnpm --filter @localco/shop test:e2e:smoke
pnpm --filter @localco/shop build
pnpm --filter @localco/shop start
```

Il n'existe pas de script `test` unitaire pour `apps/shop` actuellement ; les tests disponibles sont Playwright E2E.

## Pages utiles en démo

- `/` : catalogue et panier.
- `/checkout` : coordonnées, retrait et préparation du paiement.
- `/success` : retour après paiement Stripe.
- `/cancel` : retour après annulation Stripe.
- `/suivi` : suivi public par token.
- `/click-and-collect`, `/cgv`, `/mentions-legales`, `/confidentialite`, `/cookies` : pages d'information.

## Documentation liée

- [README principal](../../README.md)
- [Démo portfolio](../../docs/DEMO.md)
- [Déploiement](../../docs/DEPLOYMENT.md)
