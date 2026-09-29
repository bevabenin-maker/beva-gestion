import assert from 'node:assert/strict'
import { buildFormationStudentWorkbookSheets } from '../src/excelExport.js'

const state = {
  intakeFilter: 'wave-2',
  intakes: [{ id: 'wave-2', name: 'Vague 2' }],
  formations: [{ id: 'anglais', name: 'Anglais' }, { id: 'japonais', name: 'Japonais' }],
  students: [
    { id: 'student-1', intake_id: 'wave-2', intake_student_number: 2, last_name: 'Zinsou', first_name: 'Awa', sex: 'F', birth_date: '2001-05-03', phone: '0197000001', email: 'awa@example.com', address: 'Cotonou', status: 'actif', created_at: '2026-09-01T10:00:00Z' },
    { id: 'student-2', intake_id: 'wave-2', intake_student_number: 1, last_name: 'Adoko', first_name: 'Jean', sex: 'M', birth_date: '1999-02-10', phone: '0197000002', email: '', address: 'Abomey-Calavi', status: 'suspendu', created_at: '2026-09-02T10:00:00Z' },
    { id: 'student-3', intake_id: 'wave-1', intake_student_number: 9, last_name: 'Hors', first_name: 'Vague', status: 'actif' }
  ],
  enrollments: [
    { id: 'enrollment-1', student_id: 'student-1', formation_id: 'anglais', status: 'inscrit', learning_mode: 'presentiel', scholarship_status: true },
    { id: 'enrollment-2', student_id: 'student-2', formation_id: 'anglais', status: 'disponible', learning_mode: 'en_ligne', scholarship_status: false },
    { id: 'enrollment-3', student_id: 'student-1', formation_id: 'japonais', status: 'inscrit', learning_mode: 'presentiel', scholarship_status: false },
    { id: 'enrollment-4', student_id: 'student-3', formation_id: 'anglais', status: 'inscrit', learning_mode: 'presentiel', scholarship_status: false }
  ]
}

const workbook = buildFormationStudentWorkbookSheets(state, 'wave-2', 'anglais')
assert.match(workbook.fileName, /^BEVA_Liste_Anglais_Vague_2_\d{4}-\d{2}-\d{2}\.xlsx$/)
assert.equal(workbook.sheets.length, 1)
assert.equal(workbook.sheets[0].sheet, 'Liste des élèves')
assert.equal(workbook.sheets[0].data.length, 5)
assert.equal(workbook.sheets[0].data[1][0].value.includes('1 élève(s)'), true)
assert.equal(workbook.sheets[0].data[4][1].value, 'Zinsou')
assert.equal(workbook.sheets[0].data[4][10].value, 'Actif')
assert.throws(() => buildFormationStudentWorkbookSheets(state, 'wave-2', 'inconnue'), /introuvable/)

console.log('Test export des élèves par formation : OK')
