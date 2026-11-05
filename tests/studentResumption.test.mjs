import assert from 'node:assert/strict'
import { previewResumption, resumptionBalance, validateResumption } from '../src/lib/student-resumption.js'
import { buildViewModel } from '../src/lib/business.js'
const student = { id: 'old', intake_id: 'wave1', status: 'en_attente', first_name: 'Test', last_name: 'REPRISE' }
const source = { id: 'course', student_id: 'old', formation_id: 'english', status: 'inscrit', agreed_fee: 90000 }
const data = { students: [student], enrollments: [source], intakes: [{ id: 'wave1' }, { id: 'wave2' }], payments: [{ id: 'p1', enrollment_id: 'course', amount: 30000 }, { id: 'p2', enrollment_id: 'course', amount: 20000, cancelled_at: '2026-11-04' }], studentNotes: [], formations: [{ id: 'english' }] }
const values = { source_enrollment_id: 'course', intake_id: 'wave2', resumes_from_month: '2', remaining_fee: '60000', learning_mode: 'en_ligne' }
assert.equal(resumptionBalance(source, data.payments), 60000)
const before = structuredClone(data)
const next = previewResumption(data, student, values)
assert.deepEqual(data, before, 'Source data must remain unchanged')
assert.deepEqual(next.payments, before.payments, 'Do not duplicate or move old receipts')
const target = next.students.find(item => item.returning_from_student_id === student.id)
assert.equal(target.status, 'actif'); assert.equal(target.intake_id, 'wave2')
const resumed = next.enrollments.find(item => item.resumed_from_enrollment_id === source.id)
assert.equal(resumed.resumes_from_month, 2); assert.equal(resumed.agreed_fee, 60000)
assert.equal(buildViewModel(next, 'wave1').collected, 30000)
assert.equal(buildViewModel(next, 'wave2').collected, 0)
assert.equal(buildViewModel(next, 'wave2').remaining, 60000)
assert.equal(buildViewModel(next, 'wave1').activeEnrollments.length, 0)
assert.throws(() => validateResumption(next, student, values), /déjà/)
assert.throws(() => validateResumption(data, { ...student, status: 'actif' }, values), /attente/)
for (const invalid of [{ intake_id: 'wave1' }, { intake_id: 'missing' }, { source_enrollment_id: 'other' }, { remaining_fee: '-1' }, { remaining_fee: '' }, { remaining_fee: '60001' }, { resumes_from_month: '4' }, { learning_mode: 'invalid' }]) assert.throws(() => validateResumption(data, student, { ...values, ...invalid }))
const free = previewResumption(data, student, { ...values, remaining_fee: '0' })
assert.equal(buildViewModel(free, 'wave2').remaining, 0)
const second = { ...source, id: 'course2', formation_id: 'french' }
const reused = previewResumption({ ...next, enrollments: [...next.enrollments, second] }, student, { ...values, source_enrollment_id: 'course2' })
assert.equal(reused.students.length, 2, 'Another course uses the same returning learner')
assert.equal(reused.enrollments.filter(item => item.student_id === target.id).length, 4)
console.log('Reprise : historique, solde, doublons et validation OK')
