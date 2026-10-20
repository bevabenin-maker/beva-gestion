export const money = value => `${new Intl.NumberFormat('fr-FR').format(Number(value || 0))} FCFA`
export const compactMoney = value => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
export const displayCode = value => String(value ?? '').replace(/^IN-?/i, '') || '—'
export const feeFor = scholarship => scholarship ? 90000 : 180000
export const studentStatusLabel = status => ({ actif: 'Actif', suspendu: 'Suspendu', abandonne: 'Abandon' }[status] || status || 'À préciser')
export const enrollmentStatusLabel = status => ({ disponible: 'Disponible', inscrit: 'Actif', termine: 'Terminé', abandonne: 'Abandon' }[status] || status || 'À préciser')
export const roleLabel = role => ({ admin: 'Administrateur', direction: 'Direction', agent: 'Agent' }[role] || role || 'Personnel')
export const paymentMethodLabel = method => ({ especes: 'Espèces', mobile_money: 'Mobile Money', banque: 'Virement', carte: 'Carte', autre: 'Autre' }[method] || String(method || '—').replaceAll('_', ' '))
export const paymentMonthLabel = month => month ? `Mois ${month}` : 'Paiement global'
export const dateLabel = value => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : '—'
export const dateTimeLabel = value => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

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
  const label = !accounted ? 'Non comptabilisé' : remaining === 0 ? 'Soldé' : paid > 0 ? 'Partiel' : 'Non payé'
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
    formationCounts,
    unclassified: students.filter(student => !classifiedIds.has(student.id)).length
  }
}

export function initials(person) {
  return `${person?.first_name?.[0] || ''}${person?.last_name?.[0] || ''}`.toUpperCase() || 'BE'
}

export const studentName = student => student ? `${student.last_name || ''} ${student.first_name || ''}`.trim() : 'Étudiant inconnu'

export function noteSummary(notes, studentId) {
  const items = notes.filter(note => note.student_id === studentId)
  const followUp = items.filter(note => note.follow_up_on).sort((a, b) => String(a.follow_up_on).localeCompare(String(b.follow_up_on)))[0]
  return followUp ? `Relance ${dateLabel(`${followUp.follow_up_on}T12:00:00`)}` : `${items.length} note${items.length > 1 ? 's' : ''}`
}
