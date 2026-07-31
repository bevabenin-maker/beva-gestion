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
