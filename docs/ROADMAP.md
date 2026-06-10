# Roadmap Localco

## 1. Vision produit

Localco est une boutique Click & Collect pour produits alimentaires locaux, adossée à un back-office interne de gestion commerciale et opérationnelle.

Le produit doit servir trois usages complémentaires :

- Client final : consulter le catalogue public, composer un panier, choisir un point et une date de retrait, payer en ligne, recevoir une confirmation.
- Gérant : piloter les articles, les stocks, les commandes, la caisse, les statuts et les paramètres critiques.
- Vendeur, production, stock, comptable : gérer les ventes, préparer les commandes, suivre les mouvements de stock, consulter les informations utiles sans accéder aux données hors périmètre.

Objectif business : vendre simplement des produits alimentaires locaux en ligne, réduire les frictions de prise de commande, accepter les précommandes quand la demande dépasse le stock disponible, et donner à l'équipe interne un outil fiable pour préparer, produire, suivre et clôturer l'activité.

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
- Réservation, mouvement et libération de stock lors du checkout et des expirations.
- Montants financiers stockés en centimes côté Prisma/API et taux de TVA stockés en basis points.
- Envoi d'e-mail de confirmation via Resend après paiement confirmé.
- CI GitHub Actions séparée pour API, web et shop.

### Partiellement en place

- Gestion des commandes : création, checkout, suivi de statut, détails et filtres simples existent ; le dashboard interne doit maintenant être éprouvé en usage quotidien.
- Stock : les mouvements, lots et ajustements existent. Le stock peut être négatif volontairement.
- Précommande : un stock négatif représente une demande client supérieure au stock disponible et doit être traité comme une production à prévoir.
- Back-office : les besoins de production liés aux stocks négatifs doivent être affichés clairement au lieu d'être bloqués.
- Auth : Better Auth est la cible active, avec une dette historique d'ancien fournisseur à terminer de nettoyer dans le modèle utilisateur et les migrations.
- Tests API : les tests existent sur plusieurs flux critiques, mais les cas de précommande, stock négatif volontaire et webhooks doivent être durcis.
- Pages légales : les pages existent, mais leur contenu doit être audité avant production.
- Variables d'environnement : les exemples existent, mais ils doivent rester synchronisés avec Better Auth, Stripe, Resend, CORS et les URLs de production.
- CI : lint, tests API et builds sont couverts, mais il manque un filet E2E navigateur pour le parcours boutique complet.

### Risqué / à sécuriser

- Le rate limiting checkout est en mémoire ; il est isolé dans un module remplaçable, mais il n'est pas adapté comme unique protection à plusieurs instances ou à une production distribuée.
- Les logs, métriques et alertes ne sont pas encore structurés pour la production.
- La procédure de déploiement, rollback, sauvegarde et restauration PostgreSQL doit être écrite.
- Les webhooks Stripe doivent être validés contre un environnement réel ou Stripe CLI avant mise en ligne.
- Les droits Better Auth doivent être testés sur les pages internes sensibles autant que sur les routes API.
- Les pages légales doivent être revues avant trafic public réel.

## 3. Priorités produit

### P0 — bloquant production

- Assumer les commandes dépassant le stock disponible comme précommandes et les afficher comme besoins de production.
- Clarifier dans le back-office les articles en déficit afin de piloter la production à prévoir.
- Couvrir les webhooks Stripe `completed`, `expired`, doublons et signatures invalides.
- Choisir la stratégie production du rate limit checkout : ingress/API gateway/WAF ou store partagé si l'infrastructure retenue le fournit.
- Finaliser la configuration d'environnement production : API, web, shop, Stripe, Resend, CORS, Better Auth.
- Écrire un runbook de déploiement, rollback, sauvegarde et restauration.
- Vérifier les pages légales avant ouverture publique.

### P1 — nécessaire MVP propre

