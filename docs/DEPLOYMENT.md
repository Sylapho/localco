# Déploiement LocalCo

Aucune cible de déploiement réelle n'est configurée dans le dépôt à ce stade. Il n'existe pas de configuration Vercel, Railway, Render, Fly.io, Kubernetes, Terraform, serveur SSH ou cloud provider vérifiable.

La CI prépare donc la livraison jusqu'à la construction et, sur `main`, la publication optionnelle des images de production dans GitHub Container Registry.

Avant de déployer, vérifier que la démonstration locale fonctionne avec le scénario de [`docs/DEMO.md`](DEMO.md). Après déploiement, contrôler les health checks, la boutique, le back-office et un scénario de commande complet avec des clés Stripe de test.

## Images produites

Sur un push réussi vers `main`, le workflow publie :

```txt
ghcr.io/<owner>/localco-api:<sha>
ghcr.io/<owner>/localco-web:<sha>
ghcr.io/<owner>/localco-shop:<sha>
```

Le tag `main` peut aussi être publié, mais il ne doit jamais être utilisé seul pour un déploiement reproductible. Un déploiement de production doit référencer les images par digest.

## Ports

| Image | Port | Commande |
| --- | --- | --- |
| `localco-api` | `4000` | `node dist/src/main.js` |
| `localco-web` | `3000` | `node server.js` |
| `localco-shop` | `3001` | `node server.js` |

## Variables d'environnement

### API

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
BETTER_AUTH_SECRET=<secret long et aléatoire>
BETTER_AUTH_URL=https://api.example.com
FRONTEND_URL=https://admin.example.com
SHOP_PUBLIC_URL=https://shop.example.com
API_CORS_ORIGINS=https://admin.example.com,https://shop.example.com
CHECKOUT_RATE_LIMIT_WINDOW_MS=60000
CHECKOUT_RATE_LIMIT_MAX=10
ABANDONED_ORDER_DELAY_MINUTES=60
STRIPE_SECRET_KEY=<secret Stripe réel>
STRIPE_WEBHOOK_SECRET=<secret webhook Stripe réel>
STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS=300000
STRIPE_RECONCILIATION_WORKER_ENABLED=true
STRIPE_RECONCILIATION_WORKER_INTERVAL_MS=60000
STRIPE_RECONCILIATION_BATCH_SIZE=10
STRIPE_RECONCILIATION_MAX_ATTEMPTS=5
STRIPE_RECONCILIATION_BACKOFF_BASE_MS=60000
STRIPE_RECONCILIATION_BACKOFF_MAX_MS=3600000
STRIPE_RECONCILIATION_LEASE_MS=300000
RESEND_API_KEY=<clé Resend réelle>
RESEND_FROM_EMAIL=<adresse validée>
```

### Web

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
BETTER_AUTH_SECRET=<secret long et aléatoire>
BETTER_AUTH_URL=https://api.example.com
NEXT_PUBLIC_API_URL=https://api.example.com/api
API_INTERNAL_URL=http://localco-api:4000/api
NEXT_PUBLIC_AUTH_URL=https://api.example.com
GITHUB_CLIENT_ID=<optionnel>
GITHUB_CLIENT_SECRET=<optionnel>
GOOGLE_CLIENT_ID=<optionnel>
GOOGLE_CLIENT_SECRET=<optionnel>
```

### Shop

```env
NODE_ENV=production
PORT=3001
NEXT_PUBLIC_API_URL=https://api.example.com/api
API_INTERNAL_URL=http://localco-api:4000/api
```

## Base de données et migrations

PostgreSQL 16 est la version cible pour la CI et Docker Compose.

Avant de migrer un volume PostgreSQL 15 existant vers PostgreSQL 16, faites une sauvegarde vérifiée. Ne supprimez pas les volumes pour réaliser cette migration.

Les migrations Prisma doivent être appliquées par une tâche de release unique :

```bash
pnpm db:deploy
```

Ne lancez pas automatiquement les migrations dans chaque réplique applicative, afin d'éviter des migrations concurrentes.

## Health checks attendus

### API

L'API expose deux endpoints de santé complémentaires :

- `GET /api/health` : vérifie uniquement que l'API répond. Ce check reste léger et ne dépend pas de PostgreSQL, Stripe ou Resend.
- `GET /api/health/ready` : vérifie que l'instance est prête à recevoir du trafic. Ce check valide la disponibilité PostgreSQL via Prisma et indique si Stripe et Resend sont configurés.

Vérification locale :

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/health/ready
```

Vérification après déploiement :

```bash
curl https://api.example.com/api/health
curl https://api.example.com/api/health/ready
```

`/api/health/ready` renvoie `200` quand l'instance est prête et `503` quand elle ne doit pas encore être considérée comme disponible. La réponse expose uniquement des statuts et booléens de configuration ; les secrets et valeurs des variables d'environnement ne sont jamais affichés.

Exemple de réponse prête :

```json
{
  "status": "ready",
  "service": "localco-api",
  "timestamp": "2026-06-19T00:00:00.000Z",
  "checks": {
    "database": {
      "status": "up"
    },
    "stripe": {
      "configured": true
    },
    "resend": {
      "configured": true
    }
  }
}
```

Exemple de réponse non prête :

```json
{
  "status": "not_ready",
  "service": "localco-api",
  "timestamp": "2026-06-19T00:00:00.000Z",
  "checks": {
    "database": {
      "status": "down"
    },
    "stripe": {
      "configured": true
    },
    "resend": {
      "configured": false
    }
  }
}
```

### Autres services

- Web : `GET /` doit répondre `200` une fois l'API et la base disponibles.
- Shop : `GET /` doit répondre `200` une fois l'API disponible.
- PostgreSQL : health check natif `pg_isready`.

## Rollback

1. Identifier le digest de l'image actuellement saine.
2. Redéployer API, Web et Shop avec les digests précédents.
3. Ne pas exécuter de rollback destructif de base sans procédure de restauration validée.
4. Si une migration incompatible a été appliquée, restaurer depuis une sauvegarde plutôt que modifier une migration déjà appliquée.

## Domaines à décider

- Domaine public de l'API.
- Domaine de l'interface interne Web.
- Domaine public de la boutique Shop.
- Origines CORS exactes.
- URL publique Better Auth.
- URL de retour Stripe Checkout.

## Informations manquantes pour terminer le CD

- Hébergeur ou orchestrateur cible.
- Stratégie réseau entre API, Web, Shop et PostgreSQL.
- Gestionnaire de secrets.
- Stratégie d'exécution des migrations.
- Stratégie de sauvegarde/restauration PostgreSQL.
- Environments GitHub et approbations de production.
- Politique de rollback par digest.
