# CI LocalCo

La CI est définie dans `.github/workflows/ci.yml` et se déclenche sur les pull requests vers `main` et les pushes sur `main`.

Les workflows de sécurité complémentaires sont :

- `.github/workflows/dependency-review.yml` pour analyser les changements de dépendances dans les pull requests.
- `.github/workflows/codeql.yml` pour l'analyse CodeQL JavaScript/TypeScript sur pull request, push `main` et planification hebdomadaire.
- `.github/dependabot.yml` pour les mises à jour pnpm/npm, GitHub Actions et Docker.

## Jobs

| Job | Dépendances | Rôle |
| --- | --- | --- |
| `lint` | Aucune | Génère le client Prisma puis exécute `pnpm lint`. |
| `typecheck` | Aucune | Génère le client Prisma puis exécute `pnpm typecheck`. |
| `unit-api` | Aucune | Exécute les tests Jest API avec couverture et seuils bloquants. |
| `unit-web` | Aucune | Exécute les tests Web `node:test` TypeScript via `tsx`. |
| `build-api` | Aucune | Compile l'API NestJS. |
| `build-web` | Aucune | Compile l'application Web Next.js en mode `standalone`. |
| `build-shop` | Aucune | Compile la boutique Next.js en mode `standalone`. |
| `api-e2e` | Aucune | Lance PostgreSQL 16, applique les migrations Prisma et exécute les E2E API. |
| `shop-e2e` | Aucune | Construit la boutique, démarre le serveur standalone généré par Next.js et exécute les E2E mockés. |
| `shop-fullstack-smoke` | Aucune | Lance PostgreSQL 16, l'API réelle et la boutique, puis vérifie un affichage catalogue via API et base réelle. |
| `dependency-audit` | Aucune | Exécute `pnpm audit --prod --audit-level high`. |
| `docker-build` | Toutes les validations précédentes | Valide `docker compose config` et construit les images API, Web et Shop. |
| `publish-images` | `docker-build` | Publie les images sur GHCR uniquement lors d'un push sur `main`. |

Les jobs indépendants sont parallélisés par GitHub Actions. PostgreSQL n'est lancé que pour `api-e2e` et `shop-fullstack-smoke`.

## Commandes locales équivalentes

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test:api --runInBand
pnpm test:web
pnpm --filter @localco/api test:cov --runInBand
pnpm build
pnpm test:api:e2e --runInBand
pnpm test:shop:e2e
pnpm test:shop:smoke
pnpm audit --prod --audit-level high
docker compose config
docker build -f apps/api/Dockerfile -t localco-api:ci .
docker build -f apps/web/Dockerfile -t localco-web:ci .
docker build -f apps/shop/Dockerfile -t localco-shop:ci .
```

Pour les tests PostgreSQL, utilisez une base dédiée contenant `e2e` ou `smoke` dans son nom, puis appliquez `pnpm db:deploy`. Ne ciblez jamais une base de développement contenant des données utilisateur.

## Artefacts

- `api-coverage` : rapport Jest dans `apps/api/coverage/`.
- `shop-playwright-report` : rapport HTML Playwright dans `apps/shop/playwright-report/`.
- `shop-playwright-results` : traces et résultats Playwright dans `apps/shop/test-results/`.
- `shop-fullstack-smoke-results` : traces du smoke full-stack dans `apps/shop/test-results/fullstack-smoke/`.

## Sécurité

- Les permissions GitHub Actions sont minimales par défaut (`contents: read`).
- `packages: write` est accordé uniquement au job `publish-images`.
- `security-events: write` est accordé uniquement au workflow CodeQL.
- Les checkouts utilisent `persist-credentials: false`.
- Les actions tierces sont épinglées sur des SHA complets avec un commentaire de version.
- L'audit pnpm est bloquant à partir du niveau `high`.
- Dependency Review bloque les pull requests à partir du niveau `high`.

## Variables de test

La CI utilise uniquement des valeurs de test non secrètes. Les variables importantes sont :

- `DATABASE_URL` pour les jobs PostgreSQL dédiés.
- `NEXT_PUBLIC_API_URL` et `API_INTERNAL_URL` pour les builds Next.js.
- `BETTER_AUTH_SECRET` avec une valeur placeholder non réutilisable.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et `RESEND_API_KEY` avec des placeholders, sans appel externe dans les tests concernés.

## Types de tests

- Les tests unitaires API sont les specs Jest dans `apps/api/src`.
- Les E2E API utilisent NestJS, Prisma et PostgreSQL 16 avec Stripe, Resend et Better Auth mockés par les helpers de test.
- Les tests Web sont les specs TypeScript `node:test` dans `apps/web/src`.
- Les E2E Shop mockés utilisent Playwright, le build de production Shop et un serveur API mocké local déterministe.
- Le smoke full-stack lance la vraie API NestJS, PostgreSQL 16 et le build de production Shop, puis vérifie un parcours lecture simple `Shop -> API -> PostgreSQL`.

## Diagnostic d'échec

1. Ouvrir le premier job rouge, pas seulement `docker-build`, car ce dernier dépend des validations.
2. Pour l'API, vérifier que `pnpm db:generate` a bien précédé lint, typecheck ou build.
3. Pour les E2E PostgreSQL, vérifier l'application des migrations et le nom de la base dédiée.
4. Pour Playwright, télécharger `shop-playwright-report` puis consulter les traces dans `shop-playwright-results`.
5. Pour Docker, reproduire avec la commande `docker build -f ...` correspondante depuis la racine.
6. Pour une publication GHCR, lire le résumé du job `publish-images`, qui contient les digests publiés.
