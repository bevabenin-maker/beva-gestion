import assert from 'node:assert/strict'
import { buildStudentImportTemplate, parseStudentImportRows, STUDENT_IMPORT_HEADERS } from '../src/excelImport.js'

const state = {
  intakeFilter: 'vague-2',
  intakes: [{ id: 'vague-2', name: 'Vague 2' }],
  formations: [
    { id: 'anglais-id', name: 'Anglais', active: true },
    { id: 'japonais-id', name: 'Japonais', active: true },
    { id: 'archive-id', name: 'Ancienne formation', active: false }
  ],
  students: [{
    intake_id: 'vague-2',
    last_name: 'EXISTANT',
    first_name: 'Élève',
    phone: '+229 01 99 88 77 66',
    email: 'existant@example.com',
    birth_date: '2000-01-02'
  }]
}

const prefixRows = [
  ['BEVA — Modèle d’import des élèves'],
  ['Vague de destination : Vague 2'],
  ['Instruction'],
  [],
  STUDENT_IMPORT_HEADERS
]

const validRow = [
  'AMOUZOU', 'Laure', '+229 01 57 79 67 00', 'laure@example.com', 'Femme', '12/05/2001', 'Cotonou', 'Actif',
  'Anglais', 'Actif', 'Présentiel', 'Boursier',
  'Japonais', 'Disponible', 'En ligne', 'Standard',
  '', '', '', '', '', '', '', '',
  'Paiera le mois prochain.', '10/10/2026'
]

const valid = parseStudentImportRows([...prefixRows, validRow], state, 'vague-2')
assert.equal(valid.total, 1)
assert.equal(valid.valid, 1)
assert.equal(valid.invalid, 0)
assert.equal(valid.validRows[0].birth_date, '2001-05-12')
assert.equal(valid.validRows[0].follow_up_on, '2026-10-10')
assert.equal(valid.validRows[0].enrollments.length, 2)
assert.equal(valid.validRows[0].enrollments[0].status, 'inscrit')
assert.equal(valid.validRows[0].enrollments[0].scholarship_status, true)
assert.equal(valid.validRows[0].enrollments[1].learning_mode, 'en_ligne')

const duplicate = [...validRow]
duplicate[0] = 'AUTRE'
duplicate[1] = 'Personne'
duplicate[2] = '99 88 77 66'
duplicate[3] = ''
const duplicateResult = parseStudentImportRows([...prefixRows, duplicate], state, 'vague-2')
assert.equal(duplicateResult.valid, 0)
assert.match(duplicateResult.rows[0].issues.join(' '), /téléphone existe déjà/i)

const missingTariff = [...validRow]
missingTariff[11] = ''
const tariffResult = parseStudentImportRows([...prefixRows, missingTariff], { ...state, students: [] }, 'vague-2')
assert.equal(tariffResult.valid, 0)
assert.match(tariffResult.rows[0].issues.join(' '), /Tarif de la formation 1 obligatoire/i)

const repeatedFormation = [...validRow]
repeatedFormation[12] = 'Anglais'
const repeatedResult = parseStudentImportRows([...prefixRows, repeatedFormation], { ...state, students: [] }, 'vague-2')
assert.equal(repeatedResult.valid, 0)
assert.match(repeatedResult.rows[0].issues.join(' '), /plusieurs fois/i)

const twoRows = [...prefixRows, validRow, [...validRow]]
const internalDuplicate = parseStudentImportRows(twoRows, { ...state, students: [] }, 'vague-2')
assert.equal(internalDuplicate.valid, 0)
assert.equal(internalDuplicate.invalid, 2)

const badHeaders = STUDENT_IMPORT_HEADERS.map((header, index) => index === 0 ? 'Nom' : header)
assert.throws(() => parseStudentImportRows([badHeaders, validRow], state, 'vague-2'), /colonnes du modèle/i)

const template = buildStudentImportTemplate(state, 'vague-2')
assert.equal(template.sheets.length, 3)
assert.equal(template.sheets[0].sheet, 'Élèves à importer')
assert.equal(template.sheets[0].data[4].length, STUDENT_IMPORT_HEADERS.length)

console.log('Tests import Excel : OK')
