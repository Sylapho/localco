# Docker development

Ce guide décrit l'environnement Docker de développement de LocalCo.

## État actuel

Docker sert au développement local. La configuration production reste volontairement minimale et n'est pas encore séparée dans un fichier dédié.

Services configurés :

| Service | Rôle | Port hôte |
| --- | --- | --- |
| `postgres` | Base PostgreSQL persistante | `5432` |
| `init` | Installation pnpm + génération Prisma | aucun |
| `api` | API NestJS en watch mode | `4000` |
| `web` | Application interne Next.js | `3000` |
| `shop` | Boutique Next.js | `3001` |

## Prérequis

- Docker Desktop ou Docker Engine avec Docker Compose v2.
- pnpm si vous lancez aussi des commandes hors Docker.
- Node.js 22 si vous lancez les apps hors Docker.

## Premier lancement complet

Depuis la racine du repo :

```bash
pnpm docker:dev
```

Cette commande :

1. construit l'image de développement Node.js ;
2. lance PostgreSQL avec un volume persistant ;
3. installe les dépendances pnpm dans des volumes Docker ;
4. génère Prisma Client ;
5. applique les migrations déjà versionnées avec `prisma migrate deploy` ;
6. lance l'API, le web et la boutique en mode développement.

URLs locales :

| App | URL |
| --- | --- |
| API | `http://localhost:4000/api` |
| Web interne | `http://localhost:3000` |
| Shop | `http://localhost:3001` |

## Lancer seulement PostgreSQL

Pour utiliser Docker uniquement pour la base, et lancer les apps avec pnpm sur l'hôte :

```bash
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Dans ce mode, `DATABASE_URL` doit pointer vers l'hôte :

```env
DATABASE_URL=postgresql://localco:localco_dev@localhost:5432/localco_db
```

## Variables d'environnement

Compose utilise des valeurs de développement par défaut. Pour les surcharger, copier :

```bash
cp .env.docker.example .env
```

Le fichier `.env` racine est ignoré par Git.

Différence importante :

| Contexte | DATABASE_URL |
| --- | --- |
| Depuis l'hôte | `postgresql://localco:localco_dev@localhost:5432/localco_db` |
| Depuis un conteneur | `postgresql://localco:localco_dev@postgres:5432/localco_db` |

Pour Next.js, deux URLs API existent :

| Variable | Usage |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | appels navigateur, doit rester accessible depuis l'hôte |
| `API_INTERNAL_URL` | appels serveur Next.js entre conteneurs |

En Docker, les valeurs recommandées sont :

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
API_INTERNAL_URL=http://api:4000/api
```

Pour tester le paiement depuis la boutique, renseigner au minimum une vraie cle de test Stripe dans le `.env` racine :

```env
STRIPE_SECRET_KEY=sk_test_...
```

Si `STRIPE_SECRET_KEY` reste vide ou contient une valeur de placeholder, la creation de session Stripe echouera et la boutique affichera que le paiement est indisponible.

## Commandes utiles

```bash
pnpm docker:dev
pnpm docker:dev:detached
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
pnpm docker:down:volumes
pnpm docker:db
pnpm docker:db:logs
```

`pnpm docker:down:volumes` supprime aussi le volume PostgreSQL et efface les données locales.

## Prisma

Le service `init` exécute :

```bash
pnpm install --frozen-lockfile
pnpm db:generate
```

Le service `api` exécute ensuite :

```bash
pnpm db:deploy
pnpm dev:api
```

En développement local hors Docker, utilisez :

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Ne lancez pas de migration destructive automatiquement au démarrage.

## Volumes

| Volume | Rôle |
| --- | --- |
| `postgres_data` | données PostgreSQL |
| `node_modules` | dépendances racine pnpm |
| `api_node_modules` | dépendances visibles depuis `apps/api` |
| `web_node_modules` | dépendances visibles depuis `apps/web` |
| `shop_node_modules` | dépendances visibles depuis `apps/shop` |

Ces volumes évitent d'écrire `node_modules` sur l'hôte et gardent le hot reload via le montage du code source.

## Dépannage

### Port déjà utilisé

Modifier `POSTGRES_PORT`, `API_PORT`, `WEB_PORT` ou `SHOP_PORT` dans le `.env` racine, puis relancer Compose.

### Base inaccessible depuis l'hôte

Vérifier que PostgreSQL est lancé :

```bash
pnpm docker:ps
pnpm docker:db:logs
```

### Base inaccessible depuis un conteneur

Vérifier que `DATABASE_URL` utilise bien `postgres` comme host.

### Prisma Client non généré

Relancer :

```bash
docker compose run --rm init
```

### Volume PostgreSQL corrompu ou schema local à repartir de zéro

Attention, cette commande efface les données locales :

```bash
pnpm docker:down:volumes
pnpm docker:dev
```

### Permissions Windows ou WSL

Préférer Docker Desktop avec backend WSL2. Si les fichiers montés deviennent lents ou verrouillés, arrêter les conteneurs puis relancer Docker Desktop.

## Limites connues

- Pas de Dockerfile production dédié pour le moment.
- Pas de reverse proxy local : les apps restent accessibles directement par leurs ports.
- Les secrets Stripe, Resend, OAuth et Better Auth doivent être fournis via un `.env` local et ne doivent pas être commités.
