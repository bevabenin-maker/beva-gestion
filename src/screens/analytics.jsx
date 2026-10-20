import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, BarChart3, CalendarClock, CircleDollarSign, Search, Sparkles, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ageOf, compactMoney, money, studentName } from '@/lib/business'

const quickQueries = ['Âge', 'Plus âgé', 'Moins âgé', 'Élèves par formation', 'Reste à payer par formation', 'Statuts des élèves', 'Relances prévues']

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim()

function analyze(query, view, data) {
  const text = normalize(query)
  const studentsWithAge = view.students.map(student => ({ student, age: ageOf(student) })).filter(item => Number.isFinite(item.age))
  const sortedAges = [...studentsWithAge].sort((a,b)=>a.age-b.age)
  if ((text.includes('plus') && text.includes('age')) || text.includes('vieux') || text.includes('senior')) {
    const person=sortedAges.at(-1)
    return { kind:'person', eyebrow:'Extrême statistique', title:'Étudiant le plus âgé', metric:person?.age||0, unit:'ans', detail:person?studentName(person.student):'Aucun âge renseigné', person:person?.student, accent:'violet' }
  }
  if ((text.includes('moins') && text.includes('age')) || text.includes('jeune')) {
    const person=sortedAges[0]
    return { kind:'person', eyebrow:'Extrême statistique', title:'Étudiant le moins âgé', metric:person?.age||0, unit:'ans', detail:person?studentName(person.student):'Aucun âge renseigné', person:person?.student, accent:'teal' }
  }
  if (!text || text.includes('age')) {
    const groups = [['Moins de 20',0,19],['20–24',20,24],['25–29',25,29],['30–34',30,34],['35 et plus',35,200]].map(([label,min,max])=>({label,value:studentsWithAge.filter(item=>item.age>=min&&item.age<=max).length}))
    const average = studentsWithAge.length ? Math.round(studentsWithAge.reduce((sum,item)=>sum+item.age,0)/studentsWithAge.length*10)/10 : 0
    return { kind:'age', eyebrow:'Profil des étudiants', title:'Répartition par âge', metric:average, unit:'ans en moyenne', detail:`${studentsWithAge.length} âges renseignés sur ${view.students.length} étudiants`, groups, people:sortedAges }
  }
  if (text.includes('reste') || text.includes('raf') || text.includes('finance') || text.includes('paiement')) {
    const groups = data.formations.map(formation=>{const items=view.financial.filter(item=>item.accounted&&item.formation?.id===formation.id);return {label:formation.name,value:items.reduce((sum,item)=>sum+item.remaining,0),paid:items.reduce((sum,item)=>sum+item.paid,0)}}).filter(item=>item.value||item.paid).sort((a,b)=>b.value-a.value)
    return { kind:'money', eyebrow:'Situation financière', title:'Reste à payer par formation', metric:view.remaining, unit:'FCFA à recouvrer', detail:`${compactMoney(view.collected)} FCFA déjà encaissés`, groups }
  }
  if (text.includes('formation') || text.includes('cours')) {
    const groups = data.formations.map(formation=>({label:formation.name,value:view.activeEnrollments.filter(item=>item.formation_id===formation.id).length})).sort((a,b)=>b.value-a.value)
    return { kind:'formation', eyebrow:'Répartition pédagogique', title:'Élèves actifs par formation', metric:view.activeEnrollments.length, unit:'dossiers actifs', detail:`${view.unclassified} profils restent à classer`, groups }
  }
  if (text.includes('statut') || text.includes('actif') || text.includes('disponible') || text.includes('suspend')) {
    const groups=[{label:'Actifs',value:view.students.filter(item=>item.status==='actif').length},{label:'Suspendus',value:view.students.filter(item=>item.status==='suspendu').length},{label:'Abandons',value:view.students.filter(item=>item.status==='abandonne').length},{label:'À classer',value:view.unclassified}]
    return { kind:'status', eyebrow:'État des profils', title:'Statuts des étudiants', metric:view.students.length, unit:'étudiants', detail:'Lecture de la vague sélectionnée', groups }
  }
  if (text.includes('relance') || text.includes('note') || text.includes('suivi')) {
    const notes=view.notes.filter(note=>note.follow_up_on).sort((a,b)=>String(a.follow_up_on).localeCompare(String(b.follow_up_on)))
    return { kind:'followup', eyebrow:'Suivi administratif', title:'Relances planifiées', metric:notes.length, unit:'relances', detail:'Issues des notes de suivi', notes }
  }
  if (text.includes('inscription') || text.includes('nouveau')) {
    const groups = Array.from({length:6},(_,index)=>{const date=new Date();date.setMonth(date.getMonth()-(5-index));const value=view.students.filter(student=>{const created=new Date(student.created_at);return created.getMonth()===date.getMonth()&&created.getFullYear()===date.getFullYear()}).length;return {label:date.toLocaleDateString('fr-FR',{month:'short'}).replace('.',''),value}})
    return { kind:'trend', eyebrow:'Évolution', title:'Inscriptions par mois', metric:view.students.length, unit:'étudiants au total', detail:'Six derniers mois', groups }
  }
  return { kind:'unknown', eyebrow:'Recherche statistique', title:'Je n’ai pas encore reconnu cette demande', metric:'—', unit:'', detail:'Essayez « âge », « plus âgé », « formation », « RAF », « statuts » ou « relances ».' }
}