- Eprouver et ajuster le dashboard interne des commandes avec les filtres de statut, retrait, client, production requise et urgence.
- Stabiliser le CRUD articles utilisé par le catalogue public.
- Maintenir l'audit des rôles Better Auth côté API et web dans `docs/AUTH_ROLES.md`.
- Ajouter un test E2E du parcours boutique : catalogue, panier, checkout, redirection Stripe simulée.
- Fiabiliser les messages d'erreur checkout côté shop sans présenter le stock négatif comme une erreur.
- Documenter les opérations courantes : précommande, annulation, commande abandonnée, paiement à vérifier.

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
- Supprimer ou migrer toute dette historique d'ancien fournisseur si elle est encore présente dans le schéma ou le code.
- Documenter la règle métier : le stock négatif est volontaire, correspond à une précommande et sert à piloter la production à prévoir.
- Aligner les tests API sur le comportement attendu : possibilité de précommande, c'est-à-dire possibilité d'avoir une valeur négative en stock.
- Couvrir les webhooks Stripe critiques et les doublons.
- Vérifier que la CI reste fiable sur API, web et shop.
- Identifier les commandes de développement réellement supportées.

Priorité : P0.

Critère de validation :

- Un développeur peut installer, configurer, lancer et vérifier le projet avec la documentation.
- `pnpm check` est vert.
- Un checkout avec une demande supérieure au stock disponible est accepté comme une précommande avant création de session Stripe.
- Le dashboard production/back-office affiche les quantités à produire liées aux stocks négatifs.
- Les anciens choix d'auth ne créent plus d'ambiguïté produit ou technique.

Risque si ignoré :

- Le projet peut fonctionner en démo mais casser en production, masquer les besoins de production ou laisser une dette d'auth dangereuse.

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
- Donner au back-office une vue claire des précommandes et des besoins de production générés par les stocks négatifs.

Priorité : P0/P1.

Critère de validation :

- Un client peut partir d'un catalogue public, payer une commande, recevoir une confirmation, et l'équipe peut retrouver puis traiter la commande.
- Une commande dépassant le stock disponible reste traitable et visible comme besoin de production.

Risque si ignoré :

- Le paiement peut être techniquement présent sans parcours exploitable par un client ou par l'équipe de préparation.

### Phase 3 — Pré-production

Objectif : sécuriser avant mise en ligne.

Tâches :

- Ajouter des tests E2E Playwright sur le parcours shop, y compris un scénario de précommande.
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
- Préparer une procédure support commande : paiement réussi non visible, commande annulée, précommande à produire, stock incohérent, e-mail non envoyé.

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
- Améliorer les alertes de stock, de précommande et de préparation.

Priorité : P2/P3.

Critère de validation :

- Les améliorations répondent à des problèmes observés après lancement, pas à des hypothèses théoriques.

Risque si ignoré :

- Le produit restera utilisable pour le MVP, mais demandera plus d'opérations manuelles à moyen terme.

## 5. Tickets recommandés

| Titre | Type | Priorité | Estimation | Branch name | Commit recommandé |
| --- | --- | --- | --- | --- | --- |
| Cover Stripe webhook events | Test / API | P0 | M | `test/cover-stripe-webhooks` | `test: cover stripe webhook events` |
| Align roadmap with preorder stock behavior | Docs | P0 | XS | `docs/align-roadmap-preorder-stock` | `docs: align roadmap with preorder stock behavior` |
| Improve production needs dashboard | Feature / Web | P0 | M | `feat/production-needs-dashboard` | `feat: improve production needs dashboard` |
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
- Aucun ticket ne doit demander de corriger le stock négatif comme un bug. Les tickets stock doivent traiter l'affichage des précommandes, les besoins de production et la cohérence des mouvements.
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

1. Rejouer et compléter les tests webhook Stripe : completed, expired, duplicate, signature invalide.
2. Ajouter ou vérifier un test de checkout acceptant une demande supérieure au stock disponible comme précommande.
3. Vérifier que le back-office affiche les précommandes et besoins de production générés par les stocks négatifs.
4. Auditer les champs et migrations liés à l'ancienne dette d'authentification.
5. Vérifier les `.env.example` pour API, web et shop avant pré-production.
6. Auditer les pages légales existantes et lister les manques juridiques.
7. Améliorer les pages success/cancel pour le support client et les cas d'erreur.
8. Ajouter un test E2E shop minimal du panier au checkout.
9. Écrire le runbook production : déploiement, rollback, sauvegarde, restauration, support commande.
