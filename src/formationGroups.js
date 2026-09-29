export function classifyStudentsByFormation({ students = [], enrollments = [], formations = [] }) {
  const studentsById = new Map(students.map(student => [student.id, student]))
  const activeEnrollments = enrollments.filter(enrollment => {
    const student = studentsById.get(enrollment.student_id)
    return Boolean(enrollment.formation_id && enrollment.status === 'inscrit' && student?.status === 'actif')
  })

  const groups = formations.map(formation => {
    const studentIds = new Set(activeEnrollments
      .filter(enrollment => enrollment.formation_id === formation.id)
      .map(enrollment => enrollment.student_id))
    return {
      formation,
      studentIds,
      students: students.filter(student => studentIds.has(student.id))
    }
  })

  const classifiedStudentIds = new Set(activeEnrollments.map(enrollment => enrollment.student_id))
  const unclassifiedStudents = students.filter(student => !classifiedStudentIds.has(student.id))

  return { groups, activeEnrollments, classifiedStudentIds, unclassifiedStudents }
}
