export function missedFullWeek(data, intakeId, week, today) {
  if (today <= week.range.end) return []
  const eligible = (data.enrollments || []).filter(row => row.status === 'inscrit' && row.formation_id)
  const sessions = week.sessions.filter(row => row.status === 'held')
  const recovered = new Set((data.attendanceMakeups || []).map(row => row.attendance_record_id))
  const records = new Map(week.records.map(row => [`${row.enrollment_id}:${row.session_id}`, row]))
  return week.risks.flatMap(risk => {
    if (risk.student.intake_id !== intakeId || risk.student.status !== 'actif') return []
    const enrollments = eligible.filter(row => row.student_id === risk.student.id)
    if (!enrollments.length || enrollments.some(row => row.enrolled_at && row.enrolled_at.slice(0, 10) > week.range.start)) return []
    const formations = new Set(enrollments.map(row => row.formation_id))
    if (week.missingSessions.some(row => formations.has(row.schedule.formation_id))) return []
    const expected = enrollments.flatMap(row => sessions.filter(session => session.formation_id === row.formation_id).map(session => records.get(`${row.id}:${session.id}`)))
    if (!expected.length || expected.some(row => !row || row.status !== 'absent' || recovered.has(row.id))) return []
    return [risk]
  })
}

export function studentAttendanceHistory(data, student) {
  const sessions = new Map((data.attendanceSessions || []).filter(row => row.intake_id === student.intake_id && row.status === 'held').map(row => [row.id, row]))
  const recovered = new Set((data.attendanceMakeups || []).map(row => row.attendance_record_id))
  return (data.attendanceRecords || []).filter(row => row.student_id === student.id && sessions.has(row.session_id))
    .map(row => ({ ...row, session: sessions.get(row.session_id), recovered: recovered.has(row.id) }))
    .sort((a,b) => b.session.session_date.localeCompare(a.session.session_date))
}
