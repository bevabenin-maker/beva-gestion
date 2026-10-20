import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const payments = await readFile(new URL('../src/screens/payments.jsx', import.meta.url), 'utf8')
const sheets = await readFile(new URL('../src/components/action-sheets.jsx', import.meta.url), 'utf8')
const receipts = await readFile(new URL('../src/lib/receipts.js', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/app.css', import.meta.url), 'utf8')

assert.equal(payments.includes('Panier moyen'), false, 'Le panier moyen ne doit plus apparaître')
assert.equal(receipts.includes('window.open'), false, 'Un reçu ne doit pas ouvrir un nouvel onglet')
assert.match(sheets, /export function ReceiptSheet/)
assert.match(sheets, /srcDoc=\{receiptHtml\(payment,data\)\}/)
assert.match(app, /lazy\(loadPaymentsScreen\)/)
assert.match(app, /requestIdleCallback/)
assert.equal(app.includes("filter: 'blur"), false, 'Les transitions de rubriques ne doivent pas flouter tout le contenu')
assert.match(styles, /\.dark \.login-form-wrap\{background:#0b1727\}/)
assert.match(styles, /\.dark \.loading-screen/)
assert.match(styles, /\.receipt-viewer-sheet\{display:flex/)
assert.match(styles, /height:100dvh!important/)
assert.match(receipts, /\.payment-head\{display:none\}/)
assert.match(receipts, /content:'Montant reçu'/)
assert.match(receipts, /padding:18px 14px max\(28px,env\(safe-area-inset-bottom\)\)/)

console.log('Reçus intégrés, thème sombre et chemin de chargement vérifiés.')
