# Tests E2E API

## Objectif

La suite E2E API verifie les parcours critiques avec le vrai `AppModule`, les
vrais services metier, Prisma et PostgreSQL. Les requetes passent par Supertest
et le serveur HTTP NestJS en memoire.

Les services externes sont remplaces aux frontieres :

- Stripe Checkout est remplace par une passerelle de test injectable ;
- les signatures webhook Stripe sont generees et verifiees avec le SDK Stripe
  local, sans appel reseau ;
- Resend est remplace par un faux service d'e-mails en memoire ;
- la session Better Auth est remplacee par un guard de test local lisant
  `x-e2e-user-role`, tandis que `RolesGuard` reste reel.

## Base de donnees dediee

Les E2E refusent d'utiliser une base qui ne contient pas `e2e` dans
`DATABASE_URL`. La base recommandee en local est :

```txt
postgresql://localco:localco_dev@localhost:5432/localco_e2e
```

Les tests nettoient les tables metier avec `TRUNCATE ... RESTART IDENTITY
CASCADE` avant chaque scenario et conservent `_prisma_migrations`.

## Commandes locales

PowerShell :

```powershell
$env:NODE_ENV='test'
$env:DATABASE_URL='postgresql://localco:localco_dev@localhost:5432/localco_e2e'
pnpm db:deploy
pnpm test:api:e2e --runInBand
```

Bash :

```bash
NODE_ENV=test DATABASE_URL=postgresql://localco:localco_dev@localhost:5432/localco_e2e pnpm db:deploy
NODE_ENV=test DATABASE_URL=postgresql://localco:localco_dev@localhost:5432/localco_e2e pnpm test:api:e2e --runInBand
```

## Variables minimales

```txt
NODE_ENV=test
DATABASE_URL=postgresql://localco:localco_dev@localhost:5432/localco_e2e
BETTER_AUTH_SECRET=test_better_auth_secret_at_least_32_chars
BETTER_AUTH_URL=http://localhost:4000
SHOP_PUBLIC_URL=http://localhost:3001
STRIPE_SECRET_KEY=sk_test_localco_e2e
STRIPE_WEBHOOK_SECRET=whsec_localco_e2e_secret
```

## Couverture

La suite couvre notamment :

- catalogue public boutique ;
- validation globale des DTO ;
- checkout reussi avec precommande et stock negatif ;
- echec Stripe Checkout avec liberation de reservation ;
- webhooks `checkout.session.completed` et `checkout.session.expired` signes ;
- deduplication des webhooks Stripe ;
- creation directe de commande protegee par roles ;
- routes critiques commandes, stock et caisse ;
- resume public de session checkout ;
- nettoyage manuel des commandes abandonnees.

## Depannage

Si la suite refuse de demarrer, verifier que `NODE_ENV=test` et que
`DATABASE_URL` pointe vers une base contenant `e2e`.

Si Prisma echoue sur les migrations, appliquer `pnpm db:deploy` avec la meme
`DATABASE_URL`.

La suite est configuree avec un seul worker Jest afin d'eviter les collisions
de donnees et de rendre les transactions PostgreSQL deterministes.
