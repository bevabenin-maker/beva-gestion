import { paymentsFor } from './business.js'

export function resumptionBalance(enrollment, payments) {
  const paid = paymentsFor(payments, enrollment.id).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return Math.max(0, Number(enrollment.agreed_fee || 0) - paid)
}

export function validateResumption(data, student, values) {
  if (student.status !== 'en_attente') throw new Error('Cet apprenant doit être en attente de la prochaine vague.')
  const source = data.enrollments.find(item => item.id === values.source_enrollment_id && item.student_id === student.id && item.formation_id && item.status !== 'disponible')
  if (!source) throw new Error('Choisissez un dossier de formation existant.')
  if (values.intake_id === student.intake_id || !data.intakes.some(item => item.id === values.intake_id)) throw new Error('Choisissez une autre vague.')
  const month = Number(values.resumes_from_month)
  const amount = Number(values.remaining_fee)
  if (!Number.isInteger(month) || month < 1 || month > 3) throw new Error('Le mois de reprise doit être compris entre 1 et 3.')
  if (values.remaining_fee === '' || !Number.isFinite(amount) || amount < 0 || amount > resumptionBalance(source, data.payments)) throw new Error('Le solde doit être compris entre zéro et le reste de l’ancien dossier.')
  if (!['presentiel', 'en_ligne'].includes(values.learning_mode)) throw new Error('Mode de suivi invalide.')
  const targetStudents = data.students.filter(item => item.returning_from_student_id === student.id && item.intake_id === values.intake_id)
  if (targetStudents.some(item => item.status !== 'actif')) throw new Error('Le dossier de reprise existant n’est plus actif.')
  if (data.enrollments.some(item => item.resumed_from_enrollment_id === source.id && targetStudents.some(target => target.id === item.student_id))) throw new Error('Ce dossier a déjà été repris dans cette vague.')
  return { source, month, amount }
}

export function previewResumption(data, student, values) {
  const { source, month, amount } = validateResumption(data, student, values)
  const existing = data.students.find(item => item.returning_from_student_id === student.id && item.intake_id === values.intake_id)
  const id = existing?.id || crypto.randomUUID()
  const target = existing || { ...student, registration_code: undefined, student_number: undefined, id, intake_id: values.intake_id, status: 'actif', returning_from_student_id: student.id, created_at: new Date().toISOString(), intake_student_number: Math.max(0, ...data.students.filter(item => item.intake_id === values.intake_id).map(item => Number(item.intake_student_number || 0))) + 1 }
  const slots = existing ? data.enrollments.filter(item => item.student_id === id) : Array.from({ length: 4 }, (_, index) => ({ id: crypto.randomUUID(), student_id: id, slot: index + 1, dossier_code: `${id}-${index + 1}`, status: 'disponible', formation_id: null, agreed_fee: 180000 }))
  const slot = slots.find(item => item.status === 'disponible')
  if (!slot) throw new Error('Aucun emplacement disponible dans la nouvelle vague.')
  const resumed = { ...slot, formation_id: source.formation_id, status: 'inscrit', scholarship_status: source.scholarship_status, agreed_fee: amount, monthly_fee: Math.ceil(amount / (4 - month)), learning_mode: values.learning_mode, enrolled_at: new Date().toISOString().slice(0, 10), resumed_from_enrollment_id: source.id, resumes_from_month: month }
  return { ...data, students: existing ? data.students : [...data.students, target], enrollments: [...data.enrollments.filter(item => item.student_id !== id), ...slots.map(item => item.id === slot.id ? resumed : item)] }
}
