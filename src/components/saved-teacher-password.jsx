import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { attendanceAdminApi } from '@/lib/attendance'
import { tr } from '@/lib/preferences'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'

export function SavedTeacherPassword({ account, revision = 0 }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const generation = useRef(0)
  // A late response must not reveal a password after navigating or hiding it.
  const hide = () => { generation.current += 1; setPassword(''); setLoading(false) }
  useEffect(() => {
    hide(); setMessage('')
    return () => { generation.current += 1 }
  }, [account?.id, revision])
  useEffect(() => {
    const visibility = () => { if (document.hidden) hide() }
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('blur', hide); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (!password) return
    const timer = window.setTimeout(hide, 30000)
    return () => window.clearTimeout(timer)
  }, [password])
  async function toggle() {
    if (password || loading) { hide(); return }
    const request = ++generation.current
    setLoading(true); setMessage('')
    try {
      const result = await attendanceAdminApi.revealTeacherPassword(account.id)
      if (request !== generation.current) return
      if (result.password) setPassword(result.password)
      else setMessage(tr('Ce mot de passe ancien ne peut pas être relu. Un administrateur ou la direction doit le redéfinir une fois.', 'This older password cannot be retrieved. An administrator or management must set it again once.'))
    } catch (error) {
      if (request === generation.current) setMessage(error.message)
    } finally { if (request === generation.current) setLoading(false) }
  }
  if (!account?.password_configured) return null
  return <div className="saved-teacher-password"><span className="text-sm font-medium">{tr('Mot de passe enregistré', 'Saved password')}</span><div className="teacher-password-field"><Input readOnly type={password ? 'text' : 'password'} value={password || '••••••••'} aria-label={tr('Mot de passe enregistré', 'Saved password')} autoComplete="off" /><Button type="button" variant="ghost" onClick={toggle} aria-pressed={Boolean(password)} aria-label={password || loading ? tr('Masquer le mot de passe enregistré', 'Hide saved password') : tr('Afficher le mot de passe enregistré', 'Show saved password')}>{password || loading ? <EyeOff/> : <Eye/>}</Button></div><small>{loading ? tr('Chargement…', 'Loading…') : tr('Masqué automatiquement après 30 secondes ou en quittant cet écran.', 'Automatically hidden after 30 seconds or when leaving this screen.')}</small>{message && <p role="status">{message}</p>}</div>
}
