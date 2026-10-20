import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { Activity, ArrowRight, Check, X } from 'lucide-react'
import { supabase, loadCoreData } from '@/lib/supabase'
import { previewData, previewUser } from '@/lib/fixtures'
import { buildViewModel } from '@/lib/business'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrandMark, MobileNav, Sidebar, Topbar } from '@/components/app-chrome'
import Dashboard from '@/screens/dashboard'
import StudentsScreen from '@/screens/students'
import PaymentsScreen from '@/screens/payments'
import AnalyticsScreen from '@/screens/analytics'
import ConfigurationScreen from '@/screens/configuration'
import { NewStudentSheet, PaymentSheet, StudentSheet } from '@/components/action-sheets'
import { cn } from '@/lib/utils'

const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'

export default function App() {
  const [session, setSession] = useState(isPreview ? { user: previewUser } : null)
  const [data, setData] = useState(isPreview ? previewData : null)
  const [loading, setLoading] = useState(!isPreview)
  const [error, setError] = useState('')
  const [section, setSection] = useState('dashboard')
  const [intakeId, setIntakeId] = useState(isPreview ? 'v2' : null)
  const [toast, setToast] = useState(null)
  const [studentSheet, setStudentSheet] = useState(null)
  const [paymentSheet, setPaymentSheet] = useState(null)
  const [newStudentOpen, setNewStudentOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [theme,setTheme]=useState(()=>localStorage.getItem('beva-theme')||'light')

  useEffect(()=>{localStorage.setItem('beva-theme',theme);document.documentElement.classList.toggle('dark',theme==='dark')},[theme])

  const showToast = useCallback((message, bad = false) => {
    setToast({ message, bad })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const refresh = useCallback(async () => {
    if (isPreview || !session?.user) return
    const next = await loadCoreData(session.user.id)
    setData(next)
    setIntakeId(current => next.intakes.some(item => item.id === current) ? current : (next.intakes.find(item => item.active)?.id || next.intakes[0]?.id || null))
  }, [session])

  useEffect(() => {
    if (isPreview) return
    let alive = true
    supabase.auth.getSession().then(({ data: authData, error: authError }) => {
      if (!alive) return
      if (authError) setError(authError.message)
      setSession(authData.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (alive) setSession(nextSession) })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (isPreview || !session?.user) return
    setLoading(true)
    loadCoreData(session.user.id).then(next => {
      if (!next.staff?.active) throw new Error('Ce compte ne dispose pas d’un accès actif à BEVA Gestion.')
      setData(next)
      setIntakeId(next.intakes.find(item => item.active)?.id || next.intakes[0]?.id || null)
    }).catch(loadError => setError(loadError.message)).finally(() => setLoading(false))
  }, [session])

  const view = useMemo(() => data && intakeId ? buildViewModel(data, intakeId) : null, [data, intakeId])

  const mutate = async ({ preview, live, success }) => {
    try {
      if (isPreview) setData(current => preview(current))
      else { const result = await live(); if (result?.error) throw result.error; await refresh() }
      showToast(success)
    } catch (mutationError) { showToast(mutationError.message || 'L’opération a échoué.', true) }
  }

  if (loading) return <LoadingScreen />
  if (!session) return <LoginScreen onError={setError} error={error} />
  if (error && !data) return <ErrorScreen error={error} />
  if (!data || !view) return <LoadingScreen />

  const shared = { data, view, intakeId, showToast }
  return <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 390, damping: 36 }}><div className={cn('beva-shell',theme==='dark'&&'dark')}>
    <Sidebar section={section} onSection={value => { setSection(value); setMobileMenu(false) }} staff={data.staff} onLogout={() => supabase.auth.signOut()} className={mobileMenu ? 'mobile-open' : ''} />
    <div className="beva-workspace"><Topbar section={section} intakes={data.intakes} intakeId={intakeId} setIntakeId={setIntakeId} onNewStudent={() => setNewStudentOpen(true)} onMenu={() => setMobileMenu(value => !value)} theme={theme} onToggleTheme={()=>setTheme(value=>value==='dark'?'light':'dark')} /><main className="beva-content"><AnimatePresence mode="wait" initial={false}><motion.div key={section} initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -7, filter: 'blur(3px)' }} transition={{ duration: .24, ease: [.2,.8,.2,1] }}>
      {section === 'dashboard' && <Dashboard {...shared} intake={data.intakes.find(item => item.id === intakeId)} onSection={setSection} />}
      {section === 'students' && <StudentsScreen {...shared} onStudent={setStudentSheet} onNew={() => setNewStudentOpen(true)} />}
      {section === 'payments' && <PaymentsScreen {...shared} onPayment={setPaymentSheet} onStudent={setStudentSheet} />}
      {section === 'analytics' && <AnalyticsScreen {...shared} onStudent={setStudentSheet} />}
      {section === 'configuration' && <ConfigurationScreen {...shared} setIntakeId={setIntakeId} onSection={setSection} />}
    </motion.div></AnimatePresence></main><MobileNav section={section} onSection={setSection} /></div>
    <NewStudentSheet open={newStudentOpen} onOpenChange={setNewStudentOpen} data={data} intakeId={intakeId} mutate={mutate} />
    <StudentSheet student={studentSheet} onClose={() => setStudentSheet(null)} data={data} view={view} mutate={mutate} onPayment={enrollment => { setStudentSheet(null); setPaymentSheet(enrollment) }} />
    <PaymentSheet enrollment={paymentSheet} onClose={() => setPaymentSheet(null)} data={data} mutate={mutate} />
    <AnimatePresence>{toast && <Toast {...toast} />}</AnimatePresence>{mobileMenu && <button type="button" className="mobile-overlay" aria-label="Fermer le menu" onClick={() => setMobileMenu(false)} />}
  </div></MotionConfig>
}

