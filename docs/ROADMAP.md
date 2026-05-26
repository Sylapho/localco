# Roadmap Localco

## Contexte actuel

Localco ressemble aujourd'hui a une application de gestion pour une activite de production/vente alimentaire ou artisanale.

Etat visible dans le code :

- Frontend Next.js dans `apps/web`.
- API NestJS dans `apps/api`.
- Base PostgreSQL via Prisma.
- Modules deja presents : articles, matieres premieres, nomenclatures, production d'articles.
- Modele de donnees deja prevu pour : utilisateurs, ventes, lignes de vente, commandes, lignes de commande, journees de caisse.
- Authentification amorcee via Clerk, mais pas encore generalisee dans les routes.
- Page d'accueil encore issue du template Next.js.
- Documentation projet encore tres embryonnaire.

## Objectif produit propose

Construire un outil simple pour gerer :

- le catalogue d'articles vendus,
- les matieres premieres,
- les recettes/nomenclatures,
- la production et les stocks,
- les ventes et la caisse,
- les commandes client,
- les alertes de reapprovisionnement,
- les indicateurs de pilotage.

## Decisions V1

- Priorite V1 : stock + production.
- Priorite suivante : caisse.
- Strategie domaine : espace employe sur `app.<nom-de-domaine>`, boutique publique sur `<nom-de-domaine>`.
- API commune possible sur `api.<nom-de-domaine>`.
- Outil de suivi projet : Trello.
- Equipe : developpement seul.
- V1 utilisable : creer et gerer les articles, gerer les matieres premieres, produire, voir les stocks.

## Vision domaine et applications

La separation cible est la suivante :

- `<nom-de-domaine>` : boutique publique accessible aux clients.
- `app.<nom-de-domaine>` : interface interne protegee pour stock, production, caisse et gestion.
- `api.<nom-de-domaine>` : API commune consommee par l'espace employe et la boutique publique.

Cette approche est faisable et recommandee, car elle separe clairement :

- les usages internes, qui demandent une authentification et des droits,
- les usages publics, qui doivent etre simples, rapides et limites aux articles vendables,
- le backend metier, qui reste la source unique de verite.

Architecture cible proposee :

- `apps/web` : espace employe V1.
- `apps/api` : API NestJS commune.
- `apps/shop` : boutique publique a creer plus tard, quand le socle stock/production sera stable.

Regles importantes :

- L'espace employe peut voir et modifier les articles, les matieres premieres, les nomenclatures et les stocks.
- La boutique publique ne doit afficher que les articles publiables, par exemple `online = true`.
- La boutique ne doit jamais exposer les matieres premieres, les couts internes, les seuils ou les donnees de production.
- Les stocks doivent etre mis a jour par l'API commune pour eviter les incoherences entre boutique, caisse et production.

## Phase 0 - Stabilisation de la base

Priorite : rendre le socle fiable avant d'ajouter trop de features.

- Remplacer la page d'accueil par un vrai tableau de bord.
- Assumer que `apps/web` est l'espace employe de la V1.
- Preparer la configuration domaine cible : `app.<nom-de-domaine>`.
- Preparer la configuration API cible : `api.<nom-de-domaine>`.
- Corriger les textes encodes incorrectement visibles dans l'interface.
- Harmoniser les gestionnaires d'erreurs API cote web.
- Verifier les variables d'environnement necessaires et documenter `.env`.
- Nettoyer les README generes par Nest/Next.
- Ajouter une documentation de demarrage local : installation, base de donnees, migrations, seed, lancement.
- Ajouter une commande de verification globale : lint, build, tests.
- Mettre en place une convention de nommage des branches, commits et tickets.

Critere de sortie :

- Un nouveau developpeur peut lancer le projet en local avec la documentation.
- L'espace employe affiche une page d'accueil utile.
- Les erreurs les plus courantes sont comprehensibles.
- La strategie domaine est documentee meme si elle n'est pas encore deployee.

## Phase 1 - MVP stock et production

Priorite : finir le coeur metier deja commence dans l'espace employe.

- Articles :
  - liste, detail, creation, modification, suppression,
  - prix, TVA, stock, statut en ligne, description,
  - affichage clair du stock disponible.
- Matieres premieres :
  - liste, detail, creation, modification, suppression,
  - stock, unite, cout unitaire, seuil, conditionnement,
  - mise en evidence des stocks sous seuil.
