import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/screens/dashboard.jsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/refresh.css', import.meta.url), 'utf8')
const entry = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
const japanese = await readFile(new URL('../src/lib/translations-ja.js', import.meta.url), 'utf8')

assert.match(app, /get\('ui'\) !== 'classic'/, 'La vue classique doit rester accessible comme retour immédiat.')
assert.match(app, /useRefreshedUi&&'ui-refresh'/, 'Le nouveau thème doit rester isolé de la vue classique.')
assert.match(dashboard, /ClassicDashboard/, 'Le tableau de bord précédent doit rester disponible.')
assert.match(dashboard, /RefreshedDashboard/, 'Le nouveau tableau de bord doit être la vue par défaut.')
assert.match(dashboard, /view\.financial\.filter\(item=>item\.accounted&&item\.remaining>0\)/, 'Les soldes doivent respecter la logique financière existante.')
assert.match(styles, /^\.ui-refresh \{/m, 'Les styles doivent être limités à la nouvelle interface.')
assert.match(styles, /\.ui-refresh\.dark/, 'Le thème sombre doit avoir sa propre palette.')
assert.match(styles, /@media\(max-width:720px\)/, 'Le rendu mobile doit être prévu.')
assert.match(entry, /import '\.\/refresh\.css'/, 'La feuille du nouveau thème doit être chargée.')
assert.match(japanese, /'Évolution des encaissements': '入金額の推移'/, 'Les nouveaux libellés doivent exister en japonais.')

console.log('Nouvelle interface, retour classique, mobile et japonais vérifiés.')
