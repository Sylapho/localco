# Roadmap Localco

## 1. Vision produit

Localco est une boutique Click & Collect pour produits alimentaires locaux, adossée à un back-office interne de gestion commerciale et opérationnelle.

Le produit doit servir trois usages complémentaires :

- Client final : consulter le catalogue public, composer un panier, choisir un point et une date de retrait, payer en ligne, recevoir une confirmation.
- Gérant : piloter les articles, les stocks, les commandes, la caisse, les statuts et les paramètres critiques.
- Vendeur, production, stock, comptable : gérer les ventes, préparer les commandes, suivre les mouvements de stock, consulter les informations utiles sans accéder aux données hors périmètre.

Objectif business : vendre simplement des produits alimentaires locaux en ligne, réduire les frictions de prise de commande, sécuriser le stock disponible, et donner à l'équipe interne un outil fiable pour préparer, suivre et clôturer l'activité.

## 2. État actuel

### Déjà en place

- Monorepo pnpm avec `apps/api`, `apps/web` et `apps/shop`.
- API NestJS dans `apps/api`.
- Modules API métier présents : articles, matières premières, nomenclatures, ventes, caisse, mouvements de stock, commandes, boutique, auth, emails.
- Prisma et PostgreSQL côté API.
- Docker Compose pour la base locale.
- Application interne Next.js dans `apps/web`.
- Boutique publique Next.js dans `apps/shop`.
- Catalogue public alimenté par l'API boutique.
- Panier côté boutique avec stockage local.
- Page checkout côté boutique.
- Pages success et cancel Stripe côté boutique.
- Pages légales présentes côté boutique : CGV, confidentialité, mentions légales, cookies, Click & Collect.
- Better Auth utilisé pour les sessions et les rôles internes.
- Routes internes API protégées par `BetterAuthGuard` et `RolesGuard` sur plusieurs modules.
- Stripe Checkout pour créer une session de paiement.
- Webhook Stripe `POST /api/commandes/stripe/webhook`.
- Gestion des événements `checkout.session.completed` et `checkout.session.expired`.
- Historique des statuts de commande via `CommandeStatutHistorique`.
- Déduplication des webhooks Stripe via `StripeWebhookEvent`.
- Réservation et libération de stock lors du checkout et des expirations.
- Envoi d'e-mail de confirmation via Resend après paiement confirmé.
- CI GitHub Actions séparée pour API, web et shop.

### Partiellement en place

- Gestion des commandes : création, checkout, suivi de statut et détails existent, mais le dashboard interne doit être renforcé pour un usage quotidien.
- Stock : les mouvements, lots et ajustements existent, mais le stock disponible doit être verrouillé avant checkout pour éviter les stocks négatifs.
- Auth : Better Auth est la cible active, mais le modèle Prisma `User` contient encore un champ historique `clerkId` à traiter proprement.
- Tests API : les tests existent sur plusieurs flux critiques, mais les cas stock avant checkout et webhooks doivent être durcis.
- Pages légales : les pages existent, mais leur contenu doit être audité avant production.
- Variables d'environnement : les exemples existent, mais ils doivent rester synchronisés avec Better Auth, Stripe, Resend, CORS et les URLs de production.
- CI : lint, tests API et builds sont couverts, mais il manque un filet E2E navigateur pour le parcours boutique complet.

### Risqué / à sécuriser

- Le checkout peut réserver du stock sans refuser explicitement une quantité supérieure au stock disponible.
- Le rate limiting checkout est en mémoire ; il n'est pas adapté à plusieurs instances ou à une production distribuée.
- Les montants sont encore manipulés en `Float` côté Prisma, ce qui reste fragile pour une logique financière avancée.
- Les logs, métriques et alertes ne sont pas encore structurés pour la production.
- La procédure de déploiement, rollback, sauvegarde et restauration PostgreSQL doit être écrite.
- Les webhooks Stripe doivent être validés contre un environnement réel ou Stripe CLI avant mise en ligne.
- Les droits Better Auth doivent être testés sur les pages internes sensibles autant que sur les routes API.
- Les pages légales doivent être revues avant trafic public réel.

## 3. Priorités produit

### P0 — bloquant production

- Refuser tout checkout si le stock demandé dépasse le stock vendable.
- Couvrir les webhooks Stripe `completed`, `expired`, doublons et signatures invalides.
- Remplacer ou externaliser le rate limit checkout en mémoire pour la production.
- Finaliser la configuration d'environnement production : API, web, shop, Stripe, Resend, CORS, Better Auth.
- Écrire un runbook de déploiement, rollback, sauvegarde et restauration.
- Vérifier les pages légales avant ouverture publique.