- Nomenclatures :
  - associer les matieres premieres a un article,
  - modifier les quantites necessaires,
  - supprimer une ligne de nomenclature,
  - afficher le cout de revient estime par article.
- Production :
  - afficher la capacite de production selon le stock disponible,
  - produire une quantite donnee,
  - decrementer les matieres premieres,
  - incrementer le stock article,
  - bloquer la production si le stock est insuffisant.

Critere de sortie :

- On peut creer une recette, savoir combien on peut produire, produire, et voir les stocks evoluer correctement.

Perimetre V1 :

- Inclus :
  - articles,
  - matieres premieres,
  - nomenclatures,
  - capacite de production,
  - production,
  - visualisation des stocks,
  - alertes de seuil simples.
- Exclu de la V1 :
  - caisse complete,
  - ventes,
  - boutique publique,
  - commandes client,
  - paiement en ligne,
  - reporting avance.

## Phase 2 - Ventes et caisse

Priorite apres V1 : transformer les stocks en activite commerciale mesurable.

- Creer un module ventes cote API.
- Creer une interface de caisse simple :
  - choix des articles,
  - quantites,
  - remise,
  - mode de paiement,
  - total HT, TVA, TTC.
- A chaque vente :
  - decrementer le stock article,
  - enregistrer les lignes de vente,
  - associer la vente a un utilisateur.
- Gerer les journees de caisse :
  - ouverture,
  - resume de la journee,
  - totaux par mode de paiement,
  - cloture,
  - export simple.
- Ajouter des controles :
  - impossible de vendre plus que le stock,
  - impossible de modifier une journee cloturee sans role autorise.

Critere de sortie :

- Une vente peut etre saisie et retrouvee.
- Les totaux de caisse sont coherents avec les ventes.

## Phase 3 - Boutique publique

Priorite apres caisse ou en parallele si le socle est stable : exposer les articles vendables sur le domaine principal.

- Creer une application boutique publique, par exemple `apps/shop`.
- Deployer la boutique sur `<nom-de-domaine>`.
- Afficher uniquement les articles en ligne.
- Masquer toutes les donnees internes :
  - couts matieres,
  - seuils,
  - nomenclatures,
  - capacite de production,
  - informations de caisse.
- Prevoir une fiche article publique :
  - nom,
  - prix,
  - TVA si necessaire,
  - disponibilite,
  - description,
  - image plus tard.
- Ajouter une premiere logique de panier si la boutique doit vendre en ligne.
- Garder l'API comme source unique des articles et stocks.

Critere de sortie :

- Le domaine principal affiche une boutique simple et publique.
- Les donnees internes restent uniquement dans l'espace employe.

## Phase 4 - Commandes client

Priorite : preparer les ventes planifiees.

- Creer un module commandes cote API.
- Creer une interface de gestion des commandes :
  - nouvelle,
  - confirmee,
  - en preparation,
  - prete,
  - retiree,
  - annulee.
- Relier les commandes aux articles et quantites.
- Verifier les stocks disponibles lors de la confirmation/preparation.
- Ajouter la date et le lieu de retrait.
- Prevoir l'integration paiement plus tard via le champ `stripeId`.
- Ajouter des filtres : statut, date de retrait, client.

Critere de sortie :

- Une commande peut etre creee, suivie, preparee et terminee.

## Phase 5 - Authentification et roles

Priorite : securiser les actions sensibles.

- Finaliser l'integration Clerk.
- Relier les utilisateurs Clerk au modele `User`.
- Proteger l'espace employe `app.<nom-de-domaine>`.
- Definir les roles :
  - admin,
  - responsable,
  - vendeur,
  - production.
- Proteger les routes API.
- Proteger les pages web selon le role.
- Journaliser les actions critiques :
  - production,
  - vente,
  - annulation,
  - modification de stock,
  - cloture de caisse.

Critere de sortie :

- Chaque utilisateur voit uniquement ce qu'il peut faire.
- Les actions importantes sont attribuables a une personne.

## Phase 6 - Pilotage et alertes

Priorite : aider a prendre de meilleures decisions.

- Tableau de bord :
  - chiffre d'affaires du jour,
  - ventes par article,
  - stocks faibles,
  - capacite de production,
  - commandes a preparer.
- Alertes :
  - matieres premieres sous seuil,
  - articles bientot en rupture,
  - commandes proches du retrait,
  - ecarts de caisse.
