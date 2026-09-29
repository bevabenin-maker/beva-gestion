import assert from 'node:assert/strict'
import { classifyStudentsByFormation } from '../src/formationGroups.js'

const students = [
  { id: 'active', status: 'actif' },
  { id: 'available', status: 'actif' },
  { id: 'suspended', status: 'suspendu' },
  { id: 'without', status: 'actif' },
  { id: 'multi', status: 'actif' }
]
const formations = [{ id: 'anglais', name: 'Anglais' }, { id: 'japonais', name: 'Japonais' }]
const enrollments = [
  { student_id: 'active', formation_id: 'anglais', status: 'inscrit' },
  { student_id: 'available', formation_id: 'anglais', status: 'disponible' },
  { student_id: 'suspended', formation_id: 'anglais', status: 'inscrit' },
  { student_id: 'multi', formation_id: 'anglais', status: 'inscrit' },
  { student_id: 'multi', formation_id: 'japonais', status: 'inscrit' }
]

const result = classifyStudentsByFormation({ students, enrollments, formations })
assert.deepEqual(result.groups[0].students.map(student => student.id), ['active', 'multi'])
assert.deepEqual(result.groups[1].students.map(student => student.id), ['multi'])
assert.deepEqual(result.unclassifiedStudents.map(student => student.id), ['available', 'suspended', 'without'])

console.log('Test classement des élèves par formation : OK')
