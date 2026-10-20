import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bxhgptcsuhbfuqamcdxs.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gQ3vAqx13bYldbATsPS6wA_2bvKXpBj'

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
    supabase.from('intakes').select('*').order('start_date', { ascending: false })
  ])
  const firstError = requests.find(result => result.error)?.error
  if (firstError) throw firstError
  const [staff, staffDirectory, students, studentNotes, enrollments, formations, payments, paymentAudit, intakes] = requests
  return {
    staff: staff.data,
    staffDirectory: staffDirectory.data || [],
    students: students.data || [],
    studentNotes: studentNotes.data || [],
    enrollments: enrollments.data || [],
    formations: formations.data || [],
    payments: payments.data || [],
    paymentAudit: paymentAudit.data || [],
    intakes: intakes.data || []
  }
}
