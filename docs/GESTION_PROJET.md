# Amelioration de la gestion de projet

## Objectif

Mettre en place une organisation simple, lisible et durable pour faire avancer Localco sans perdre le fil entre les idees, le code, les tests et les livraisons.

## Decisions d'organisation

- Outil choisi : Trello.
- Equipe : developpement solo.
- Priorite produit actuelle : V1 stock + production.
- La caisse arrive apres stabilisation de la V1.

## 1. Clarifier la vision produit

A faire :

- Ecrire une phrase de vision : "Localco permet a [type d'utilisateur] de [resultat principal]".
- Definir le perimetre de la V1.
- Definir ce qui est explicitement hors V1.
- Identifier les 3 workflows critiques :
  - gerer les stocks,
  - produire des articles,
  - vendre/encaisser.
- Associer chaque workflow a un utilisateur cible.

Livrable :

- Une page `docs/PRODUCT.md` avec vision, utilisateurs, workflows et priorites.

## 2. Organiser le backlog

A faire :

- Creer un tableau Trello avec 5 colonnes :
  - Idee,
  - A specifier,
  - Pret,
  - En cours,
  - Fait.
- Decouper chaque grosse feature en tickets de 1 a 2 jours maximum.
- Ajouter une priorite a chaque ticket :
  - P0 bloquant,
  - P1 important,
  - P2 confort,
  - P3 plus tard.
- Ajouter un type :
  - feature,
  - bug,
  - technique,
  - documentation,
  - UX.
- Relier chaque ticket a une phase de la roadmap.

Regle utile :

- Un ticket "Pret" doit avoir un objectif, des criteres d'acceptation et une estimation approximative.

## 3. Standardiser les tickets

Modele de ticket propose :

```md
## Objectif

Pourquoi ce ticket existe ?

## Comportement attendu

Que doit pouvoir faire l'utilisateur ?

## Criteres d'acceptation

- [ ] Cas nominal valide
- [ ] Cas d'erreur gere
- [ ] UI lisible
- [ ] Tests ou verification manuelle documentee

## Notes techniques

Routes, modeles, fichiers ou contraintes connues.
```

Exemple :

```md
## Objectif

Permettre de produire un article depuis sa fiche.

## Comportement attendu

L'utilisateur voit la capacite de production, saisit une quantite, puis confirme.

## Criteres d'acceptation

- [ ] Les matieres premieres sont decrementees.
- [ ] Le stock article est incremente.
- [ ] Un message clair explique l'erreur.
```

## 4. Definir une Definition of Done

Une tache est terminee seulement si :

- le comportement attendu fonctionne,
- les cas d'erreur principaux sont traites,
- le code est lisible et coherent avec le reste du projet,
- les tests pertinents passent,
- la verification manuelle est notee si aucun test automatique n'existe,
- la documentation est mise a jour si le comportement ou la commande change,
- la PR ou le commit explique le pourquoi, pas seulement le quoi.

## 5. Structurer les branches et commits

Convention proposee :

- Branches : `codex/<courte-description>` ou `feature/<courte-description>`.
- Commits :
  - `feat: add production capacity`
  - `docs: add roadmap`
  - `test: cover article production`
  - `chore: update tooling`

Regles :

- Une branche = un objectif clair.
- Eviter les branches qui melangent feature, refactor et documentation sans lien direct.
- Garder les commits petits quand c'est possible.

## 6. Mettre en place des rituels simples

Rythme propose :

- Chaque semaine :
  - choisir 3 objectifs maximum,
  - verifier les tickets bloques,
  - reclasser les priorites.
- Chaque fin de session de dev :
  - noter ce qui a ete fait,
  - noter ce qui reste,
  - noter les decisions prises.
- Avant chaque livraison :
  - lancer lint/build/tests,
  - verifier les workflows critiques,
  - relire la liste des changements.

## 7. Suivre les decisions

A faire :

- Creer un dossier `docs/decisions`.
- Ajouter une decision quand un choix structurel est pris :
  - authentification,
  - stockage des montants,
  - architecture API,
  - strategie de deploiement,
  - choix de librairie.

Modele simple :

```md
# Decision: titre

Date:

## Contexte

## Decision

## Consequences
```

## 8. Ameliorer la qualite de livraison

A faire :

- Ajouter une checklist PR.
- Ajouter une CI.
- Ajouter des tests sur les services metier critiques.
- Ajouter des seeds realistes pour tester vite.
- Garder une liste de tests manuels par workflow.
- Capturer les bugs dans des tickets, pas seulement en memoire.

Checklist PR proposee :

```md
- [ ] Le besoin est clair.
- [ ] Les changements sont limites au sujet de la PR.
- [ ] Les erreurs principales sont gerees.
- [ ] Les tests pertinents passent.
- [ ] La documentation est mise a jour si necessaire.
- [ ] Une verification manuelle est indiquee.
```

## 9. Mesurer l'avancement

Indicateurs simples :

- Nombre de tickets P0/P1 ouverts.
- Nombre de workflows V1 termines.
- Nombre de bugs ouverts depuis plus de 7 jours.
- Temps moyen entre "En cours" et "Fait".
- Nombre de tickets termines par semaine.

Attention :

- Les indicateurs servent a voir les blocages, pas a mettre la pression.

## 10. Prochaines actions recommandees

Ordre conseille :

1. Creer le tableau Trello.
2. Ajouter les listes : Idee, A specifier, Pret, En cours, Fait.
3. Importer les cartes proposees dans `docs/TRELLO_BACKLOG.md`.
4. Commencer par les cartes P0 de stabilisation.
5. Enchainer sur les cartes P1 stock + production.
6. Ajouter une Definition of Done dans le repo.
7. Nettoyer les README.
8. Planifier une premiere livraison interne de la V1.

## Questions a trancher

- Veux-tu une organisation Trello tres legere ou un suivi plus formel ?
- Quelle est la frequence realiste de dev : quelques heures par semaine, plusieurs jours, temps plein ?
- Pour la V1, les alertes de seuil doivent-elles etre indispensables ou seulement utiles ?
- Faut-il inclure la gestion des nomenclatures dans "gerer articles" des la V1 ?
- Quelle date cible veux-tu viser pour une premiere V1 utilisable ?
