# Audit des roles Better Auth

## Objectif

Better Auth gere les sessions internes de LocalCo. L'API NestJS verifie ces
sessions avec `BetterAuthGuard`, puis applique les permissions avec
`RolesGuard` et le decorateur `@Roles(...)`.

La boutique publique `apps/shop` reste publique. Le back-office `apps/web` est
protege par un proxy Next.js qui redirige vers `/sign-in` lorsqu'aucune session
n'est presente.

## Roles existants

| Role | Usage attendu |
| --- | --- |
| `gerant` | Administration complete, utilisateurs, catalogue, production, caisse, stock. |
| `vendeur` | Ventes, commandes client, consultation du catalogue utile a la vente. |
| `production` | Preparation, production, nomenclatures, commandes a preparer. |
| `stock` | Matieres premieres, mouvements, lots, ajustements et receptions. |
| `comptable` | Consultation ventes, caisse, commandes et mouvements utiles au suivi. |

Le role par defaut Better Auth est `vendeur`.

## Separation User / AuthUser

Le schema Prisma contient deux notions differentes :

| Modele | Table | Usage |
| --- | --- | --- |
| `User` | `"User"` | Utilisateur metier historique lie aux ventes (`Vente.userId`). |
| `AuthUser` | `"user"` | Utilisateur Better Auth pour les sessions, mots de passe et roles. |

Ces deux modeles ne doivent pas etre melanges. Les autorisations et les sessions
doivent utiliser `AuthUser` / Better Auth. Le modele `User` reste lie au domaine
metier des ventes tant qu'il n'est pas migre explicitement.

## Routes publiques API

| Route | Statut | Note |
| --- | --- | --- |
| `GET /api` | Publique | Health/info simple de l'API. |
| `GET /api/boutique/articles` | Publique | Catalogue public de la boutique. |
| `GET /api/commandes/pickup-points` | Publique | Points de retrait affiches au checkout. |
| `POST /api/commandes/checkout` | Publique avec rate limit | Cree une commande en attente et une session Stripe. |
| `POST /api/commandes/stripe/webhook` | Publique signee | Endpoint appele par Stripe, signature verifiee dans le service. |
| `GET /api/commandes/checkout-session/:sessionId` | Publique | Recapitulatif client apres retour Stripe. |
| `POST /api/commandes` | Publique actuellement | Risque a confirmer : creation directe de commande hors checkout Stripe. |

## Matrice des routes protegees API

| Domaine | Routes | Roles autorises |
| --- | --- | --- |
| Articles | `GET /api/articles`, `GET /api/articles/:id` | `gerant`, `vendeur`, `production`, `stock` |
| Articles | `GET /api/articles/:id/capacity` | `gerant`, `production`, `stock` |
| Articles | `POST /api/articles/:id/produce` | `gerant`, `production` |
| Articles | `POST /api/articles`, `PATCH /api/articles/:id`, `DELETE /api/articles/:id` | `gerant` |
| Matieres premieres | `GET /api/matieres-premieres`, `GET /api/matieres-premieres/:id` | `gerant`, `production`, `stock` |
| Matieres premieres | `POST /api/matieres-premieres`, `PATCH /api/matieres-premieres/:id`, `DELETE /api/matieres-premieres/:id` | `gerant`, `stock` |
| Nomenclatures | `GET /api/articles/:articleId/nomenclature` | `gerant`, `production`, `stock` |
| Nomenclatures | `POST/PATCH/DELETE /api/articles/:articleId/nomenclature...` | `gerant`, `production` |
| Commandes | `GET /api/commandes`, `GET /api/commandes/:id` | `gerant`, `vendeur`, `production`, `comptable` |
| Commandes | `PATCH /api/commandes/:id/statut` | `gerant`, `vendeur`, `production` |
| Commandes | `POST /api/commandes/cleanup-abandoned` | `gerant` |
| Ventes | `GET /api/ventes`, `GET /api/ventes/:id` | `gerant`, `vendeur`, `comptable` |
| Ventes | `POST /api/ventes` | `gerant`, `vendeur` |
| Caisse | `GET /api/caisse/today` | `gerant`, `vendeur`, `comptable` |
| Caisse | `GET /api/caisse/journees`, `POST /api/caisse/cloturer` | `gerant`, `comptable` |
| Stock | `GET /api/mouvements-stock`, `GET /api/mouvements-stock/lots` | `gerant`, `stock`, `production`, `comptable` |
| Stock | `POST /api/mouvements-stock/ajustement`, `POST /api/mouvements-stock/matieres-premieres/:id/reception`, `POST /api/mouvements-stock/lots/:id/perte` | `gerant`, `stock` |

## Pages web sensibles

Le proxy `apps/web/src/proxy.ts` rend le back-office interdit sans session, sauf
routes publiques (`/`, `/api/auth`, `/boutique`, `/sign-in`).

| Page | Protection actuelle |
| --- | --- |
| `/admin/users` | Session requise + verification serveur `gerant`. |
| `/articles`, `/articles/*` | Session requise par proxy, permissions API selon route appelee. |
| `/commandes`, `/commandes/*` | Session requise par proxy, permissions API commandes. |
| `/caisse`, `/caisse/journees` | Session requise par proxy, permissions API caisse. |
| `/ventes`, `/ventes/new` | Session requise par proxy, permissions API ventes. |
| `/stock`, `/mouvements-stock` | Session requise par proxy, permissions API stock. |
| `/matieres-premieres`, `/matieres-premieres/*` | Session requise par proxy, permissions API matieres premieres. |

## Routes shop publiques

`apps/shop` est l'interface client. Les pages catalogue, panier, checkout,
success/cancel et pages legales restent publiques. Les appels sensibles passent
par les endpoints publics controles de l'API (`boutique`, `pickup-points`,
`checkout`, `checkout-session`).

## Risques et durcissements recommandes

- `POST /api/commandes` est public alors que `POST /api/commandes/checkout`
  couvre le parcours boutique. Confirmer son usage ; sinon le proteger ou le
  supprimer dans un ticket dedie.
- Le proxy web protege la presence d'une session, mais les restrictions fines
  par role sont surtout appliquees cote API. Continuer a considerer l'API comme
  source d'autorite.
- Le menu web masque seulement `/admin/users` aux non-gerants ; ce masquage ne
  remplace pas les checks serveur.
- Verifier manuellement chaque role avec un compte dedie avant production.
