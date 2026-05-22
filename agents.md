# AGENTS.md — LocalCo

## Projet

LocalCo est un monorepo pnpm avec :

- `apps/api` : API NestJS + Prisma v7 + PostgreSQL
- `apps/web` : frontend NextJS App Router
- PostgreSQL lancé via Docker Compose

## Commandes importantes

Installer les dépendances :

```bash
pnpm install
```

Lancer PostgreSQL :

```bash
docker-compose up -d
```

Lancer l'API :

```bash
pnpm --filter @localco/api dev
```

Lancer le frontend :

```bash
pnpm --filter @localco/web dev
```

Generer les modèles Prisma :

```bash
pnpm --filter @localco/api exec prisma generate
```

Appliquer les migrations Prisma :

```bash
pnpm --filter @localco/api exec prisma migrate dev
```

Peupler la base de données :

```bash
pnpm --filter @localco/api seed
```

Lancer les tests de l'API :

```bash
pnpm --filter @localco/api test
```

# Variables d’environnement

## API

```
apps/api/.env
```

## Web

```
apps/web/.env.local
```

Ne jamais commit les vrais .env.

## Prisma

Le projet utilise Prisma v7.

Ne pas remettre url = env("DATABASE_URL") dans schema.prisma si le projet utilise prisma.config.ts.

Le client Prisma est généré dans :

apps/api/prisma/generated/prisma
API

## Préfixe global NestJS

/api

## URL locale

http://localhost:4000/api

## Routes importantes

GET    /api/articles
GET    /api/articles/:id
GET    /api/articles/:id/capacity
POST   /api/articles/:id/produce

GET    /api/matieres-premieres
GET    /api/articles/:articleId/nomenclature
Frontend

Le frontend doit utiliser :

NEXT_PUBLIC_API_URL=http://localhost:4000/api

Utiliser localhost:3000, pas l’IP réseau donnée par Next, sinon CORS peut bloquer les requêtes.

## Conventions
Utiliser TypeScript strictement.
Ne pas utiliser any sauf nécessité temporaire.
Créer un dossier par feature NestJS.
Utiliser DTO + class-validator côté API.
Garder les mutations frontend dans des composants "use client".
Après une mutation frontend, appeler router.refresh().
Les pages Next App Router serveur peuvent utiliser fetch avec cache: "no-store".

## Structure

### API

```
apps/api/src/
  articles/
  matieres-premieres/
  nomenclature/
  prisma/

### Web

```
apps/web/src/
  app/
  components/
  lib/api.ts
```

## Avant de modifier

Toujours vérifier :

le modèle Prisma concerné
le DTO
le service Nest
le controller
les fonctions dans apps/web/src/lib/api.ts
les pages ou composants Next concernés
Tests à faire après modification

Pour une modification backend :

```
pnpm --filter api test
pnpm --filter api start:dev
```

Pour une modification frontend :

```
pnpm --filter web build
```

Pour une modification Prisma :

```
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate dev
```

## 2. Crée des `.env.example`

### `apps/api/.env.example`

```env
DATABASE_URL="postgresql://localco:localco_dev@localhost:5432/localco_db"
PORT=4000
CLERK_SECRET_KEY=
apps/web/.env.example
NEXT_PUBLIC_API_URL=http://localhost:4000/api```