### P1 — nécessaire MVP propre

- Améliorer le dashboard interne des commandes.
- Stabiliser le CRUD articles utilisé par le catalogue public.
- Auditer les rôles Better Auth côté API et web.
- Ajouter un test E2E du parcours boutique : catalogue, panier, checkout, redirection Stripe simulée.
- Fiabiliser les messages d'erreur checkout côté shop.
- Documenter les opérations courantes : annulation, commande abandonnée, paiement à vérifier.

### P2 — amélioration post-MVP

- Ajouter des exports comptables simples.
- Ajouter des statistiques de ventes et de commandes.
- Rendre les créneaux de retrait configurables depuis le back-office.
- Ajouter l'upload d'images produits.
- Améliorer le monitoring et les alertes métier.

### P3 — plus tard

- Comptes clients.
- Codes promo.
- Notifications SMS.
- Programme fidélité.
- Fonctionnalités multi-boutiques ou multi-tenant.
- Application mobile.

## 4. Roadmap par phases

### Phase 1 — Stabilisation technique

Objectif : rendre le projet fiable, installable et cohérent.

Tâches :

- Garder le README et les docs à jour avec `apps/api`, `apps/web` et `apps/shop`.
- Vérifier et compléter les `.env.example` de chaque application.
- Clarifier Better Auth comme solution active d'authentification.
- Supprimer ou migrer la dette historique Clerk si elle est encore présente dans le schéma ou le code.
- Ajouter une validation stricte du stock disponible avant checkout.
- Aligner les tests API sur le comportement attendu : aucun stock négatif au checkout.
- Couvrir les webhooks Stripe critiques et les doublons.
- Vérifier que la CI reste fiable sur API, web et shop.
- Identifier les commandes de développement réellement supportées.

Priorité : P0.

Critère de validation :

- Un développeur peut installer, configurer, lancer et vérifier le projet avec la documentation.
- `pnpm check` est vert.
- Un checkout avec stock insuffisant est refusé avant création de session Stripe.
- Les anciens choix d'auth ne créent plus d'ambiguïté produit ou technique.

Risque si ignoré :

- Le projet peut fonctionner en démo mais casser en production, créer des commandes impossibles à honorer ou laisser une dette d'auth dangereuse.

### Phase 2 — MVP Click & Collect

Objectif : permettre à un client de commander et payer.

Tâches :

- Consolider le catalogue public de `apps/shop`.
- Stabiliser le panier et sa synchronisation avec les articles encore vendables.
- Finaliser le checkout : coordonnées, point de retrait, date de retrait, validation côté API.
- Stabiliser Stripe Checkout et ses URLs success/cancel.
- Fiabiliser le webhook Stripe pour confirmer ou expirer une commande.
- Envoyer l'e-mail de confirmation après paiement confirmé.
- Améliorer les pages success et cancel.
- Donner au back-office une gestion minimale des commandes.
- Donner au back-office un CRUD articles minimal et sûr pour la boutique.

Priorité : P0/P1.

Critère de validation :

- Un client peut partir d'un catalogue public, payer une commande, recevoir une confirmation, et l'équipe peut retrouver puis traiter la commande.

Risque si ignoré :

- Le paiement peut être techniquement présent sans parcours exploitable par un client ou par l'équipe de préparation.

### Phase 3 — Pré-production

Objectif : sécuriser avant mise en ligne.

Tâches :

- Ajouter des tests E2E Playwright sur le parcours shop.
- Auditer et compléter CGV, confidentialité, mentions légales, cookies et Click & Collect.
- Ajouter des logs structurés côté API.
- Configurer précisément le CORS production.
- Documenter les sauvegardes PostgreSQL.
- Documenter la restauration PostgreSQL.
- Écrire un runbook de déploiement.
- Ajouter un monitoring minimal : disponibilité API, erreurs checkout, webhooks Stripe, e-mails.
- Vérifier les variables Stripe test et production.

Priorité : P0/P1.

Critère de validation :

- Le projet peut être déployé sur un environnement pré-production, testé de bout en bout, observé et restauré en cas d'incident.

Risque si ignoré :

- La mise en ligne dépendra d'interventions manuelles non documentées et les incidents seront difficiles à diagnostiquer.

### Phase 4 — Production

Objectif : mettre en ligne proprement.

Tâches :

- Déployer l'API.
- Déployer la boutique `apps/shop`.
- Déployer l'application interne `apps/web` si elle est nécessaire au run opérationnel.
- Configurer les variables Stripe production.
- Configurer Resend production.
- Configurer domaine et HTTPS.
- Vérifier les webhooks Stripe sur l'URL publique.
- Préparer une procédure de rollback.
- Préparer une procédure support commande : paiement réussi non visible, commande annulée, stock incohérent, e-mail non envoyé.

