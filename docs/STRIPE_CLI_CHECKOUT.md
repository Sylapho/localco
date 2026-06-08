# Tester le checkout avec Stripe CLI

Cette procédure permet de vérifier en local le parcours Stripe Checkout de LocalCo et les webhooks `checkout.session.completed` et `checkout.session.expired`.

Elle complète les tests automatisés API. Elle sert surtout à valider l'intégration réelle entre Stripe, l'API locale, la boutique et le back-office.

## Prérequis

- Avoir un compte Stripe en mode test.
- Installer et connecter Stripe CLI :

```bash
stripe login
```

- Configurer `apps/api/.env` avec une clé secrète de test :

```env
STRIPE_SECRET_KEY=sk_test_replace_me
SHOP_PUBLIC_URL=http://localhost:3001
```

Ne jamais commit `apps/api/.env`.

## Lancer LocalCo

Démarrer PostgreSQL :

```bash
pnpm db:up
```

Appliquer les migrations et charger les données de test si nécessaire :

```bash
pnpm db:migrate
pnpm db:seed
```

Démarrer l'API, la boutique et le back-office dans trois terminaux :

```bash
pnpm dev:api
pnpm dev:shop
pnpm dev:web
```

URLs locales :

- API : `http://localhost:4000/api`
- Boutique : `http://localhost:3001`
- Back-office : `http://localhost:3000`

## Lancer le forwarding des webhooks

Dans un terminal séparé, lancer Stripe CLI :

```bash
stripe listen --events checkout.session.completed,checkout.session.expired --forward-to localhost:4000/api/commandes/stripe/webhook
```

Stripe CLI affiche un secret de signature de webhook du type :

```txt
Ready! You are using Stripe API Version ...
Your webhook signing secret is whsec_...
```

Copier cette valeur dans `apps/api/.env` :

```env
STRIPE_WEBHOOK_SECRET=whsec_replace_me
```

Redémarrer `pnpm dev:api` après modification de `STRIPE_WEBHOOK_SECRET`.

## Scénario 1 : paiement confirmé

Objectif : vérifier que `checkout.session.completed` confirme une commande.

1. Ouvrir la boutique : `http://localhost:3001`.
2. Ajouter un ou plusieurs articles au panier.
3. Aller au checkout.
4. Renseigner les coordonnées et le retrait.
5. Valider le paiement.
6. Sur Stripe Checkout, utiliser la carte de test :

```txt
4242 4242 4242 4242
```

Utiliser une date d'expiration future, un CVC quelconque à 3 chiffres et un code postal valide.

### Résultat attendu côté back-office

- La commande apparaît dans le back-office.
- Le statut passe de `paiement_en_attente` à `nouvelle`.
- L'historique contient un passage avec le motif `paiement_confirme`.
- Le stock n'est pas décrémenté une seconde fois au moment du webhook : il a déjà été réservé lors de la création du checkout.
- Si Resend est configuré, l'e-mail de confirmation peut être envoyé après confirmation du paiement.

### Résultat attendu côté logs

Dans le terminal Stripe CLI :

```txt
checkout.session.completed [evt_...]
POST http://localhost:4000/api/commandes/stripe/webhook [2xx]
```

Côté API, il ne doit pas y avoir d'erreur NestJS. Une réponse `2xx` indique que le webhook a été accepté.

## Scénario 2 : session expirée

Objectif : vérifier que `checkout.session.expired` annule une commande en attente et libère la réservation de stock.

1. Ouvrir la boutique : `http://localhost:3001`.
2. Ajouter un ou plusieurs articles au panier.
3. Aller au checkout.
4. Valider le formulaire pour être redirigé vers Stripe Checkout.
5. Ne pas payer.
6. Récupérer la session Checkout ouverte :

```bash
stripe checkout sessions list --limit=5 --status=open
```

Identifier la session `cs_test_...` correspondant au dernier checkout. Vérifier si besoin `customer_email`, `client_reference_id` ou `metadata.commandeId`.

7. Expirer la session :

```bash
stripe checkout sessions expire cs_test_replace_me
```

### Résultat attendu côté back-office

- La commande liée n'apparaît plus dans la liste principale des commandes à traiter.
- La commande passe à `annulee`.
- L'historique contient un passage avec le motif `checkout_expire`.
- Le stock réservé est libéré via un mouvement de stock de référence `commande:<id>:reservation:release`.
- Aucun e-mail de confirmation n'est envoyé.

### Résultat attendu côté logs

Dans le terminal Stripe CLI :

```txt
checkout.session.expired [evt_...]
POST http://localhost:4000/api/commandes/stripe/webhook [2xx]
```

Côté API, il ne doit pas y avoir d'erreur NestJS. Si l'événement est rejoué, la table `StripeWebhookEvent` évite le retraitement et la réponse reste un succès.

## Vérification rapide en base

Pour confirmer l'état d'une commande depuis PostgreSQL local :

```bash
docker compose exec postgres psql -U localco -d localco_db
```

Exemples de requêtes utiles :

```sql
SELECT id, statut, "stripeId", "totalTtcCents", "createdAt"
FROM "Commande"
ORDER BY id DESC
LIMIT 5;

SELECT "commandeId", "ancienStatut", "nouveauStatut", motif, "createdAt"
FROM "CommandeStatutHistorique"
ORDER BY id DESC
LIMIT 10;

SELECT reference, type, quantite, "stockAvant", "stockApres", motif
FROM "MouvementStock"
WHERE reference LIKE 'commande:%'
ORDER BY id DESC
LIMIT 10;
```

## Commandes de validation automatisée

Les tests API couvrent les événements critiques : paiement confirmé, session expirée, doublon, signature invalide et session inconnue.

```bash
pnpm test:api --runInBand
```

## Références Stripe

- Stripe CLI : https://docs.stripe.com/stripe-cli
- Forwarding de webhooks : https://docs.stripe.com/webhooks
- Expiration d'une Checkout Session : https://docs.stripe.com/api/checkout/sessions/expire?lang=cli
