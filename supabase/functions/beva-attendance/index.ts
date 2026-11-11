import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.57.4"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const PUBLISHABLE_KEY = Deno.env.get("SUPABASE_ANON_KEY")!
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-teacher-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
})

const localDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Porto-Novo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date())

const bytesToBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")

const randomValue = (size = 32) => {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return bytesToBase64Url(new Uint8Array(digest))
}

const passwordHash = async (password: string, salt: string) => {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
  )
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 160_000, hash: "SHA-256",
  }, material, 256)
  return bytesToBase64Url(new Uint8Array(bits))
}

const safeEqual = (left = "", right = "") => {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return mismatch === 0
}

const teacherToken = (req: Request) => req.headers.get("x-teacher-token")?.trim()
  || req.headers.get("authorization")?.replace(/^Teacher\s+/i, "").trim()

async function requireTeacher(req: Request) {
  const token = teacherToken(req)
  if (!token) throw new Error("TEACHER_UNAUTHENTICATED")
  const hash = await sha256(token)
  const { data: session } = await admin.from("teacher_access_sessions")
    .select("id,teacher_account_id,expires_at,revoked_at")
    .eq("token_hash", hash).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle()
  if (!session) throw new Error("TEACHER_SESSION_EXPIRED")
  const { data: account } = await admin.from("teacher_access_accounts")
    .select("id,formation_id,professor_name,active,formations!inner(id,name,active)")
    .eq("id", session.teacher_account_id).eq("active", true).maybeSingle()
  if (!account || !account.formations?.active) throw new Error("TEACHER_ACCESS_DISABLED")
  await admin.from("teacher_access_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id)
  return { session, account }
}

async function requireStaff(req: Request) {
  const authorization = req.headers.get("authorization") || ""
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim()
  if (!jwt) throw new Error("STAFF_UNAUTHENTICATED")
  const caller = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false },
  })
  const { data: userData, error: userError } = await caller.auth.getUser(jwt)
  if (userError || !userData.user) throw new Error("STAFF_UNAUTHENTICATED")
  const { data: staff } = await admin.from("staff_members").select("user_id,full_name,role,active")
    .eq("user_id", userData.user.id).eq("active", true).maybeSingle()
  if (!staff || !["admin", "direction", "agent"].includes(staff.role)) throw new Error("STAFF_FORBIDDEN")
  return staff
}

async function requireManagement(req: Request) {
  const staff = await requireStaff(req)
  if (!["admin", "direction"].includes(staff.role)) throw new Error("STAFF_FORBIDDEN")
  return staff
}

async function revealTeacherPassword(req: Request, body: any) {
  const staff = await requireStaff(req)
  const accountId = String(body.accountId || "")
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) throw new Error("INVALID_TEACHER_ACCOUNT")
  const { data, error } = await admin.rpc("read_teacher_password", {
    p_account_id: accountId, p_staff_id: staff.user_id,
  })
  if (error) throw new Error("PASSWORD_READ_FAILED")
  return { password: data || null }
}

