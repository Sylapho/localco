# Matrice des roles

Ce document definit les roles de l'application LocalCo et les permissions associees.

## Roles

| Role | Description |
| --- | --- |
| `gerant` | Acces complet a l'application, configuration, stock, caisse et utilisateurs. |
| `vendeur` | Encaissement, consultation simple des articles et caisse du jour. |
| `production` | Production des articles, consultation des recettes/nomenclatures et stock utile a la production. |
| `stock` | Gestion des matieres premieres, receptions, corrections et alertes stock. |
| `comptable` | Consultation caisse, historique, exports et chiffres, sans modifier l'exploitation. |

## Matrice des permissions

| Action | gerant | vendeur | production | stock | comptable |
| --- | --- | --- | --- | --- | --- |
| Voir le dashboard | Oui | Oui | Oui | Oui | Oui |
| Voir les articles | Oui | Oui | Oui | Oui | Oui |
| Creer un article | Oui | Non | Non | Non | Non |
| Modifier un article | Oui | Non | Non | Non | Non |
| Supprimer un article | Oui | Non | Non | Non | Non |
| Voir les matieres premieres | Oui | Non | Oui | Oui | Non |
| Creer une matiere premiere | Oui | Non | Non | Oui | Non |
| Modifier une matiere premiere | Oui | Non | Non | Oui | Non |
| Supprimer une matiere premiere | Oui | Non | Non | Oui | Non |
| Voir les nomenclatures | Oui | Non | Oui | Oui | Non |
| Creer/modifier une nomenclature | Oui | Non | Oui | Non | Non |
| Produire un article | Oui | Non | Oui | Non | Non |
| Voir la capacite de production | Oui | Non | Oui | Oui | Non |
| Creer une vente | Oui | Oui | Non | Non | Non |
| Voir les ventes | Oui | Oui | Non | Non | Oui |
| Voir la caisse du jour | Oui | Oui | Non | Non | Oui |
| Cloturer la caisse | Oui | Non | Non | Non | Oui |
| Voir l'historique de caisse | Oui | Non | Non | Non | Oui |
| Voir la marge | Oui | Non | Non | Non | Oui |
| Exporter caisse / compta | Oui | Non | Non | Non | Oui |
| Voir les alertes stock | Oui | Non | Oui | Oui | Non |
| Faire une reception de stock | Oui | Non | Non | Oui | Non |
| Corriger un stock | Oui | Non | Non | Oui | Non |
| Voir les mouvements de stock | Oui | Non | Oui | Oui | Non |
| Gerer les utilisateurs | Oui | Non | Non | Non | Non |
| Modifier les roles | Oui | Non | Non | Non | Non |

## Permissions par route API

| Route | Methode | Roles autorises |
| --- | --- | --- |
| `/api/articles` | `GET` | `gerant`, `vendeur`, `production`, `stock` |
| `/api/articles` | `POST` | `gerant` |
| `/api/articles/:id` | `GET` | `gerant`, `vendeur`, `production`, `stock` |
| `/api/articles/:id` | `PATCH` | `gerant` |
| `/api/articles/:id` | `DELETE` | `gerant` |
| `/api/articles/:id/capacity` | `GET` | `gerant`, `production`, `stock` |
| `/api/articles/:id/produce` | `POST` | `gerant`, `production` |
| `/api/matieres-premieres` | `GET` | `gerant`, `production`, `stock` |
| `/api/matieres-premieres` | `POST` | `gerant`, `stock` |
| `/api/matieres-premieres/:id` | `GET` | `gerant`, `production`, `stock` |
| `/api/matieres-premieres/:id` | `PATCH` | `gerant`, `stock` |
| `/api/matieres-premieres/:id` | `DELETE` | `gerant`, `stock` |
| `/api/articles/:articleId/nomenclature` | `GET` | `gerant`, `production`, `stock` |
| `/api/articles/:articleId/nomenclature` | `POST` | `gerant`, `production` |
| `/api/articles/:articleId/nomenclature/:mpId` | `PATCH` | `gerant`, `production` |
| `/api/articles/:articleId/nomenclature/:mpId` | `DELETE` | `gerant`, `production` |
| `/api/ventes` | `GET` | `gerant`, `vendeur`, `comptable` |
| `/api/ventes` | `POST` | `gerant`, `vendeur` |
| `/api/ventes/:id` | `GET` | `gerant`, `vendeur`, `comptable` |
| `/api/caisse/today` | `GET` | `gerant`, `vendeur`, `comptable` |
| `/api/caisse/cloturer` | `POST` | `gerant`, `comptable` |
| `/api/caisse/journees` | `GET` | `gerant`, `comptable` |

## Permissions frontend

| Page | Roles autorises |
| --- | --- |
| `/articles` | `gerant`, `vendeur`, `production`, `stock` |
| `/articles/new` | `gerant` |
| `/articles/[id]` | `gerant`, `vendeur`, `production`, `stock` |
| `/articles/[id]/edit` | `gerant` |
| `/articles/[id]/nomenclature` | `gerant`, `production` |
| `/matieres-premieres` | `gerant`, `production`, `stock` |
| `/matieres-premieres/new` | `gerant`, `stock` |
| `/matieres-premieres/[id]` | `gerant`, `production`, `stock` |
| `/matieres-premieres/[id]/edit` | `gerant`, `stock` |
| `/ventes` | `gerant`, `vendeur`, `comptable` |
| `/ventes/new` | `gerant`, `vendeur` |
| `/caisse` | `gerant`, `vendeur`, `comptable` |
| `/caisse/journees` | `gerant`, `comptable` |

## Note d'implementation

Commencer avec les roles suivants :

- `gerant`
- `vendeur`
- `production`
- `stock`
- `comptable`

Idealement, les roles doivent etre relies a des permissions centralisees. Cela permettra d'ajouter plus tard des roles comme `admin`, `responsable_boutique` ou `stagiaire` sans reecrire toute l'application.
