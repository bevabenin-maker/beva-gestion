import assert from 'node:assert/strict'
import { buildViewModel } from '../src/lib/business.js'

const data = {
  students: [{ id: 's1', intake_id: 'v1', status: 'actif' }],
  enrollments: [
    { id: 'active', student_id: 's1', formation_id: 'f1', status: 'inscrit', agreed_fee: 90000 },
    { id: 'finished', student_id: 's1', formation_id: 'f1', status: 'termine', agreed_fee: 180000 }
  ],
  formations: [{ id: 'f1', name: 'Anglais' }],
  payments: [
    { id: 'p1', enrollment_id: 'active', amount: 90000 },
    { id: 'p2', enrollment_id: 'finished', amount: 90000 }
  ],
  studentNotes: []
}

const view = buildViewModel(data, 'v1')
assert.equal(view.expected, 90000, 'Le montant attendu actif respecte la règle métier actuelle.')
assert.equal(view.collected, 180000, 'Tous les versements historiques restent encaissés.')
assert.equal(view.collectionExpected, 270000, 'Le taux de vague inclut les dossiers actifs et terminés.')
assert.equal(Math.round(view.collectionRate), 67, 'Le taux ne doit pas être plafonné artificiellement à 100 %.')

console.log('Test du taux financier historique : OK')
