import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const sheets = readFileSync(new URL('../src/components/management-sheets.jsx', import.meta.url), 'utf8')
const studentSheet = readFileSync(new URL('../src/components/action-sheets.jsx', import.meta.url), 'utf8')
const payments = readFileSync(new URL('../src/screens/payments.jsx', import.meta.url), 'utf8')

assert.match(app, /EditStudentSheet/, 'La modification des apprenants doit être reliée à l’application.')
assert.match(studentSheet, /Modifier les informations/, 'La fiche apprenant doit exposer la modification du profil.')
assert.match(sheets, /from\('students'\)\.update\(payload\)\.eq\('id', student\.id\)/, 'La fiche doit modifier uniquement l’apprenant ciblé.')

assert.match(sheets, /from\('payments'\)\.update\(payload\)\.eq\('id', current\.id\)/, 'Un paiement doit pouvoir être modifié avec un filtre par identifiant.')
assert.match(sheets, /payment_context: 'pending'/, 'La mise en attente doit être restaurée.')
assert.match(sheets, /from\('payments'\)\.delete\(\)\.eq\('id', current\.id\)/, 'La suppression définitive doit cibler un seul paiement.')
assert.match(sheets, /role === 'admin'/, 'La suppression définitive doit rester réservée à l’administration.')
assert.match(sheets, /\['admin', 'direction'\]\.includes\(role\)/, 'La gestion des paiements doit rester limitée à la direction et à l’administration.')

assert.match(payments, /Paiements en attente d’affectation/, 'Le panneau des paiements en attente doit être visible.')
assert.match(payments, /onPendingAssign/, 'Un paiement en attente doit pouvoir être affecté.')
assert.match(payments, /onManagePayment/, 'L’historique doit ouvrir les commandes du paiement.')

console.log('Test restauration des actions de gestion : OK')
