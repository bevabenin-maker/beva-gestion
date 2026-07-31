# BEVA Gestion

Application interne de BEVA pour suivre les étudiants, leurs formations et les paiements.

## Comment les totaux fonctionnent

Chaque nouvel étudiant reçoit automatiquement **quatre emplacements de formation**. Au départ, ils sont tous marqués **Disponible** : la personne a montré son intérêt, mais elle n’a pas encore fait de choix définitif.

- Une formation **Disponible** ne crée aucun montant à payer et n’augmente donc pas le « reste à payer » de la vague.
- Dès qu’une formation est choisie dans **Gérer les dossiers**, elle devient **Active**. Son tarif devient alors le montant attendu pour cette formation uniquement.
- Une même personne peut confirmer jusqu’à quatre formations. Chaque formation a son propre suivi, ses paiements et son reste à payer.
- Le **total encaissé** additionne uniquement les versements non annulés rattachés à la vague.
- Le **reste à payer** additionne uniquement les montants encore dus sur les formations actives des étudiants actifs. Les dossiers disponibles, terminés ou abandonnés ne gonflent pas ce total.
- Un paiement placé dans **Paiements en attente d’affectation** est conservé avec son reçu, mais ne compte dans aucune vague avant son affectation.
- Un paiement **annulé** reste visible pour la traçabilité, mais est retiré des calculs. Un paiement supprimé est retiré de la liste, tout en laissant une trace dans le journal d’audit.

Les anciens codes techniques de type `IN-…` sont conservés en base pour l’historique, mais ne sont plus affichés dans l’interface. La référence automatique `BEVA-PAY-…` reste la référence utile pour chaque versement.

## Utilisation sur téléphone

La version mobile est conçue pour consulter rapidement :

- tableau de bord et statistiques ;
- répartition des étudiants par âge ;
- liste et recherche des étudiants ;
- suivi financier par formation et filtre des échéances.

Les opérations qui modifient les données (création, modification des dossiers, annulation ou suppression) restent destinées à la tablette ou à l’ordinateur, afin d’éviter les erreurs sur petit écran.

## Démarrage

```bash
npm install
npm run dev
```

La connexion et les données sont gérées par Supabase. La clé intégrée au client est une clé publique limitée par les politiques RLS ; aucune clé d’administration n’est stockée dans ce dépôt.

## Production

```bash
npm run build
```

Le dossier `dist` généré peut être déployé sur un hébergement statique.
