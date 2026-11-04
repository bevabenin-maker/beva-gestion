import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '@/lib/supabase'

const ENDPOINT = `${SUPABASE_URL}/functions/v1/beva-attendance`

const ERROR_MESSAGES = {
  INVALID_TEACHER_LOGIN: 'Formation ou mot de passe incorrect.',
  TEACHER_LOCKED: 'Trop de tentatives. Réessayez dans 15 minutes.',
  TEACHER_SESSION_EXPIRED: 'Votre session professeur a expiré. Reconnectez-vous.',
  TEACHER_ACCESS_DISABLED: 'Cet accès professeur est désactivé.',
  LOGIN_REQUIRED: 'Choisissez une formation et saisissez le mot de passe.',
  PASSWORD_TOO_SHORT: 'Le mot de passe doit contenir au moins 8 caractères.',
  INVALID_TEACHER_ACCOUNT: 'Le nom du professeur et la formation sont obligatoires.',
  NO_MAKEUP_SELECTED: 'Sélectionnez au moins un rattrapage effectué.',
  SCHEDULE_DATE_MISMATCH: 'Cette séance ne correspond pas au jour sélectionné.',
}

async function request(action, body = {}, { teacherToken, staff = false } = {}) {
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }
  if (teacherToken) headers['x-teacher-token'] = teacherToken
  if (staff) {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) throw new Error('Votre session BEVA a expiré.')
    headers.Authorization = `Bearer ${data.session.access_token}`
  }
  const response = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ action, ...body }) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.error) throw new Error(ERROR_MESSAGES[payload.error] || payload.error || 'Le service de présence est momentanément indisponible.')
  return payload
}

export const teacherAttendanceApi = {
  listCourses: () => request('list_courses'),
  login: (accountId, password) => request('login', { accountId, password }),
  context: token => request('context', {}, { teacherToken: token }),
  logout: token => request('logout', {}, { teacherToken: token }),
  submit: (token, payload) => request('submit_attendance', payload, { teacherToken: token }),
  cancel: (token, payload) => request('cancel_session', payload, { teacherToken: token }),
  completeMakeups: (token, attendanceRecordIds) => request('complete_makeups', { attendanceRecordIds }, { teacherToken: token }),
}

export const attendanceAdminApi = {
  saveTeacherAccount: payload => request('save_teacher_account', payload, { staff: true }),
}

export const isoDate = value => {
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Porto-Novo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export const mondayOf = value => {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
  const weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - weekday + 1)
  return date.toISOString().slice(0, 10)
}

export const addDays = (iso, days) => {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const weekRange = start => ({ start, end: addDays(start, 6) })

export function buildAttendanceWeek(data, intakeId, weekStart, today = isoDate(new Date())) {
  const range = weekRange(weekStart)
  const formations = data.formations || []
  const sessions = (data.attendanceSessions || []).filter(item => item.intake_id === intakeId && item.session_date >= range.start && item.session_date <= range.end)
  const sessionIds = new Set(sessions.map(item => item.id))
  const records = (data.attendanceRecords || []).filter(item => sessionIds.has(item.session_id))
  const recordIds = new Set(records.map(item => item.id))
  const makeups = (data.attendanceMakeups || []).filter(item => recordIds.has(item.attendance_record_id))
  const madeUpIds = new Set(makeups.map(item => item.attendance_record_id))
  const held = sessions.filter(item => item.status === 'held')
  const cancelled = sessions.filter(item => item.status === 'cancelled')
  const present = records.filter(item => item.status === 'present').length
  const late = records.filter(item => item.status === 'late').length
  const absentRows = records.filter(item => item.status === 'absent')
  const notified = absentRows.filter(item => item.notice_status === 'notified').length
  const recovered = absentRows.filter(item => madeUpIds.has(item.id)).length
  const expectedLimit = range.end < today ? range.end : today
  const expectedDates = []
  ;(data.attendanceSchedules || []).filter(item => item.active).forEach(schedule => {
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(range.start, offset)
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
      if (date <= expectedLimit && weekday === Number(schedule.weekday)) expectedDates.push({ schedule, date })
    }
  })
  const reportedKeys = new Set(sessions.map(item => `${item.schedule_id}:${item.session_date}`))
  const missingSessions = expectedDates.filter(item => !reportedKeys.has(`${item.schedule.id}:${item.date}`))
  const enrollmentById = new Map((data.enrollments || []).map(item => [item.id, item]))
  const studentById = new Map((data.students || []).map(item => [item.id, item]))
  const riskMap = new Map()
  absentRows.filter(item => !madeUpIds.has(item.id)).forEach(item => {
    const enrollment = enrollmentById.get(item.enrollment_id)
    const student = studentById.get(item.student_id)
    if (!enrollment || !student) return
    const current = riskMap.get(student.id) || { student, count: 0, formationIds: new Set(), notified: 0 }
    current.count += 1
    current.formationIds.add(enrollment.formation_id)
    if (item.notice_status === 'notified') current.notified += 1
    riskMap.set(student.id, current)
  })
  const formationRows = formations.map(formation => {
    const formationSessions = sessions.filter(item => item.formation_id === formation.id)
    const ids = new Set(formationSessions.map(item => item.id))
    const formationRecords = records.filter(item => ids.has(item.session_id))
    const formationAbsent = formationRecords.filter(item => item.status === 'absent')
    return {
      formation,
      sessions: formationSessions.filter(item => item.status === 'held').length,
      cancelled: formationSessions.filter(item => item.status === 'cancelled').length,
      present: formationRecords.filter(item => item.status === 'present' || item.status === 'late').length,
      absent: formationAbsent.length,
      recovered: formationAbsent.filter(item => madeUpIds.has(item.id)).length,
      expected: formationRecords.length,
    }
  }).filter(item => item.sessions || item.cancelled || item.expected)
  const totalExpected = records.length
  return {
    range, sessions, held: held.length, cancelled: cancelled.length, records,
    present, late, absent: absentRows.length, notified, recovered,
    attendanceRate: totalExpected ? Math.round(((present + late) / totalExpected) * 100) : 0,
    completionRate: totalExpected ? Math.round(Math.min(1, (present + late + recovered) / totalExpected) * 100) : 0,
    missingSessions,
    risks: [...riskMap.values()].sort((a, b) => b.count - a.count),
    byFormation: formationRows,
  }
}
