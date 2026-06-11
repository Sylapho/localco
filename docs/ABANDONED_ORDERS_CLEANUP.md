# Nettoyage des commandes abandonnees

## Objectif

Les commandes creees par Stripe Checkout passent en `paiement_en_attente` et
reservent du stock. Si le client ne finalise pas le paiement et que Stripe ne
confirme pas la session, la reservation doit etre liberee pour ne pas bloquer le
stock disponible.

Ce nettoyage est separe des lectures du back-office : consulter les commandes ne
modifie plus le stock ni les statuts.

## Delai metier

```env
ABANDONED_ORDER_DELAY_MINUTES=60
```

Cette valeur indique apres combien de minutes une commande
`paiement_en_attente` sans confirmation Stripe peut etre annulee
automatiquement. La valeur par defaut est `60`. Une valeur absente, nulle,
negative ou non numerique retombe sur ce defaut.

Le delai metier et la frequence du scheduler sont distincts. Exemple courant :

- `ABANDONED_ORDER_DELAY_MINUTES=60`
- scheduler toutes les 10 minutes

## Commandes

En developpement, avec TypeScript :

```bash
pnpm --filter @localco/api cleanup:abandoned:dev
```

Apres compilation :

```bash
pnpm --filter @localco/api build
pnpm --filter @localco/api cleanup:abandoned
```

Depuis la racine du monorepo, les aliases suivants existent aussi :

```bash
pnpm cleanup:abandoned:dev
pnpm cleanup:abandoned
```

La sortie attendue ressemble a :

```txt
Cleanup completed: 12 scanned, 9 cancelled, 3 skipped, 0 failed
```

La commande retourne un code non nul si au moins une commande echoue pendant le
traitement, ou si une erreur globale empeche le nettoyage.

## Planification recommandee

Planifier la commande compilee toutes les 5 a 15 minutes avec le scheduler de
l'hebergeur retenu :

- CronJob Kubernetes ;
- tache planifiee Render ;
- Railway Cron ;
- tache planifiee Fly.io ;
- cron systeme ;
- GitHub Actions uniquement si cela correspond a l'infrastructure.

Ne lancez pas un cron embarque dans chaque instance API sans coordination : sur
une plateforme multi-instance, cela multiplierait les executions concurrentes.

## Idempotence et concurrence

Le nettoyage est concu pour etre relance sans danger :

- il selectionne les IDs potentiellement eligibles ;
- chaque commande est traitee dans une transaction PostgreSQL separee ;
- la ligne de commande est verrouillee avec `SELECT ... FOR UPDATE` ;
- le statut et le delai sont relus apres obtention du verrou ;
- une reservation deja liberee est ignoree ;
- une commande confirmee par Stripe entre la selection et le verrou est ignoree.

Ainsi, deux schedulers ou un scheduler et l'endpoint manuel peuvent se chevaucher
sans liberer deux fois le stock.

## Endpoint manuel

Un gerant peut declencher le nettoyage depuis l'API :

```http
POST /api/commandes/cleanup-abandoned
```

Cette route reste protegee par Better Auth et le role `gerant`. Elle ne permet
pas de choisir arbitrairement une commande ou un cutoff.

## Verification

Pour verifier un run :

1. consulter les logs de la commande et les compteurs `scanned`, `cancelled`,
   `skipped`, `failed` ;
2. verifier l'historique des commandes annulees avec le motif
   `commande_abandonnee` ;
3. verifier les mouvements de stock `commande:{id}:reservation:release` ;
4. surveiller les echecs sans exposer de donnees personnelles dans les logs.