async function activeIntake() {
  const { data, error } = await admin.from("intakes").select("id,name,start_date,end_date,active")
    .eq("active", true).order("start_date", { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  if (!data) throw new Error("NO_ACTIVE_INTAKE")
  return data
}

async function eligibleEnrollments(formationId: string, intakeId: string) {
  const { data, error } = await admin.from("enrollments")
    .select("id,student_id,formation_id,learning_mode,students!inner(id,first_name,last_name,intake_student_number,student_number,intake_id,status)")
    .eq("formation_id", formationId).eq("status", "inscrit")
    .eq("students.intake_id", intakeId).eq("students.status", "actif")
    .order("dossier_code")
  if (error) throw error
  return (data || []).sort((a, b) => String(a.students?.last_name || "").localeCompare(String(b.students?.last_name || ""), "fr"))
}

async function buildContext(account: any) {
  const intake = await activeIntake()
  const [{ data: schedules, error: scheduleError }, enrollments] = await Promise.all([
    admin.from("attendance_schedules").select("id,formation_id,weekday,start_time,end_time,label,active")
      .eq("formation_id", account.formation_id).eq("active", true).order("weekday").order("start_time"),
    eligibleEnrollments(account.formation_id, intake.id),
  ])
  if (scheduleError) throw scheduleError

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 70)
  const sinceDate = since.toISOString().slice(0, 10)
  const { data: sessions, error: sessionError } = await admin.from("attendance_sessions")
    .select("*").eq("formation_id", account.formation_id).eq("intake_id", intake.id)
    .gte("session_date", sinceDate).order("session_date", { ascending: false })
  if (sessionError) throw sessionError
  const sessionIds = (sessions || []).map(item => item.id)
  let records: any[] = []
  if (sessionIds.length) {
    const result = await admin.from("attendance_records").select("*").in("session_id", sessionIds)
    if (result.error) throw result.error
    records = result.data || []
  }
  const recordIds = records.map(item => item.id)
  let makeups: any[] = []
  if (recordIds.length) {
    const result = await admin.from("attendance_makeups").select("*").in("attendance_record_id", recordIds)
    if (result.error) throw result.error
    makeups = result.data || []
  }
  const madeUp = new Set(makeups.map(item => item.attendance_record_id))
  const enrollmentById = new Map(enrollments.map((item: any) => [item.id, item]))
  const openAbsences = records.filter(item => item.status === "absent" && !madeUp.has(item.id))
    .map(item => ({ ...item, enrollment: enrollmentById.get(item.enrollment_id) || null }))
    .filter(item => item.enrollment)

  return {
    account: { id: account.id, professorName: account.professor_name, formation: account.formations },
    intake,
    today: localDate(),
    schedules: schedules || [], enrollments, sessions: sessions || [], records, makeups, openAbsences,
  }
}

async function listCourses() {
  const { data, error } = await admin.from("teacher_access_accounts")
    .select("id,formation_id,professor_name,active,password_configured,formations!inner(id,name,active)")
    .eq("active", true).eq("password_configured", true).eq("formations.active", true)
  if (error) throw error
  return (data || []).map((item: any) => ({
    id: item.id, formationId: item.formation_id, formationName: item.formations.name, professorName: item.professor_name,
  })).sort((a, b) => a.formationName.localeCompare(b.formationName, "fr"))
}

async function login(body: any) {
  const accountId = String(body.accountId || "")
  const password = String(body.password || "")
  if (!accountId || !password) throw new Error("LOGIN_REQUIRED")
  const { data: account } = await admin.from("teacher_access_accounts")
    .select("id,formation_id,professor_name,active,password_configured,formations!inner(id,name,active)")
    .eq("id", accountId).eq("active", true).maybeSingle()
  const { data: credentials } = account ? await admin.from("teacher_account_credentials").select("*")
    .eq("teacher_account_id", account.id).maybeSingle() : { data: null }
  if (!account || !credentials || !account.formations?.active) throw new Error("INVALID_TEACHER_LOGIN")
  if (credentials.locked_until && new Date(credentials.locked_until) > new Date()) throw new Error("TEACHER_LOCKED")

  const candidate = await passwordHash(password, credentials.password_salt)
  if (!safeEqual(candidate, credentials.password_hash)) {
    const failures = Number(credentials.failed_attempts || 0) + 1
    await admin.from("teacher_account_credentials").update({
      failed_attempts: failures >= 5 ? 0 : failures,
      locked_until: failures >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
    }).eq("teacher_account_id", account.id)
    throw new Error(failures >= 5 ? "TEACHER_LOCKED" : "INVALID_TEACHER_LOGIN")
  }
  await admin.from("teacher_account_credentials").update({ failed_attempts: 0, locked_until: null })
    .eq("teacher_account_id", account.id)
  const token = randomValue(36)
  const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString()
  const { error: sessionError } = await admin.from("teacher_access_sessions").insert({
    teacher_account_id: account.id, token_hash: await sha256(token), expires_at: expiresAt,
  })
  if (sessionError) throw sessionError
  return { token, expiresAt, context: await buildContext(account) }
}

async function saveTeacherAccount(req: Request, body: any) {
  const staff = await requireManagement(req)
  const formationId = String(body.formationId || "")
  const professorName = String(body.professorName || "").trim()
  const password = String(body.password || "")
  if (!formationId || professorName.length < 2) throw new Error("INVALID_TEACHER_ACCOUNT")
  if (password && password.length < 8) throw new Error("PASSWORD_TOO_SHORT")

  const { data: existing } = await admin.from("teacher_access_accounts").select("id,password_configured")
    .eq("formation_id", formationId).maybeSingle()
  const payload = {
    formation_id: formationId, professor_name: professorName, active: body.active !== false,
    updated_by: staff.user_id, updated_at: new Date().toISOString(),
    ...(existing ? {} : { created_by: staff.user_id }),
  }
  const accountResult = existing
    ? await admin.from("teacher_access_accounts").update(payload).eq("id", existing.id).select("*").single()
    : await admin.from("teacher_access_accounts").insert(payload).select("*").single()
  if (accountResult.error) throw accountResult.error
  const account = accountResult.data

  if (password) {
    const salt = randomValue(24)
    const hash = await passwordHash(password, salt)
    const { error } = await admin.rpc("save_teacher_password", {
      p_account_id: account.id, p_password: password, p_hash: hash,
      p_salt: salt, p_staff_id: staff.user_id,
    })
    if (error) throw new Error("PASSWORD_SAVE_FAILED")
  }
  return { ok: true }
}

async function submitAttendance(req: Request, body: any) {
  const { account } = await requireTeacher(req)
  const intake = await activeIntake()
  const scheduleId = String(body.scheduleId || "")
  const sessionDate = String(body.sessionDate || localDate())
  const { data: schedule } = await admin.from("attendance_schedules").select("*")
    .eq("id", scheduleId).eq("formation_id", account.formation_id).eq("active", true).maybeSingle()
  if (!schedule) throw new Error("INVALID_SCHEDULE")
  const weekday = new Date(`${sessionDate}T12:00:00Z`).getUTCDay() || 7
  if (weekday !== schedule.weekday) throw new Error("SCHEDULE_DATE_MISMATCH")
  const enrollments = await eligibleEnrollments(account.formation_id, intake.id)
  const eligibleIds = new Set(enrollments.map((item: any) => item.id))
  const presentIds = new Set((body.presentEnrollmentIds || []).filter((id: string) => eligibleIds.has(id)))
  const lateIds = new Set((body.lateEnrollmentIds || []).filter((id: string) => presentIds.has(id)))
  const details = body.absentDetails || {}
  const sessionPayload = {
    formation_id: account.formation_id, intake_id: intake.id, schedule_id: schedule.id,
    session_date: sessionDate, status: "held", scheduled_start: schedule.start_time,
    scheduled_end: schedule.end_time, cancel_reason: null, recorded_by_teacher_account_id: account.id,
    updated_at: new Date().toISOString(),
  }
  const { data: attendanceSession, error: upsertError } = await admin.from("attendance_sessions")
    .upsert(sessionPayload, { onConflict: "intake_id,formation_id,schedule_id,session_date" }).select("*").single()
  if (upsertError) throw upsertError
  await admin.from("attendance_records").delete().eq("session_id", attendanceSession.id)
  const rows = enrollments.map((enrollment: any) => {
    const present = presentIds.has(enrollment.id)
    const late = lateIds.has(enrollment.id)
    const detail = (late ? body.lateDetails?.[enrollment.id] : details[enrollment.id]) || {}
    const reason = ["sante", "travail", "famille", "transport", "connexion", "finance", "deplacement", "autre"].includes(detail.reasonCode) ? detail.reasonCode : null
    return {
      session_id: attendanceSession.id, enrollment_id: enrollment.id, student_id: enrollment.student_id,
      status: present ? (lateIds.has(enrollment.id) ? "late" : "present") : "absent",
      notice_status: !present && detail.notified ? "notified" : "not_notified",
      reason_code: !present || late ? reason : null,
      note: !present && detail.note ? String(detail.note).slice(0, 500) : null,
      learning_mode: enrollment.learning_mode || "presentiel",
    }
  })
  if (rows.length) {
    const { error } = await admin.from("attendance_records").insert(rows)
    if (error) throw error
  }
  return { ok: true, context: await buildContext(account) }
}

async function cancelSession(req: Request, body: any) {
  const { account } = await requireTeacher(req)
  const intake = await activeIntake()
  const scheduleId = String(body.scheduleId || "")
  const sessionDate = String(body.sessionDate || localDate())
  const { data: schedule } = await admin.from("attendance_schedules").select("*")
    .eq("id", scheduleId).eq("formation_id", account.formation_id).eq("active", true).maybeSingle()
  if (!schedule) throw new Error("INVALID_SCHEDULE")
  const { data: attendanceSession, error } = await admin.from("attendance_sessions").upsert({
    formation_id: account.formation_id, intake_id: intake.id, schedule_id: schedule.id,
    session_date: sessionDate, status: "cancelled", scheduled_start: schedule.start_time,
    scheduled_end: schedule.end_time, cancel_reason: String(body.reason || "Cours non tenu").slice(0, 200),
    recorded_by_teacher_account_id: account.id, updated_at: new Date().toISOString(),
  }, { onConflict: "intake_id,formation_id,schedule_id,session_date" }).select("id").single()
  if (error) throw error
  await admin.from("attendance_records").delete().eq("session_id", attendanceSession.id)
  return { ok: true, context: await buildContext(account) }
}

async function completeMakeups(req: Request, body: any) {
  const { account } = await requireTeacher(req)
  const context = await buildContext(account)
  const allowed = new Set(context.openAbsences.map((item: any) => item.id))
  const selected = [...new Set((body.attendanceRecordIds || []).filter((id: string) => allowed.has(id)))]
  if (!selected.length) throw new Error("NO_MAKEUP_SELECTED")
  const rows = selected.map(attendanceRecordId => ({
    attendance_record_id: attendanceRecordId, completed_on: localDate(),
    recorded_by_teacher_account_id: account.id,
  }))
  const { error } = await admin.from("attendance_makeups").upsert(rows, { onConflict: "attendance_record_id" })
  if (error) throw error
  return { ok: true, context: await buildContext(account) }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405)
  try {
    const body = await req.json().catch(() => ({}))
    switch (body.action) {
      case "list_courses": return json({ courses: await listCourses() })
      case "login": return json(await login(body))
      case "context": {
        const { account } = await requireTeacher(req)
        return json({ context: await buildContext(account) })
      }
      case "logout": {
        const token = teacherToken(req)
        if (token) await admin.from("teacher_access_sessions").update({ revoked_at: new Date().toISOString() })
          .eq("token_hash", await sha256(token)).is("revoked_at", null)
        return json({ ok: true })
      }
      case "reveal_teacher_password": return json(await revealTeacherPassword(req, body))
      case "save_teacher_account": return json(await saveTeacherAccount(req, body))
      case "submit_attendance": return json(await submitAttendance(req, body))
      case "cancel_session": return json(await cancelSession(req, body))
      case "complete_makeups": return json(await completeMakeups(req, body))
      default: return json({ error: "UNKNOWN_ACTION" }, 400)
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "ATTENDANCE_ERROR"
    const status = ["TEACHER_UNAUTHENTICATED", "TEACHER_SESSION_EXPIRED", "STAFF_UNAUTHENTICATED"].includes(code) ? 401
      : ["TEACHER_ACCESS_DISABLED", "STAFF_FORBIDDEN"].includes(code) ? 403 : 400
    return json({ error: code }, status)
  }
})