function LoadingScreen() { return <div className="grid min-h-screen place-items-center bg-[#f4f6fa]"><motion.div className="grid justify-items-center gap-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><BrandMark large /><div className="grid gap-2 text-center"><strong className="text-sm">Préparation de votre espace</strong><span className="text-xs text-muted-foreground">Synchronisation des dossiers BEVA…</span></div><motion.div className="h-1 w-32 overflow-hidden rounded-full bg-slate-200"><motion.i className="block h-full w-1/2 rounded-full bg-blue-600" animate={{ x: ['-100%','200%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} /></motion.div></motion.div></div> }

function LoginScreen({ error, onError }) {
  const [forgot, setForgot] = useState(false); const [busy, setBusy] = useState(false)
  async function submit(event) { event.preventDefault(); setBusy(true); onError(''); const form = new FormData(event.currentTarget); const email = form.get('email'); const result = forgot ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] }) : await supabase.auth.signInWithPassword({ email, password: form.get('password') }); if (result.error) onError(result.error.message); else if (forgot) onError('Un lien sécurisé a été envoyé à votre adresse e-mail.'); setBusy(false) }
  return <div className="login-v2"><section className="login-story"><BrandMark large /><div><p className="login-eyebrow">BEVA · Gestion interne</p><h1>Gérer l’essentiel.<br/><span>Comprendre le reste.</span></h1><p>Un espace unique pour suivre les étudiants, les formations et les paiements avec clarté.</p></div><small>Accès réservé au personnel autorisé</small></section><section className="login-form-wrap"><motion.form className="login-form" onSubmit={submit} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}><Badge variant="info"><Activity/> Espace sécurisé</Badge><h2>{forgot ? 'Réinitialiser le mot de passe' : 'Heureux de vous revoir'}</h2><p>{forgot ? 'Nous vous enverrons un lien de récupération.' : 'Connectez-vous pour ouvrir votre tableau de bord.'}</p><label>Adresse e-mail<input name="email" type="email" required autoComplete="email" placeholder="vous@beva.bj" /></label>{!forgot && <label>Mot de passe<input name="password" type="password" required autoComplete="current-password" /></label>}<p className={cn('min-h-5 text-xs', error?.startsWith('Un lien') ? 'text-emerald-600' : 'text-destructive')}>{error}</p><Button className="w-full" size="lg" disabled={busy}>{busy ? 'Veuillez patienter…' : forgot ? 'Envoyer le lien' : 'Se connecter'}<ArrowRight /></Button><button type="button" className="text-xs font-semibold text-primary" onClick={() => { setForgot(value => !value); onError('') }}>{forgot ? 'Retour à la connexion' : 'Mot de passe oublié ?'}</button></motion.form></section></div>
}

function ErrorScreen({ error }) { return <div className="grid min-h-screen place-items-center bg-background p-6"><div className="max-w-md rounded-3xl border bg-card p-8 text-center shadow-xl"><BrandMark /><h1 className="mt-5 text-xl font-bold">BEVA Gestion n’a pas pu démarrer</h1><p className="mt-3 text-sm text-muted-foreground">{error}</p><Button className="mt-6" onClick={() => window.location.reload()}>Réessayer</Button></div></div> }
function Toast({ message, bad }) { return <motion.div className={cn('toast-v2',bad&&'bad')} initial={{opacity:0,y:20,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:.97}}><span>{bad?<X/>:<Check/>}</span>{message}</motion.div> }
