export function studentAttendanceHistory(data, student) {
  const sessions = new Map((data.attendanceSessions || []).filter(row => row.intake_id === student.intake_id && row.status === 'held').map(row => [row.id, row]))
  const recovered = new Set((data.attendanceMakeups || []).map(row => row.attendance_record_id))
  return (data.attendanceRecords || []).filter(row => row.student_id === student.id && sessions.has(row.session_id))
    .map(row => ({ ...row, session: sessions.get(row.session_id), recovered: recovered.has(row.id) }))
    .sort((a,b) => b.session.session_date.localeCompare(a.session.session_date))
}
