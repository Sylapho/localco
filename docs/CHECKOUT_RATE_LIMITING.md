# Rate limit checkout

## Objectif

Le checkout est l'endpoint public le plus sensible de la boutique, car il cree
une commande en attente et prepare une session Stripe Checkout.

LocalCo applique donc un rate limit sur :

```txt
POST /api/commandes/checkout
```

## Configuration

Les variables suivantes restent configurables cote API :

| Variable | Defaut | Description |
| --- | --- | --- |
| `CHECKOUT_RATE_LIMIT_WINDOW_MS` | `60000` | Fenetre de comptage en millisecondes. |
| `CHECKOUT_RATE_LIMIT_MAX` | `10` | Nombre maximal de tentatives par IP dans la fenetre. |

En local, ces valeurs peuvent rester dans `apps/api/.env` ou dans le `.env`
racine utilise par Docker Compose.

## Comportement local

L'implementation actuelle utilise un store en memoire, par processus Node.js.
Elle est suffisante pour le developpement local et pour une instance API unique.

Quand la limite est atteinte, l'API repond :

```json
{
  "statusCode": 429,
  "message": "Trop de tentatives de paiement, veuillez reessayer bientot",
  "error": "Too Many Requests"
}
```

Le shop intercepte le statut HTTP `429` et affiche un message utilisateur propre
au lieu d'exposer le detail technique.

## Limite du stockage memoire

Le store memoire n'est pas fiable en production distribuee :

- chaque instance API a son propre compteur ;
- un redemarrage de processus remet les compteurs a zero ;
- une charge repartie entre plusieurs instances peut contourner la limite ;
- l'IP client peut dependre de la configuration proxy/ingress.

Cette limite est acceptable en local, mais pas comme unique protection pour une
production multi-instance.

## Strategie production attendue

Sans decision d'hebergement, LocalCo ne doit pas ajouter Redis ou un service
externe uniquement pour ce ticket.

La strategie recommandee est :

1. garder le middleware local pour le developpement et les environnements simples ;
2. appliquer en production un rate limit partage au niveau ingress, reverse proxy,
   WAF, API gateway ou plateforme d'hebergement ;
3. si l'infra retenue fournit deja un stockage partage, remplacer
   `InMemoryCheckoutRateLimitStore` par un store distribue implementant
   `CheckoutRateLimitStore`.

Decision restante avant production : choisir l'endroit ou la limite partagee est
appliquee selon l'hebergement final de l'API.
