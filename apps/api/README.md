# LocalCo API

API backend de **LocalCo**, développée avec **NestJS**, **TypeScript**, **PostgreSQL** et **Prisma**.

Cette API centralise la logique métier principale de l’application : articles, matières premières, stocks, lots, ventes, commandes, paiements Stripe, utilisateurs et opérations d’administration.

---

## Sommaire

* [Stack technique](#stack-technique)
* [Rôle de l’API](#rôle-de-lapi)
* [Prérequis](#prérequis)
* [Installation](#installation)
* [Variables d’environnement](#variables-denvironnement)
* [Base de données](#base-de-données)
* [Commandes utiles](#commandes-utiles)
* [Lancer l’API](#lancer-lapi)
* [Tests](#tests)
* [Architecture du dossier](#architecture-du-dossier)
* [Conventions de développement](#conventions-de-développement)
* [Gestion du stock](#gestion-du-stock)
* [Paiements Stripe](#paiements-stripe)
* [Sécurité](#sécurité)
* [CI/CD](#cicd)
* [Dépannage](#dépannage)
* [Bonnes pratiques avant commit](#bonnes-pratiques-avant-commit)

---

## Stack technique

L’API utilise principalement :

* **NestJS** pour la structure backend
* **TypeScript** pour le typage
* **PostgreSQL** comme base de données
* **Prisma** pour l’accès aux données et les migrations
* **Jest** pour les tests unitaires et e2e
* **Stripe Checkout** pour les paiements
* **better-auth** pour l’authentification
* **pnpm** comme gestionnaire de paquets
* **Docker** pour l’environnement local

---

## Rôle de l’API

L’API LocalCo est responsable de :

* gérer les articles vendables ;
* gérer les matières premières ;
* suivre les stocks physiques et théoriques ;
* gérer les lots avec dates d’expiration ;
* enregistrer les mouvements de stock ;
* créer et suivre les commandes ;
* créer et réconcilier les paiements Stripe ;
* exposer les données nécessaires aux applications frontend ;
* garantir l’intégrité métier en cas d’opérations concurrentes.

L’API ne doit pas uniquement modifier des champs en base de données. Elle doit protéger les règles métier importantes : stock non négatif, lots cohérents, commandes atomiques, paiements synchronisés et annulations idempotentes.

---

## Prérequis

Depuis la racine du monorepo, il faut avoir :

* Node.js compatible avec le projet
* pnpm installé
* Docker et Docker Compose
* PostgreSQL disponible via Docker ou localement
* une configuration `.env` valide

Vérifier les versions :

```bash
node -v
pnpm -v
docker -v
docker compose version
```

---

## Installation

Depuis la racine du monorepo :

```bash
pnpm install
```

Puis générer le client Prisma si nécessaire :

```bash
pnpm --filter @localco/api exec prisma generate
```

---

## Variables d’environnement

Créer un fichier `.env` dans `apps/api` ou utiliser la configuration prévue par le monorepo.

Exemple :

```env
# App
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://localco:localco@localhost:5432/localco?schema=public

# Auth
BETTER_AUTH_SECRET=replace-me
BETTER_AUTH_URL=http://localhost:3000

# CORS
CORS_ORIGIN=http://localhost:3001,http://localhost:3002

# Stripe
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
STRIPE_CURRENCY=eur

# Frontend URLs
WEB_APP_URL=http://localhost:3001
SHOP_APP_URL=http://localhost:3002
```

Les secrets ne doivent jamais être commités.

À vérifier dans `.gitignore` :

```gitignore
.env
.env.local
.env.*.local
```

---

## Base de données

L’API utilise PostgreSQL.

### Démarrer PostgreSQL avec Docker

Depuis la racine du projet :

```bash
docker compose up -d
```

Selon la configuration du projet, il est aussi possible de lancer uniquement le service PostgreSQL :

```bash
docker compose up -d postgres
```

### Appliquer les migrations

```bash
pnpm --filter @localco/api exec prisma migrate dev
```

### Générer le client Prisma

```bash
pnpm --filter @localco/api exec prisma generate
```

### Ouvrir Prisma Studio

```bash
pnpm --filter @localco/api exec prisma studio
```

---

## Commandes utiles

Toutes les commandes suivantes sont à lancer depuis la racine du monorepo.

### Développement

```bash
pnpm --filter @localco/api dev
```

### Build

```bash
pnpm --filter @localco/api build
```

### Lint

```bash
pnpm --filter @localco/api lint
```

### Tests unitaires

```bash
pnpm --filter @localco/api test
```

### Tests en mode watch

```bash
pnpm --filter @localco/api test:watch
```

### Tests e2e

```bash
pnpm --filter @localco/api test:e2e
```

### Tests avec couverture

```bash
pnpm --filter @localco/api test:cov
```

### Prisma generate

```bash
pnpm --filter @localco/api exec prisma generate
```

### Prisma migrate

```bash
pnpm --filter @localco/api exec prisma migrate dev
```

---

## Lancer l’API

En local :

```bash
pnpm --filter @localco/api dev
```

L’API devrait être disponible sur :

```txt
http://localhost:3000
```

Si une documentation Swagger est activée dans le projet, elle peut être disponible sur une route comme :

```txt
http://localhost:3000/docs
```

ou :

```txt
http://localhost:3000/api
```

La route exacte est à vérifier dans `main.ts`.

---

## Tests

Les tests sont essentiels pour cette API, car plusieurs parties du domaine sont sensibles à la concurrence.

Les zones critiques à tester sont :

* création de vente ;
* consommation de stock ;
* consommation FEFO des lots ;
* production avec matières premières ;
* annulation de commande ;
* restitution de stock ;
* webhook Stripe ;
* réconciliation Stripe ;
* transitions de statut de commande.

### Lancer tous les tests API

```bash
pnpm --filter @localco/api test
```

### Lancer les tests en séquentiel

Utile pour éviter certains conflits de base de données pendant les tests :

```bash
pnpm --filter @localco/api test --runInBand
```

### Lancer les tests e2e

```bash
pnpm --filter @localco/api test:e2e
```

---

## Architecture du dossier

Structure indicative :

```txt
apps/api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/
│   ├── articles/
│   ├── matieres-premieres/
│   ├── stock/
│   ├── lots/
│   ├── ventes/
│   ├── commandes/
│   ├── paiements/
│   ├── stripe/
│   ├── users/
│   ├── common/
│   └── prisma/
├── test/
├── package.json
├── tsconfig.json
└── README.md
```

Les noms exacts peuvent varier selon l’état actuel du projet.

---

## Conventions de développement

### Services

La logique métier doit être placée dans les services NestJS.

Les contrôleurs doivent rester fins :

* validation des entrées ;
* appel au service ;
* retour de la réponse HTTP.

Éviter de placer de la logique métier complexe dans les contrôleurs.

### Transactions

Toute opération qui modifie plusieurs entités métier doit être transactionnelle.

Exemples :

* création d’une vente + décrément stock + mouvement ;
* production + consommation matières premières + création lots ;
* annulation commande + restitution stock + historique ;
* paiement Stripe + changement de statut commande.

### Erreurs métier

Utiliser des erreurs explicites.

Exemples :

* `ConflictException` pour une concurrence ou un stock insuffisant ;
* `BadRequestException` pour une transition invalide ;
* `NotFoundException` pour une ressource inexistante ;
* `UnauthorizedException` ou `ForbiddenException` pour les accès refusés.

### DTO

Les DTO doivent empêcher les mutations dangereuses.

Par exemple, le stock ne doit pas être modifiable directement via un simple `PATCH`.

Mauvais exemple :

```ts
export class UpdateArticleDto {
  stock?: number;
}
```

Bon principe :

```ts
export class UpdateArticleDto {
  nom?: string;
  description?: string;
  prix?: number;
}
```

Toute modification de stock doit passer par une opération métier dédiée.

---

## Gestion du stock

La gestion du stock est une zone critique du projet.

Les règles suivantes doivent être respectées :

1. Le stock ne doit jamais devenir négatif.
2. Toute modification de stock doit créer un mouvement.
3. Les lots doivent être cohérents avec le stock global.
4. Les consommations doivent être atomiques.
5. Les opérations concurrentes ne doivent pas consommer deux fois le même stock.
6. Les annulations doivent être idempotentes.
7. Les dates d’expiration des lots doivent être conservées.

### Mouvements de stock

Chaque entrée ou sortie de stock doit être tracée.

Exemples de mouvements :

* réception ;
* ajustement ;
* production ;
* vente ;
* commande ;
* annulation ;
* perte ;
* correction administrative.

Un mouvement doit idéalement contenir :

* le type de mouvement ;
* la quantité ;
* la ressource concernée ;
* l’utilisateur ou le système responsable ;
* la date ;
* une référence métier ;
* un identifiant d’opération idempotente si nécessaire.

### Lots et FEFO

Les lots avec date d’expiration doivent être consommés selon la règle **FEFO** :

```txt
First Expired, First Out
```

Cela signifie que les lots qui expirent le plus tôt doivent être consommés en premier.

En cas d’annulation, les quantités doivent être restituées dans leurs lots d’origine, avec leur date d’expiration initiale.

---

## Paiements Stripe

L’API utilise Stripe Checkout pour gérer les paiements.

Le flux attendu est généralement :

1. création d’une commande locale ;
2. réservation du stock ;
3. création d’une session Stripe Checkout ;
4. persistance du `stripeId` sur la commande ;
5. paiement côté Stripe ;
6. réception du webhook ;
7. validation du montant, de la devise et du statut ;
8. confirmation de la commande.

### Webhook Stripe

Le webhook doit vérifier :

* la signature Stripe ;
* le type d’événement ;
* le statut de paiement ;
* le montant payé ;
* la devise ;
* la commande associée ;
* l’idempotence de l’événement.

Un webhook ne doit pas confirmer aveuglément une commande annulée.

### Réconciliation Stripe

Certaines situations doivent créer une entrée de réconciliation durable :

* session Stripe créée mais non persistée localement ;
* session inconnue reçue dans un webhook ;
* erreur lors de l’expiration d’une session ;
* session payée alors que la commande locale est dans un état incohérent ;
* paiement reçu pour une commande annulée.

L’objectif est d’éviter les états impossibles comme :

```txt
Commande annulée localement mais session Stripe encore payable
```

ou :

```txt
Commande annulée localement mais paiement Stripe confirmé
```

---

## Sécurité

Points importants :

* ne jamais exposer les secrets dans les logs ;
* valider tous les DTO ;
* refuser les champs non autorisés avec le `ValidationPipe` ;
* protéger les routes sensibles ;
* limiter les permissions selon les rôles ;
* vérifier les webhooks Stripe ;
* éviter les mutations directes de stock ;
* éviter les erreurs silencieuses dans les traitements critiques ;
* ne jamais faire confiance aux données venant du frontend.

Configuration recommandée dans `main.ts` :

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

---

## CI/CD

Avant de pousser une modification, lancer au minimum :

```bash
pnpm --filter @localco/api lint
pnpm --filter @localco/api test --runInBand
pnpm --filter @localco/api build
```

Si la modification touche la base de données :

```bash
pnpm --filter @localco/api exec prisma generate
pnpm --filter @localco/api exec prisma migrate dev
pnpm --filter @localco/api test:e2e
```

Les tests liés à PostgreSQL doivent idéalement être exécutés avec une vraie base PostgreSQL, pas uniquement avec des mocks.

---

## Dépannage

### `DATABASE_URL is missing`

Vérifier que la variable est bien définie dans `.env`.

```bash
echo $DATABASE_URL
```

Sous Windows PowerShell :

```powershell
echo $env:DATABASE_URL
```

### Prisma Client non généré

Relancer :

```bash
pnpm --filter @localco/api exec prisma generate
```

### La base Docker ne démarre pas

Vérifier les conteneurs :

```bash
docker ps
docker compose ps
```

Voir les logs :

```bash
docker compose logs postgres
```

### Port déjà utilisé

Si le port `3000` est déjà utilisé :

```bash
netstat -ano | findstr :3000
```

Puis arrêter le processus concerné ou changer le port dans `.env`.

### Tests instables en concurrence

Pour les tests sensibles à la base de données :

```bash
pnpm --filter @localco/api test --runInBand
```

Vérifier aussi que chaque test nettoie correctement ses données.

---

## Bonnes pratiques avant commit

Avant de commit une modification API :

```bash
pnpm --filter @localco/api lint
pnpm --filter @localco/api test --runInBand
pnpm --filter @localco/api build
```

Pour une modification Prisma :

```bash
pnpm --filter @localco/api exec prisma generate
pnpm --filter @localco/api exec prisma migrate dev
```

Exemples de messages de commit :

```bash
fix(api): make order cancellation idempotent
feat(api): add Stripe reconciliation worker
test(api): cover concurrent stock consumption
refactor(api): centralize order status transitions
docs(api): add API README
```

---

## Notes importantes

L’API LocalCo manipule des données sensibles pour le métier :

* stock ;
* paiements ;
* commandes ;
* lots alimentaires ;
* dates d’expiration ;
* mouvements de traçabilité.

Une modification qui paraît simple peut avoir un impact important sur l’intégrité des données.

Avant de modifier une logique de stock, commande ou paiement, vérifier :

* les transactions ;
* l’idempotence ;
* les tests de concurrence ;
* les effets sur les lots ;
* les effets sur les webhooks Stripe ;
* les mouvements générés ;
* les transitions de statut autorisées.

---