Priorité : P0.

Critère de validation :

- Une commande réelle peut être passée, payée, confirmée, retrouvée dans le back-office et préparée par l'équipe.

Risque si ignoré :

- Les premières commandes réelles peuvent devenir difficiles à traiter ou à rembourser proprement.

### Phase 5 — Post-lancement

Objectif : améliorer après les premiers retours.

Tâches :

- Ajouter des comptes clients si le besoin est confirmé.
- Ajouter des codes promo.
- Ajouter des exports comptables.
- Ajouter des statistiques de ventes, commandes et produits.
- Rendre les créneaux de retrait configurables.
- Ajouter l'upload d'images.
- Ajouter des notifications SMS.
- Améliorer les alertes stock et préparation.

Priorité : P2/P3.

Critère de validation :

- Les améliorations répondent à des problèmes observés après lancement, pas à des hypothèses théoriques.

Risque si ignoré :

- Le produit restera utilisable pour le MVP, mais demandera plus d'opérations manuelles à moyen terme.

## 5. Tickets recommandés

| Titre | Type | Priorité | Estimation | Branch name | Commit recommandé |
| --- | --- | --- | --- | --- | --- |
| Validate stock before checkout | Bug / API | P0 | M | `fix/validate-stock-before-checkout` | `fix: validate stock before checkout` |
| Cover Stripe webhook events | Test / API | P0 | M | `test/cover-stripe-webhooks` | `test: cover stripe webhook events` |
| Complete legal pages | Legal / Shop | P0 | S | `docs/complete-legal-pages` | `docs: complete legal pages` |
| Add legal notice page | Legal / Shop | P1 | S | `docs/add-legal-notice-page` | `docs: add legal notice page` |
| Improve payment success page | UX / Shop | P1 | S | `feat/improve-payment-success-page` | `feat: improve payment success page` |
| Improve payment cancel page | UX / Shop | P1 | S | `feat/improve-payment-cancel-page` | `feat: improve payment cancel page` |
| Add admin article management | Feature / Web | P1 | M | `feat/admin-article-management` | `feat: add admin article management` |
| Add admin orders dashboard | Feature / Web | P1 | M | `feat/admin-orders-dashboard` | `feat: add admin orders dashboard` |
| Add shop checkout E2E flow | Test / Shop | P1 | L | `test/shop-checkout-e2e-flow` | `test: add shop checkout e2e flow` |
| Add production deployment runbook | Docs / Ops | P0 | M | `docs/production-deployment-runbook` | `docs: add production deployment runbook` |
| Add PostgreSQL backup and restore documentation | Docs / Ops | P0 | M | `docs/postgresql-backup-restore` | `docs: add postgresql backup and restore documentation` |
| Replace in-memory checkout rate limit for production | Tech debt / API | P0 | M | `fix/production-checkout-rate-limit` | `fix: replace in-memory checkout rate limit` |

Notes :

- La page `apps/shop/src/app/mentions-legales/page.tsx` existe déjà. Le ticket `Add legal notice page` doit être traité comme un audit de complétude ou renommé si la page couvre déjà toutes les obligations.
- Les estimations sont volontairement grossières : S = moins d'une demi-journée, M = une à deux journées, L = plusieurs journées.

## 6. Ce qu'il ne faut pas faire maintenant

À éviter avant le MVP :

- Multi-tenant.
- Application mobile.
- Livraison.
- Marketplace.
- Programme fidélité.
- Refonte totale UI.
- Analytics avancées.
- Codes promo.
- Comptes clients.
- Moteur complexe de promotions.
- Internationalisation.
- Système avancé de rôles configurables.
- Refactor complet de l'architecture monorepo.

## 7. Prochaines actions concrètes

1. Corriger la validation de stock avant `POST /api/commandes/checkout`.
2. Modifier les tests existants qui acceptent aujourd'hui un stock négatif au checkout.
3. Ajouter les tests API de refus de checkout avec stock insuffisant.
4. Rejouer et compléter les tests webhook Stripe : completed, expired, duplicate, signature invalide.
5. Auditer les champs et migrations liés à l'ancienne dette Clerk.
6. Vérifier les `.env.example` pour API, web et shop avant pré-production.
7. Auditer les pages légales existantes et lister les manques juridiques.
8. Améliorer les pages success/cancel pour le support client et les cas d'erreur.
9. Ajouter un test E2E shop minimal du panier au checkout.
10. Écrire le runbook production : déploiement, rollback, sauvegarde, restauration, support commande.
