import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://bxhgptcsuhbfuqamcdxs.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gQ3vAqx13bYldbATsPS6wA_2bvKXpBj'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

export async function loadCoreData(userId) {
  const requests = await Promise.all([
    supabase.from('staff_members').select('*').eq('user_id', userId).single(),
    supabase.from('staff_members').select('user_id,full_name'),
    supabase.from('students').select('*').order('student_number', { ascending: false }),
    supabase.from('student_notes').select('*').order('created_at', { ascending: false }),
    supabase.from('enrollments').select('*').order('dossier_code'),
    supabase.from('formations').select('*').order('name'),
    supabase.from('payments').select('*').order('paid_at', { ascending: false }),
    supabase.from('payment_audit_log').select('*').order('occurred_at', { ascending: false }),
    supabase.from('intakes').select('*').order('start_date', { ascending: false }),
    supabase.from('teacher_access_accounts').select('id,formation_id,professor_name,active,password_configured,created_at,updated_at').order('professor_name'),
    supabase.from('attendance_schedules').select('*').order('weekday').order('start_time'),
    supabase.from('attendance_sessions').select('*').order('session_date', { ascending: false }),
    supabase.from('attendance_records').select('*'),
    supabase.from('attendance_makeups').select('*').order('completed_on', { ascending: false })
  ])
  const firstError = requests.find(result => result.error)?.error
  if (firstError) throw firstError
  const [staff, staffDirectory, students, studentNotes, enrollments, formations, payments, paymentAudit, intakes, teacherAccounts, attendanceSchedules, attendanceSessions, attendanceRecords, attendanceMakeups] = requests
  return {
    staff: staff.data,
    staffDirectory: staffDirectory.data || [],
    students: students.data || [],
    studentNotes: studentNotes.data || [],
    enrollments: enrollments.data || [],
    formations: formations.data || [],
    payments: payments.data || [],
    paymentAudit: paymentAudit.data || [],
    intakes: intakes.data || [],
    teacherAccounts: teacherAccounts.data || [],
    attendanceSchedules: attendanceSchedules.data || [],
    attendanceSessions: attendanceSessions.data || [],
    attendanceRecords: attendanceRecords.data || [],
    attendanceMakeups: attendanceMakeups.data || []
  }
}