- Reporting :
  - ventes par periode,
  - marge estimee,
  - cout matiere par article,
  - evolution des stocks.
- Exports :
  - CSV ventes,
  - CSV stocks,
  - resume de caisse.

Critere de sortie :

- L'utilisateur sait quoi produire, quoi acheter, et ce qui s'est vendu.

## Phase 7 - Qualite, industrialisation et deploiement

Priorite : rendre le projet durable.

- Ajouter des tests unitaires sur les services metier critiques.
- Ajouter des tests e2e sur :
  - creation d'article,
  - creation de nomenclature,
  - production,
  - vente,
  - cloture caisse.
- Ajouter une CI :
  - installation,
  - lint,
  - tests,
  - build.
- Ajouter un environnement de staging.
- Documenter le deploiement par domaine :
  - boutique publique sur `<nom-de-domaine>`,
  - espace employe sur `app.<nom-de-domaine>`,
  - API sur `api.<nom-de-domaine>`.
- Documenter la strategie de sauvegarde de la base.
- Documenter la procedure de restauration.
- Mettre en place des logs applicatifs utiles.
- Ajouter un suivi d'erreurs frontend/backend.

Critere de sortie :

- Le projet peut etre deploye, surveille et maintenu sans improvisation.

## Backlog fonctionnel

### Stock

- Historique des mouvements de stock.
- Ajustement manuel avec raison obligatoire.
- Inventaire periodique.
- Import/export CSV des matieres premieres.
- Gestion des fournisseurs.
- Gestion des prix fournisseurs.

### Production

- Lots de production.
- Dates de fabrication.
- Dates limites de consommation.
- Pertes et casse.
- Production planifiee.
- Suggestions de production selon les ventes passees.

### Vente

- Ticket de caisse.
- Remboursement/annulation.
- Remises nommees.
- Moyens de paiement configurables.
- Statistiques vendeur.

### Commandes

- Confirmation par email.
- Paiement en ligne.
- Acompte.
- Preparation par lot.
- Etiquettes de commande.

### Catalogue

- Categories d'articles.
- Photos d'articles.
- Disponibilite par jour.
- Publication boutique en ligne sur `<nom-de-domaine>`.
- Application boutique separee de l'espace employe.

## Backlog technique

- Clarifier la strategie Prisma Client, car le schema genere actuellement dans `prisma/generated/prisma`.
- Centraliser les types partages ou generer les types API.
- Ajouter une validation plus stricte des DTO.
- Ajouter une couche de mapping pour eviter de coupler le frontend aux reponses Prisma brutes.
- Normaliser les erreurs API.
- Ajouter pagination et recherche sur les listes.
- Ajouter fixtures/seed realistes.
- Remplacer les nombres flottants par une representation plus sure pour les montants, si le projet manipule beaucoup d'argent.
- Ajouter des migrations de donnees controlees.
- Ajouter un design system minimal cote frontend.
- Preparer une configuration CORS propre entre boutique, espace employe et API.
- Preparer les variables d'environnement par application et par domaine.

## Questions ouvertes

- Qui sont les utilisateurs principaux : vendeur, responsable boutique, production, admin ?
- Le projet vise-t-il une seule boutique ou plusieurs lieux de vente ?
- Les stocks doivent-ils etre geres en temps reel ou seulement en fin de journee ?
- Les commandes client viendront-elles de la boutique publique, d'un formulaire interne, ou des deux ?
- Stripe est-il vraiment prevu pour la V1 ou plus tard ?
- Le calcul de marge doit-il etre precis comptablement ou seulement indicatif ?
- Les recettes/nomenclatures peuvent-elles varier selon les lots ou sont-elles fixes ?
- Faut-il gerer les pertes, invendus et dons ?
- Le projet doit-il fonctionner sur tablette/mobile en caisse ?
- Quelle est la date cible pour une premiere version utilisable ?

## Questions deja tranchees

- Priorite V1 : stock + production.
- Caisse : apres la V1.
- Domaine principal : boutique publique.
- Sous-domaine employe : espace interne stock, production, puis caisse.
- API commune : option cible sur `api.<nom-de-domaine>`.
- Outil de gestion projet : Trello.
- Taille equipe : solo.
- Definition pratique de la V1 : creer/gerer articles, gerer matieres premieres, produire, voir les stocks.
