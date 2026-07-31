import { defineConfig } from 'vite'

// Les chemins relatifs permettent le déploiement sur GitHub Pages
// sans casser le chargement des fichiers CSS et JavaScript.
export default defineConfig({ base: './' })
