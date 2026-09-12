import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import writeExcelFile from 'write-excel-file/node'
import { readSheet } from 'read-excel-file/node'
import { buildStudentImportTemplate, parseStudentImportRows, STUDENT_IMPORT_SHEET } from '../src/excelImport.js'

const state = {
  intakeFilter: 'vague-2',
  intakes: [{ id: 'vague-2', name: 'Vague 2' }],
  formations: [
    { id: 'anglais-id', name: 'Anglais', active: true },
    { id: 'japonais-id', name: 'Japonais', active: true }
  ],
  students: []
}

const workbook = buildStudentImportTemplate(state, 'vague-2')
const values = [
  'DOSSOU', 'Mireille', '+229 01 97 00 00 01', 'mireille@example.com', 'Femme', new Date(2002, 6, 14), 'Abomey-Calavi', 'Actif',
  'Anglais', 'Actif', 'Présentiel', 'Boursier',
  'Japonais', 'Disponible', 'En ligne', 'Standard',
  '', '', '', '', '', '', '', '',
  'À rappeler en octobre.', new Date(2026, 9, 5)
]
workbook.sheets[0].data.push(values.map((value, index) => ({
  value,
  type: value instanceof Date ? Date : String,
  format: value instanceof Date ? 'dd/mm/yyyy' : index === 2 ? '@' : undefined
})))

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'beva-import-roundtrip-'))
const filePath = path.join(tempDir, 'modele-rempli.xlsx')
await writeExcelFile(workbook.sheets, { fontFamily: 'Arial', fontSize: 10 }).toFile(filePath)
const rows = await readSheet(filePath, STUDENT_IMPORT_SHEET)
const result = parseStudentImportRows(rows, state, 'vague-2', 'modele-rempli.xlsx')

assert.equal(result.total, 1)
assert.equal(result.valid, 1)
assert.equal(result.validRows[0].last_name, 'DOSSOU')
assert.equal(result.validRows[0].birth_date, '2002-07-14')
assert.equal(result.validRows[0].follow_up_on, '2026-10-05')
assert.equal(result.validRows[0].enrollments.length, 2)

console.log('Test aller-retour du fichier Excel : OK')
