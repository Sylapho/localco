# LocalCo

LocalCo est un projet monorepo pour construire une application web de gestion locale destinée aux commerçants et à leurs clients.

Le projet contient :

- une API backend avec NestJS ;
- une application web avec Next.js ;
- une base PostgreSQL lancée avec Docker Compose ;
- Prisma côté API pour les données métier ;
- Better Auth pour l'authentification.

## Stack technique

| Partie | Technologie |
| --- | --- |
| Monorepo | pnpm workspaces |
| API | NestJS |
| Web | Next.js, React |
| Base de données | PostgreSQL |
| ORM / migrations métier | Prisma |
| Authentification | Better Auth |
| Conteneur local | Docker Compose |
| Tests API | Jest |

## Structure du projet

```txt
localco/
├── apps/
│   ├── api/        # API NestJS
│   └── web/        # Application Next.js
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

Le workspace pnpm inclut les applications présentes dans `apps/*`.

## Prérequis

Avant de lancer le projet, installe :

- Node.js ;
- pnpm ;
- Docker Desktop ou Docker Engine ;
- Git.

La version pnpm déclarée par le projet est :

```bash
pnpm@10.33.0
```

## Installation

Clone le projet puis installe les dépendances :

```bash
git clone https://github.com/Sylapho/localco.git
cd localco
pnpm install
```

## Variables d'environnement

Crée les fichiers d'environnement nécessaires.

### API

Créer `apps/api/.env` :

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://localco:localco_dev@localhost:5432/localco_db

BETTER_AUTH_SECRET=change_me_minimum_32_chars
BETTER_AUTH_URL=http://localhost:4000

FRONTEND_URL=http://localhost:3000
```

### Web

Créer `apps/web/.env.local` :

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_AUTH_URL=http://localhost:4000
```

> Ne commit jamais les fichiers `.env` ou `.env.local`.

## Base de données locale

Le projet utilise PostgreSQL via Docker Compose.

Démarrer la base :

```bash
docker compose up -d
```

La configuration locale par défaut est :

```txt
Host: localhost
Port: 5432
Database: localco_db
User: localco
Password: localco_dev
```

Arrêter la base :

```bash
docker compose down
```

Supprimer la base et le volume local :

```bash
docker compose down -v
```

## Prisma

Prisma est utilisé côté API pour les données métier de LocalCo.

Générer le client Prisma :

```bash
pnpm --filter @localco/api exec prisma generate
```

Créer ou appliquer une migration en développement :

```bash
pnpm --filter @localco/api exec prisma migrate dev
```

Appliquer les migrations en environnement CI ou production :

```bash
pnpm --filter @localco/api exec prisma migrate deploy
```

Lancer le seed :

```bash
pnpm --filter @localco/api seed
```

## Better Auth

Better Auth est utilisé pour l'authentification.

Les utilisateurs et les sessions doivent être gérés par Better Auth, pas par les modèles Prisma métier.

Les variables importantes sont :

```env
BETTER_AUTH_SECRET=change_me_minimum_32_chars
BETTER_AUTH_URL=http://localhost:4000
```

Si le schéma Better Auth doit être généré ou migré, ajoute une commande dédiée dans `apps/api/package.json`, par exemple selon la configuration retenue du projet :

```json
{
  "scripts": {
    "auth:generate": "better-auth generate",
    "auth:migrate": "better-auth migrate"
  }
}
```

## Lancer le projet en développement

Dans deux terminaux séparés :

### API

```bash
pnpm --filter @localco/api start:dev
```

L'API doit être disponible sur :

```txt
http://localhost:4000/api
```

### Web

```bash
pnpm --filter web dev
```

L'application web doit être disponible sur :

```txt
http://localhost:3000
```

## Commandes utiles

### Depuis la racine

```bash
pnpm install
pnpm dev:api
pnpm dev:web
pnpm test:api
pnpm build:web
pnpm prisma:generate
pnpm prisma:migrate
pnpm db:seed
```

### API

```bash
pnpm --filter @localco/api start:dev
pnpm --filter @localco/api build
pnpm --filter @localco/api test
pnpm --filter @localco/api test:e2e
pnpm --filter @localco/api seed
```

### Web

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web start
pnpm --filter web lint
```

## Tests

Lancer les tests API :

```bash
pnpm --filter @localco/api test
```

Lancer les tests end-to-end API :

```bash
pnpm --filter @localco/api test:e2e
```

## Build

Builder l'API :

```bash
pnpm --filter @localco/api build
```

Builder le front :

```bash
pnpm --filter web build
```

## Convention de développement

- Utiliser pnpm pour installer et lancer les commandes.
- Garder Prisma uniquement côté API.
- Garder Better Auth responsable de l'authentification.
- Ne pas exposer les secrets côté front.
- Préfixer les routes API avec `/api`.
- Ajouter des DTO validés côté NestJS pour les entrées utilisateur.
- Ajouter des tests sur les services et routes critiques.

## Roadmap technique courte

Priorité actuelle :

1. Stabiliser les scripts du monorepo.
2. Créer les fichiers `.env.example`.
3. Vérifier le démarrage API + Web.
4. Stabiliser Prisma côté API.
5. Clarifier les commandes Better Auth.
6. Créer le CRUD `Article`.
7. Ajouter une seed réaliste.
8. Connecter le front au CRUD article.
9. Ajouter l'authentification complète.
10. Protéger les routes API et les pages dashboard.

## Dépannage rapide

### `DATABASE_URL` manquante

Vérifie que `apps/api/.env` existe et contient :

```env
DATABASE_URL=postgresql://localco:localco_dev@localhost:5432/localco_db
```

### Connexion PostgreSQL impossible

Vérifie que Docker tourne :

```bash
docker compose ps
```

Puis relance la base :

```bash
docker compose up -d
```

### Prisma ne trouve pas le schéma

Lance les commandes Prisma depuis le package API :

```bash
pnpm --filter @localco/api exec prisma generate
```

### Le front ne trouve pas l'API

Vérifie `apps/web/.env.local` :

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## Licence

Projet privé / personnel pour le développement de LocalCo.
