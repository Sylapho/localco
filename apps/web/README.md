# LocalCo Web

Application frontend principale de **LocalCo**, développée avec **Next.js**, **TypeScript** et **Tailwind CSS**.

Cette application correspond à l’interface de gestion de LocalCo. Elle permet d’administrer les données métier : articles, matières premières, stocks, lots, ventes, commandes, paiements et paramètres liés à l’activité.

---

## Sommaire

* [Rôle de l’application](#rôle-de-lapplication)
* [Stack technique](#stack-technique)
* [Prérequis](#prérequis)
* [Installation](#installation)
* [Variables d’environnement](#variables-denvironnement)
* [Commandes utiles](#commandes-utiles)
* [Lancer l’application](#lancer-lapplication)
* [Build](#build)
* [Tests et vérifications](#tests-et-vérifications)
* [Architecture du dossier](#architecture-du-dossier)
* [Communication avec l’API](#communication-avec-lapi)
* [Authentification](#authentification)
* [Gestion des données métier](#gestion-des-données-métier)
* [Gestion du stock](#gestion-du-stock)
* [Paiements et commandes](#paiements-et-commandes)
* [Conventions de développement](#conventions-de-développement)
* [Accessibilité et UX](#accessibilité-et-ux)
* [Sécurité](#sécurité)
* [Dépannage](#dépannage)
* [Bonnes pratiques avant commit](#bonnes-pratiques-avant-commit)

---

## Rôle de l’application

`apps/web` est l’interface principale de gestion de LocalCo.

Elle est responsable de :

* afficher le tableau de bord de gestion ;
* gérer les articles vendables ;
* gérer les matières premières ;
* consulter et modifier les métadonnées des produits ;
* consulter les stocks ;
* suivre les lots et les dates d’expiration ;
* consulter les mouvements de stock ;
* gérer les ventes ;
* suivre les commandes ;
* consulter les statuts de paiement ;
* aider à l’exploitation quotidienne de l’application.

Cette application ne doit pas contenir la logique métier critique.

Les règles importantes doivent rester côté API :

* validation réelle du stock ;
* consommation des lots ;
* application de la méthode FEFO ;
* création des mouvements de stock ;
* transitions de commande ;
* validation des paiements ;
* réconciliation Stripe ;
* annulations idempotentes.

Le frontend doit permettre à l’utilisateur d’interagir avec ces données, mais l’API reste la source de vérité.

---

## Stack technique

L’application utilise principalement :

* **Next.js** pour le frontend ;
* **React** pour les composants ;
* **TypeScript** pour le typage ;
* **Tailwind CSS** pour le style ;
* **pnpm** comme gestionnaire de paquets ;
* **Docker** pour l’environnement local ;
* **better-auth** pour l’authentification selon la configuration du projet ;
* l’API LocalCo située dans `apps/api`.

---

## Prérequis

Depuis la racine du monorepo, il faut avoir :

* Node.js compatible avec le projet ;
* pnpm installé ;
* Docker et Docker Compose si l’environnement local utilise Docker ;
* l’API LocalCo lancée ;
* une configuration `.env.local` valide.

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

Si le projet utilise Prisma côté API, générer le client Prisma depuis la racine si nécessaire :

```bash
pnpm --filter @localco/api exec prisma generate
```

---

## Variables d’environnement

Créer un fichier `.env.local` dans `apps/web` si nécessaire.

Exemple :

```env
# App
NEXT_PUBLIC_WEB_URL=http://localhost:3000

# API
NEXT_PUBLIC_API_URL=http://localhost:3000

# Auth
NEXT_PUBLIC_AUTH_URL=http://localhost:3000
```

Les noms exacts des variables sont à vérifier dans le code de `apps/web`.

Les variables exposées au navigateur doivent commencer par :

```txt
NEXT_PUBLIC_
```

Ne jamais mettre de secret côté frontend.

À ne jamais mettre dans `apps/web/.env.local` :

```env
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
BETTER_AUTH_SECRET=xxx
JWT_SECRET=xxx
```

Ces variables doivent rester côté API ou côté serveur sécurisé.

---

## Commandes utiles

Toutes les commandes suivantes sont à lancer depuis la racine du monorepo.

### Développement

```bash
pnpm --filter @localco/web dev
```

### Build

```bash
pnpm --filter @localco/web build
```

### Lint

```bash
pnpm --filter @localco/web lint
```

### Tests

Si des tests sont configurés :

```bash
pnpm --filter @localco/web test
```

### Vérification TypeScript

Si une commande dédiée existe :

```bash
pnpm --filter @localco/web typecheck
```

Sinon, utiliser la commande disponible dans le `package.json` de `apps/web`.

---

## Lancer l’application

Depuis la racine du monorepo :

```bash
pnpm --filter @localco/web dev
```

L’application devrait être disponible sur :

```txt
http://localhost:3000
```

Selon la configuration Docker ou Next.js, le port peut être différent.

Pour lancer l’application avec Docker :

```bash
docker compose up web
```

Ou pour lancer tout l’environnement :

```bash
docker compose up
```

---

## Build

Pour vérifier que l’application compile correctement :

```bash
pnpm --filter @localco/web build
```

Cette commande permet de détecter :

* les erreurs TypeScript ;
* les erreurs de routes Next.js ;
* les erreurs de variables d’environnement manquantes ;
* les erreurs liées aux composants serveur/client ;
* les erreurs d’import ;
* les problèmes de rendu pendant le build ;
* les appels serveur exécutés trop tôt pendant la génération des pages.

---

## Tests et vérifications

Avant de pousser une modification, lancer au minimum :

```bash
pnpm --filter @localco/web lint
pnpm --filter @localco/web build
```

Si des tests sont disponibles :

```bash
pnpm --filter @localco/web test
```

Si une commande TypeScript dédiée existe :

```bash
pnpm --filter @localco/web typecheck
```

---

## Architecture du dossier

Structure indicative :

```txt
apps/web/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── dashboard/
│   ├── articles/
│   ├── matieres-premieres/
│   ├── stocks/
│   ├── lots/
│   ├── ventes/
│   ├── commandes/
│   └── ...
├── components/
│   ├── ui/
│   ├── layout/
│   ├── forms/
│   ├── tables/
│   └── ...
├── lib/
│   ├── api.ts
│   ├── utils.ts
│   └── ...
├── hooks/
├── styles/
├── public/
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

Les noms exacts peuvent varier selon l’état actuel du projet.

---

## Communication avec l’API

L’application `web` communique avec l’API LocalCo pour lire et modifier les données métier.

L’URL de l’API doit être configurée avec une variable d’environnement :

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Exemple de principe côté frontend :

```ts
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

Les appels API doivent être centralisés autant que possible.

Exemples de fichiers possibles :

```txt
lib/api.ts
lib/articles.ts
lib/commandes.ts
lib/stocks.ts
lib/matieres-premieres.ts
```

Éviter de dupliquer les appels API directement dans chaque composant.

---

## Authentification

L’authentification doit être gérée proprement entre le frontend et l’API.

L’application doit :

* afficher les pages privées uniquement aux utilisateurs autorisés ;
* rediriger les utilisateurs non connectés ;
* éviter d’exposer les données sensibles côté client ;
* gérer les erreurs d’autorisation ;
* afficher un retour clair en cas de session expirée.

Les routes sensibles doivent toujours être protégées côté API.

Le frontend peut masquer des boutons ou des pages, mais cela ne remplace jamais une vérification backend.

---

## Gestion des données métier

L’application permet de gérer plusieurs ressources importantes.

Exemples :

* articles ;
* matières premières ;
* stocks ;
* lots ;
* mouvements ;
* ventes ;
* commandes ;
* paiements ;
* utilisateurs ;
* paramètres.

Chaque écran de gestion doit idéalement prévoir :

* un état de chargement ;
* un état vide ;
* un état erreur ;
* une confirmation après action ;
* une validation des formulaires ;
* une protection contre les doubles soumissions ;
* une pagination ou recherche si la liste devient longue.

Exemples d’états utiles :

```txt
Chargement des articles...
Aucun article disponible.
Impossible de charger les données.
Modification enregistrée.
Suppression impossible.
```

---

## Gestion du stock

La gestion du stock est une zone critique de LocalCo.

L’interface peut afficher et déclencher des opérations de stock, mais elle ne doit pas modifier directement les quantités critiques sans passer par l’API.

Le frontend ne doit pas permettre une simple modification directe du champ `stock` si le backend impose des mouvements de stock.

Les modifications de stock doivent passer par des opérations métier explicites :

* réception ;
* ajustement ;
* production ;
* vente ;
* commande ;
* annulation ;
* perte ;
* correction administrative.

L’interface doit aider l’utilisateur à comprendre pourquoi le stock change.

Exemples d’informations utiles à afficher :

* quantité actuelle ;
* quantité disponible ;
* quantité réservée ;
* lots associés ;
* date d’expiration ;
* dernier mouvement ;
* origine du mouvement ;
* statut de la commande ou vente liée.

---

## Paiements et commandes

L’application peut afficher les commandes et leurs statuts.

Exemples de statuts possibles :

```txt
paiement_en_attente
paiement_a_verifier
nouvelle
preparee
terminee
annulee
```

Les noms exacts dépendent du modèle de données du projet.

L’interface doit permettre de comprendre rapidement :

* si une commande est payée ;
* si elle est en attente ;
* si elle nécessite une vérification ;
* si elle est annulée ;
* si une action manuelle est nécessaire ;
* si une réconciliation Stripe existe.

La validation réelle d’un paiement doit rester côté API, notamment via les webhooks Stripe.

Le frontend ne doit jamais confirmer seul une commande comme payée.

---

## Conventions de développement

### Composants

Les composants doivent être :

* simples ;
* typés ;
* réutilisables quand c’est pertinent ;
* séparés par responsabilité.

Exemples :

```txt
DataTable
PageHeader
FormSection
SubmitButton
ErrorMessage
EmptyState
LoadingState
ConfirmDialog
StatusBadge
```

### Formulaires

Les formulaires doivent :

* valider les champs obligatoires ;
* afficher les erreurs proches du champ concerné ;
* désactiver le bouton pendant l’envoi ;
* éviter les doubles soumissions ;
* afficher un message de succès ou d’erreur ;
* ne pas envoyer de champs interdits au backend.

Exemple de principe :

```tsx
<button disabled={isSubmitting}>
  {isSubmitting ? "Enregistrement..." : "Enregistrer"}
</button>
```

### TypeScript

Éviter `any` autant que possible.

Mauvais exemple :

```ts
function ArticleRow({ article }: any) {
  return <div>{article.nom}</div>;
}
```

Bon exemple :

```ts
type Article = {
  id: string;
  nom: string;
  prix: number;
  stock: number;
};

function ArticleRow({ article }: { article: Article }) {
  return <div>{article.nom}</div>;
}
```

### Organisation des appels API

Éviter ce type de logique directement dans plusieurs composants :

```ts
fetch(`${process.env.NEXT_PUBLIC_API_URL}/articles`);
```

Préférer une fonction centralisée :

```ts
export async function getArticles() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/articles`);

  if (!response.ok) {
    throw new Error("Unable to fetch articles");
  }

  return response.json();
}
```

---

## Accessibilité et UX

L’application doit être claire, rapide et fiable pour l’utilisateur.

Bonnes pratiques :

* utiliser des titres de page explicites ;
* afficher des boutons compréhensibles ;
* confirmer les actions destructives ;
* afficher clairement les erreurs ;
* prévoir des états de chargement ;
* prévoir des états vides ;
* éviter les doubles clics sur les actions critiques ;
* rendre les tableaux lisibles ;
* garder une navigation cohérente ;
* utiliser des labels sur les champs de formulaire ;
* ne pas afficher uniquement une couleur pour transmettre une information.

Exemple :

```txt
Bon : Commande annulée
Moins bon : Badge rouge sans texte
```

---

## Sécurité

Même si `apps/web` est une application frontend, elle doit respecter certaines règles :

* ne jamais exposer de secrets ;
* ne jamais stocker de clé privée dans le navigateur ;
* ne jamais faire confiance aux données côté client ;
* ne jamais contourner les validations de l’API ;
* ne jamais confirmer un paiement côté frontend ;
* ne pas afficher les erreurs techniques brutes à l’utilisateur ;
* protéger les pages privées ;
* gérer les sessions expirées ;
* éviter les actions destructives sans confirmation ;
* éviter d’envoyer des champs interdits à l’API.

Les variables publiques `NEXT_PUBLIC_*` sont visibles dans le navigateur.

Il ne faut donc jamais y mettre de secret.

---

## Dépannage

### L’application ne démarre pas

Vérifier l’installation des dépendances :

```bash
pnpm install
```

Puis relancer :

```bash
pnpm --filter @localco/web dev
```

### Le port est déjà utilisé

Si le port `3000` est déjà utilisé, arrêter le processus concerné ou modifier le port de lancement.

Sous Windows PowerShell :

```powershell
netstat -ano | findstr :3000
```

### L’API n’est pas joignable

Vérifier que l’API est lancée :

```bash
pnpm --filter @localco/api dev
```

Vérifier ensuite la variable :

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Erreur `DATABASE_URL is missing` pendant le build

Si le build de `apps/web` déclenche une erreur liée à `DATABASE_URL`, cela peut indiquer qu’un fichier frontend importe directement du code serveur ou Prisma.

À vérifier :

* imports directs depuis `apps/api` ;
* imports directs de Prisma ;
* logique serveur appelée pendant le build ;
* accès base de données dans un composant frontend ;
* variable `DATABASE_URL` utilisée dans `apps/web`.

Le frontend ne devrait généralement pas avoir besoin de `DATABASE_URL`.

La solution recommandée est de passer par l’API au lieu d’accéder directement à la base.

### Les données ne s’affichent pas

Vérifier :

* que l’API fonctionne ;
* que la base contient des données ;
* que les routes appelées existent ;
* que `NEXT_PUBLIC_API_URL` est correct ;
* que la console navigateur ne contient pas d’erreur ;
* que les erreurs réseau ne sont pas bloquées par CORS.

### Problème de CORS

Si le navigateur bloque les appels API, vérifier la configuration CORS côté API.

Exemple de problème :

```txt
Access to fetch at ... has been blocked by CORS policy
```

Vérifier que l’origine de `apps/web` est autorisée côté API.

Exemple :

```txt
http://localhost:3000
```

### Problème de hot reload avec Docker

Si le hot reload ne fonctionne pas correctement avec Docker :

```bash
docker compose down
docker compose up --build
```

Vérifier aussi que les volumes sont correctement configurés dans `docker-compose.yml`.

### Variables d’environnement non prises en compte

Après modification de `.env.local`, redémarrer le serveur Next.js :

```bash
pnpm --filter @localco/web dev
```

Next.js ne recharge pas toujours toutes les variables d’environnement sans redémarrage.

---

## Bonnes pratiques avant commit

Avant de commit une modification sur `apps/web`, lancer :

```bash
pnpm --filter @localco/web lint
pnpm --filter @localco/web build
```

Si des tests existent :

```bash
pnpm --filter @localco/web test
```

Si la modification touche aussi l’API :

```bash
pnpm --filter @localco/api lint
pnpm --filter @localco/api test --runInBand
pnpm --filter @localco/api build
```

---

## Exemples de messages de commit

```bash
docs(web): add web README
fix(web): handle API errors on dashboard
feat(web): add stock movement history
feat(web): add order status badges
refactor(web): centralize API calls
style(web): improve dashboard layout
```

---

## Notes importantes

`apps/web` est l’interface de gestion principale de LocalCo.

Elle doit aider l’utilisateur à comprendre et piloter l’activité, sans dupliquer la logique critique de l’API.

Le frontend affiche, guide et déclenche les actions.
L’API valide, protège, persiste et garantit l’intégrité des données.

Avant de modifier un écran lié au stock, aux commandes ou aux paiements, vérifier :

* les champs envoyés à l’API ;
* les droits nécessaires ;
* les erreurs affichées ;
* les états de chargement ;
* les impacts sur les données métier ;
* les actions concurrentes possibles ;
* les retours utilisateur en cas d’échec.
