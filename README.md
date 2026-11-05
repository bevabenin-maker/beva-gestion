# BEVA Gestion

Application interne de gestion des étudiants, formations et paiements de BEVA.

## Démarrage

```bash
npm install
npm run dev
```

La connexion et les données sont gérées par Supabase. La clé intégrée au client est une clé
publique limitée par les politiques RLS ; aucune clé d’administration n’est stockée dans ce dépôt.

## Production

```bash
npm run build
```

Le dossier `dist` généré peut être déployé sur un hébergement statique.

## Reprendre un apprenant dans une autre vague

Dans **Étudiants**, ouvrir un profil **En attente – prochaine vague**, puis choisir
**Reprendre dans une autre vague**. Sélectionner la formation, la vague de destination,
le mois de reprise et le mode de suivi. Vérifier le solde proposé avant de confirmer :
il correspond au tarif de l’ancien dossier moins ses paiements non annulés. Le réduire
si des mois acquis ne doivent plus être facturés ; le changement de mois ne recalcule
pas ce solde automatiquement.

La reprise crée un profil actif lié au précédent, numéroté dans la vague de destination.
L’ancien profil reste en attente dans sa vague, avec ses notes, paiements, reçus et
présences. Les boutons **Voir le dossier précédent** et **Voir la reprise** permettent
de consulter l’historique. Les anciens versements ne sont pas recopiés dans la nouvelle
vague. Une seconde formation peut être reprise dans le même nouveau profil ; une même
formation source ne peut pas être reprise deux fois dans la même vague.

La migration `resume_student_in_intake` doit être appliquée avant de publier l’interface.
Elle utilise les droits du personnel et les politiques RLS existantes ; la création du
profil, du dossier et de la note de reprise s’exécute dans une seule transaction.

## Consultation des mots de passe professeurs

Dans **Configuration → Professeurs**, **Mot de passe enregistré** permet aux membres
BEVA actifs (administration, direction et agents) de consulter le mot de passe via
le bouton œil. Il est masqué par défaut, puis effacé de l’affichage après 30 secondes,
à la perte de focus ou en quittant la rubrique. Il n’est pas stocké dans le navigateur.
La modification des accès reste réservée à l’administration et à la direction.

La copie consultable est chiffrée dans Supabase Vault ; l’empreinte PBKDF2 reste utilisée
pour la connexion des professeurs. Les fonctions de lecture/écriture sont uniquement
exécutables par le serveur, après vérification de l’identité et du compte BEVA actif.
Les anciens mots de passe restent utilisables pour se connecter mais doivent être
redéfinis une fois pour devenir consultables.

Ordre de publication : appliquer la migration `teacher_password_vault`, déployer
`beva-attendance`, puis publier l’interface. Cette modification nécessite l’approbation
explicite de la conservation réversible et de l’accès par les trois rôles du personnel.
