import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studentSheet = readFileSync(new URL('../src/components/action-sheets.jsx', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('../src/components/app-chrome.jsx', import.meta.url), 'utf8')

const businessImport = studentSheet.match(/import \{([^}]+)\} from '@\/lib\/business'/)?.[1] || ''

assert.match(businessImport, /\bpaymentMethodLabel\b/, 'Le panneau Paiements doit importer paymentMethodLabel.')
assert.match(studentSheet, /tab==='payments'/, 'La fiche étudiante doit conserver son onglet Paiements.')
assert.match(sidebar, /className="sidebar-account"/, 'Le profil connecté doit rester intégré à la barre latérale.')
assert.match(sidebar, /aria-label="Se déconnecter"/, 'La déconnexion doit rester accessible.')

console.log('Test fiche Paiements et profil latéral : OK')
