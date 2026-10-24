import { formatMoney, localeCode, tr } from './preferences.js'

export const money = value => formatMoney(value)
export const compactMoney = value => formatMoney(value, { compact: true })
export const displayCode = value => String(value ?? '').replace(/^IN-?/i, '') || '—'
export const feeFor = scholarship => scholarship ? 90000 : 180000
export const studentStatusLabel = status => ({ actif: tr('Actif', 'Active'), suspendu: tr('Suspendu', 'Suspended'), abandonne: tr('Abandon', 'Withdrawn') }[status] || status || tr('À préciser', 'To be specified'))
export const enrollmentStatusLabel = status => ({ disponible: tr('Disponible', 'Available'), inscrit: tr('Actif', 'Active'), termine: tr('Terminé', 'Completed'), abandonne: tr('Abandon', 'Withdrawn') }[status] || status || tr('À préciser', 'To be specified'))
export const roleLabel = role => ({ admin: tr('Administrateur', 'Administrator'), direction: tr('Direction', 'Management'), agent: tr('Agent', 'Officer') }[role] || role || tr('Personnel', 'Staff'))
export const paymentMethodLabel = method => ({ especes: tr('Espèces', 'Cash'), mobile_money: 'Mobile Money', banque: tr('Virement', 'Bank transfer'), carte: tr('Carte', 'Card'), autre: tr('Autre', 'Other') }[method] || String(method || '—').replaceAll('_', ' '))
export const paymentMonthLabel = month => month ? `${tr('Mois', 'Month')} ${month}` : tr('Paiement global', 'General payment')
export const dateLabel = value => value ? new Intl.DateTimeFormat(localeCode(), { dateStyle: 'medium' }).format(new Date(value)) : '—'
export const dateTimeLabel = value => value ? new Intl.DateTimeFormat(localeCode(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

export function ageOf(student) {
  if (!student?.birth_date) return Number.isFinite(Number(student?.age)) ? Number(student.age) : null
  const birth = new Date(`${student.birth_date}T12:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1
  return age
}

export const paymentsFor = (payments, enrollmentId) => payments.filter(item => item.enrollment_id === enrollmentId && !item.cancelled_at)

export function financialStatus(enrollment, student, payments) {
  const paid = paymentsFor(payments, enrollment.id).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const accounted = Boolean(enrollment.formation_id && enrollment.status === 'inscrit' && student?.status === 'actif')
  const due = accounted ? Number(enrollment.agreed_fee ?? feeFor(Boolean(enrollment.scholarship_status))) : 0
  const remaining = Math.max(0, due - paid)
  const label = !accounted ? tr('Non comptabilisé', 'Not counted') : remaining === 0 ? tr('Soldé', 'Paid in full') : paid > 0 ? tr('Partiel', 'Part-paid') : tr('Non payé', 'Unpaid')
  return { paid, due, remaining, accounted, label }
}

export function buildViewModel(data, intakeId) {
  const students = data.students.filter(student => student.intake_id === intakeId)
  const studentIds = new Set(students.map(student => student.id))
  const enrollments = data.enrollments.filter(enrollment => studentIds.has(enrollment.student_id))
  const enrollmentIds = new Set(enrollments.map(enrollment => enrollment.id))
  const payments = data.payments.filter(payment => enrollmentIds.has(payment.enrollment_id))
  const notes = data.studentNotes.filter(note => studentIds.has(note.student_id))
  const studentMap = new Map(students.map(student => [student.id, student]))
  const formationMap = new Map(data.formations.map(formation => [formation.id, formation]))
  const activeEnrollments = enrollments.filter(enrollment => enrollment.status === 'inscrit' && studentMap.get(enrollment.student_id)?.status === 'actif' && enrollment.formation_id)
  const financial = enrollments.map(enrollment => ({
    enrollment,
    student: studentMap.get(enrollment.student_id),
    formation: formationMap.get(enrollment.formation_id),
    ...financialStatus(enrollment, studentMap.get(enrollment.student_id), payments)
  }))
  const activeFinancial = financial.filter(item => item.accounted)
  const expected = activeFinancial.reduce((sum, item) => sum + item.due, 0)
  const collected = payments.filter(payment => !payment.cancelled_at).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const remaining = activeFinancial.reduce((sum, item) => sum + item.remaining, 0)
  const collectionEnrollments = enrollments.filter(enrollment => enrollment.formation_id && ['inscrit', 'termine'].includes(enrollment.status))
  const collectionExpected = collectionEnrollments.reduce((sum, enrollment) => sum + Number(enrollment.agreed_fee ?? feeFor(Boolean(enrollment.scholarship_status))), 0)
  const collectionRate = collectionExpected ? collected / collectionExpected * 100 : 0
  const formationCounts = data.formations.map(formation => ({
    formation,
    count: activeEnrollments.filter(enrollment => enrollment.formation_id === formation.id).length
  })).filter(item => item.count > 0).sort((a, b) => b.count - a.count)
  const classifiedIds = new Set(activeEnrollments.map(enrollment => enrollment.student_id))
  return {
    students,
    enrollments,
    payments,
    notes,
    studentMap,
    formationMap,
    financial,
    activeEnrollments,
    expected,
    collected,
    remaining,
    collectionExpected,
    collectionRate,
    formationCounts,
    unclassified: students.filter(student => !classifiedIds.has(student.id)).length
  }
}

export function initials(person) {
  return `${person?.first_name?.[0] || ''}${person?.last_name?.[0] || ''}`.toUpperCase() || 'BE'
}

export const studentName = student => student ? `${student.last_name || ''} ${student.first_name || ''}`.trim() : tr('Étudiant inconnu', 'Unknown student')

export function noteSummary(notes, studentId) {
  const items = notes.filter(note => note.student_id === studentId)
  const followUp = items.filter(note => note.follow_up_on).sort((a, b) => String(a.follow_up_on).localeCompare(String(b.follow_up_on)))[0]
  return followUp ? `${tr('Relance', 'Follow-up')} ${dateLabel(`${followUp.follow_up_on}T12:00:00`)}` : `${items.length} ${items.length > 1 ? tr('notes', 'notes') : tr('note', 'note')}`
}