export default function AnalyticsScreen({ data, view, onStudent }) {
  const [query,setQuery]=useState('Âge')
  const [submitted,setSubmitted]=useState('Âge')
  const result=useMemo(()=>analyze(submitted,view,data),[submitted,view,data])
  function submit(event){event.preventDefault();setSubmitted(query.trim()||'Âge')}
  return <div className="analytics-space"><section className="analytics-command"><div><Badge variant="info"><Sparkles/>Exploration intelligente</Badge><h2>Posez une question.<br/><span>Les données répondent.</span></h2><p>Un mot suffit. Les résultats utilisent uniquement les informations déjà présentes dans BEVA Gestion.</p></div><form onSubmit={submit}><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Ex. âge, plus âgé, RAF par formation…" /></label><Button>Analyser<ArrowRight/></Button></form><div className="query-chips">{quickQueries.map(item=><button key={item} type="button" className={normalize(submitted)===normalize(item)?'active':''} onClick={()=>{setQuery(item);setSubmitted(item)}}>{item}</button>)}</div></section><AnimatePresence mode="wait" initial={false}><motion.section key={`${result.kind}-${submitted}`} className="analytics-result" initial={{opacity:0,y:10,filter:'blur(4px)'}} animate={{opacity:1,y:0,filter:'blur(0)'}} exit={{opacity:0,y:-8,filter:'blur(3px)'}} transition={{duration:.25}}><ResultHeader result={result}/><ResultVisual result={result} onStudent={onStudent} view={view}/></motion.section></AnimatePresence><section className="analytics-capabilities"><div><BarChart3/><span>Comprend les variantes</span><strong>« âge », « âges », « moyenne d’âge »</strong></div><div><Users/><span>Permet de retrouver</span><strong>les élèves derrière chaque résultat</strong></div><div><CircleDollarSign/><span>Respecte la logique</span><strong>dossiers actifs uniquement</strong></div><div><CalendarClock/><span>Analyse aussi</span><strong>notes, relances et périodes</strong></div></section></div>
}

function ResultHeader({result}) { return <header className="analysis-head"><div><span className="section-kicker">{result.eyebrow}</span><h3>{result.title}</h3><p>{result.detail}</p></div><div className="analysis-metric"><strong>{typeof result.metric==='number'?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(result.metric):result.metric}</strong><span>{result.unit}</span></div></header> }

function ResultVisual({result,onStudent,view}) {
  if(result.kind==='unknown')return <div className="analysis-empty"><Search/><p>{result.detail}</p></div>
  if(result.kind==='person')return <button type="button" className={`person-spotlight ${result.accent}`} onClick={()=>result.person&&onStudent(result.person)}><span>{result.detail.split(' ').map(item=>item[0]).join('').slice(0,2)}</span><div><small>{result.title}</small><strong>{result.detail}</strong><p>Ouvrir son dossier complet</p></div><ArrowRight/></button>
  if(result.kind==='followup')return <div className="analysis-list">{result.notes.map(note=>{const student=view.studentMap.get(note.student_id);return <button key={note.id} type="button" onClick={()=>onStudent(student)}><span>{new Date(`${note.follow_up_on}T12:00:00`).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</span><div><strong>{studentName(student)}</strong><small>{note.content}</small></div><ArrowRight/></button>})}</div>
  const groups=result.groups||[];const max=Math.max(...groups.map(item=>item.value),1);const total=groups.reduce((sum,item)=>sum+item.value,0)
  if(result.kind==='status')return <div className="status-visual"><div className="donut" style={{'--donut-progress':`${total?Math.round(groups[0].value/total*100):0}%`}}><div><strong>{total?Math.round(groups[0].value/total*100):0}%</strong><span>actifs</span></div></div><div className="status-legend">{groups.map((item,index)=><div key={item.label}><i className={`series-${index}`}/><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div>
  return <div className={`bar-visual ${result.kind==='money'?'money':''}`}>{groups.map((item,index)=><motion.div layout key={item.label} className="bar-row" initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:index*.035}}><div><strong>{item.label}</strong>{Number.isFinite(item.paid)&&<small>{money(item.paid)} versés</small>}</div><div className="bar-track"><motion.i initial={{width:0}} animate={{width:`${Math.max(4,item.value/max*100)}%`}} transition={{duration:.55,delay:index*.04,ease:[.2,.8,.2,1]}}/></div><b>{result.kind==='money'?`${compactMoney(item.value)} FCFA`:item.value}</b></motion.div>)}</div>
}
