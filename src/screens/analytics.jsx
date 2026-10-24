import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, BarChart3, CalendarClock, CircleDollarSign, Search, Sparkles, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ageOf, compactMoney, money, studentName } from '@/lib/business'
import { formatNumber, localeCode, tr } from '@/lib/preferences'

const quickQueries = () => [tr('Âge','Age'),tr('Plus âgé','Oldest'),tr('Moins âgé','Youngest'),tr('Élèves par formation','Students by course'),tr('Reste à payer par formation','Balance by course'),tr('Statuts des élèves','Student statuses'),tr('Relances prévues','Scheduled follow-ups')]

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim()

function analyze(query, view, data) {
  const text = normalize(query)
  const studentsWithAge = view.students.map(student => ({ student, age: ageOf(student) })).filter(item => Number.isFinite(item.age))
  const sortedAges = [...studentsWithAge].sort((a,b)=>a.age-b.age)
  if ((text.includes('plus') && text.includes('age')) || text.includes('vieux') || text.includes('senior') || text.includes('oldest')) {
    const person=sortedAges.at(-1)
    return { kind:'person', eyebrow:tr('Extrême statistique','Statistical extreme'), title:tr('Étudiant le plus âgé','Oldest student'), metric:person?.age||0, unit:tr('ans','years'), detail:person?studentName(person.student):tr('Aucun âge renseigné','No age provided'), person:person?.student, accent:'violet' }
  }
  if ((text.includes('moins') && text.includes('age')) || text.includes('jeune') || text.includes('youngest')) {
    const person=sortedAges[0]
    return { kind:'person', eyebrow:tr('Extrême statistique','Statistical extreme'), title:tr('Étudiant le moins âgé','Youngest student'), metric:person?.age||0, unit:tr('ans','years'), detail:person?studentName(person.student):tr('Aucun âge renseigné','No age provided'), person:person?.student, accent:'teal' }
  }
  if (!text || text.includes('age')) {
    const groups = [[tr('Moins de 20','Under 20'),0,19],['20–24',20,24],['25–29',25,29],['30–34',30,34],[tr('35 et plus','35 and over'),35,200]].map(([label,min,max])=>({label,value:studentsWithAge.filter(item=>item.age>=min&&item.age<=max).length}))
    const average = studentsWithAge.length ? Math.round(studentsWithAge.reduce((sum,item)=>sum+item.age,0)/studentsWithAge.length*10)/10 : 0
    return { kind:'age', eyebrow:tr('Profil des étudiants','Student profile'), title:tr('Répartition par âge','Age distribution'), metric:average, unit:tr('ans en moyenne','average age'), detail:`${studentsWithAge.length} ${tr('âges renseignés sur','ages provided out of')} ${view.students.length} ${tr('étudiants','students')}`, groups, people:sortedAges }
  }
  if (text.includes('reste') || text.includes('raf') || text.includes('finance') || text.includes('paiement') || text.includes('balance') || text.includes('payment')) {
    const groups = data.formations.map(formation=>{const items=view.financial.filter(item=>item.accounted&&item.formation?.id===formation.id);return {label:formation.name,value:items.reduce((sum,item)=>sum+item.remaining,0),paid:items.reduce((sum,item)=>sum+item.paid,0)}}).filter(item=>item.value||item.paid).sort((a,b)=>b.value-a.value)
    return { kind:'money', eyebrow:tr('Situation financière','Financial position'), title:tr('Reste à payer par formation','Balance due by course'), metric:money(view.remaining), unit:tr('à recouvrer','to collect'), detail:`${compactMoney(view.collected)} ${tr('déjà encaissés','already collected')}`, groups }
  }
  if (text.includes('formation') || text.includes('cours') || text.includes('course')) {
    const groups = data.formations.map(formation=>({label:formation.name,value:view.activeEnrollments.filter(item=>item.formation_id===formation.id).length})).sort((a,b)=>b.value-a.value)
    return { kind:'formation', eyebrow:tr('Répartition pédagogique','Learning distribution'), title:tr('Élèves actifs par formation','Active students by course'), metric:view.activeEnrollments.length, unit:tr('dossiers actifs','active records'), detail:`${view.unclassified} ${tr('profils restent à classer','profiles remain to classify')}`, groups }
  }
  if (text.includes('statut') || text.includes('actif') || text.includes('disponible') || text.includes('suspend') || text.includes('status') || text.includes('active')) {
    const groups=[{label:tr('Actifs','Active'),value:view.students.filter(item=>item.status==='actif').length},{label:tr('Suspendus','Suspended'),value:view.students.filter(item=>item.status==='suspendu').length},{label:tr('Abandons','Withdrawn'),value:view.students.filter(item=>item.status==='abandonne').length},{label:tr('À classer','To classify'),value:view.unclassified}]
    return { kind:'status', eyebrow:tr('État des profils','Profile status'), title:tr('Statuts des étudiants','Student statuses'), metric:view.students.length, unit:tr('étudiants','students'), detail:tr('Lecture de la vague sélectionnée','Selected cohort view'), groups }
  }
  if (text.includes('relance') || text.includes('note') || text.includes('suivi') || text.includes('follow')) {
    const notes=view.notes.filter(note=>note.follow_up_on).sort((a,b)=>String(a.follow_up_on).localeCompare(String(b.follow_up_on)))
    return { kind:'followup', eyebrow:tr('Suivi administratif','Administrative follow-up'), title:tr('Relances planifiées','Scheduled follow-ups'), metric:notes.length, unit:tr('relances','follow-ups'), detail:tr('Issues des notes de suivi','From follow-up notes'), notes }
  }
  if (text.includes('inscription') || text.includes('nouveau')) {
    const groups = Array.from({length:6},(_,index)=>{const date=new Date();date.setMonth(date.getMonth()-(5-index));const value=view.students.filter(student=>{const created=new Date(student.created_at);return created.getMonth()===date.getMonth()&&created.getFullYear()===date.getFullYear()}).length;return {label:date.toLocaleDateString('fr-FR',{month:'short'}).replace('.',''),value}})
    return { kind:'trend', eyebrow:'Évolution', title:'Inscriptions par mois', metric:view.students.length, unit:'étudiants au total', detail:'Six derniers mois', groups }
  }
  return { kind:'unknown', eyebrow:tr('Recherche statistique','Statistical search'), title:tr('Je n’ai pas encore reconnu cette demande','I do not recognise this request yet'), metric:'—', unit:'', detail:tr('Essayez « âge », « plus âgé », « formation », « RAF », « statuts » ou « relances ».','Try “age”, “oldest”, “course”, “balance”, “statuses” or “follow-ups”.') }
}

export default function AnalyticsScreen({ data, view, onStudent }) {
  const defaultQuery=tr('Âge','Age')
  const [query,setQuery]=useState(defaultQuery)
  const [submitted,setSubmitted]=useState(defaultQuery)
  const result=useMemo(()=>analyze(submitted,view,data),[submitted,view,data])
  function submit(event){event.preventDefault();setSubmitted(query.trim()||defaultQuery)}
  return <div className="analytics-space"><section className="analytics-command"><div><Badge variant="info"><Sparkles/>{tr('Exploration intelligente','Smart exploration')}</Badge><h2>{tr('Posez une question.','Ask a question.')}<br/><span>{tr('Les données répondent.','The data responds.')}</span></h2><p>{tr('Un mot suffit. Les résultats utilisent uniquement les informations déjà présentes dans BEVA Gestion.','One word is enough. Results use only information already stored in BEVA Gestion.')}</p></div><form onSubmit={submit}><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={tr('Ex. âge, plus âgé, RAF par formation…','E.g. age, oldest, balance by course…')} /></label><Button>{tr('Analyser','Analyse')}<ArrowRight/></Button></form><div className="query-chips">{quickQueries().map(item=><button key={item} type="button" className={normalize(submitted)===normalize(item)?'active':''} onClick={()=>{setQuery(item);setSubmitted(item)}}>{item}</button>)}</div></section><AnimatePresence initial={false}><motion.section key={`${result.kind}-${submitted}`} className="analytics-result" initial={{opacity:0,y:7}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:.16}}><ResultHeader result={result}/><ResultVisual result={result} onStudent={onStudent} view={view}/></motion.section></AnimatePresence><section className="analytics-capabilities"><div><BarChart3/><span>{tr('Comprend les variantes','Understands variations')}</span><strong>{tr('« âge », « âges », « moyenne d’âge »','“age”, “ages”, “average age”')}</strong></div><div><Users/><span>{tr('Permet de retrouver','Lets you find')}</span><strong>{tr('les élèves derrière chaque résultat','students behind every result')}</strong></div><div><CircleDollarSign/><span>{tr('Respecte la logique','Respects the rule')}</span><strong>{tr('dossiers actifs uniquement','active records only')}</strong></div><div><CalendarClock/><span>{tr('Analyse aussi','Also analyses')}</span><strong>{tr('notes, relances et périodes','notes, follow-ups and periods')}</strong></div></section></div>
}

function ResultHeader({result}) { return <header className="analysis-head"><div><span className="section-kicker">{result.eyebrow}</span><h3>{result.title}</h3><p>{result.detail}</p></div><div className="analysis-metric"><strong>{typeof result.metric==='number'?formatNumber(result.metric,{maximumFractionDigits:1}):result.metric}</strong><span>{result.unit}</span></div></header> }

function ResultVisual({result,onStudent,view}) {
  if(result.kind==='unknown')return <div className="analysis-empty"><Search/><p>{result.detail}</p></div>
  if(result.kind==='person')return <button type="button" className={`person-spotlight ${result.accent}`} onClick={()=>result.person&&onStudent(result.person)}><span>{result.detail.split(' ').map(item=>item[0]).join('').slice(0,2)}</span><div><small>{result.title}</small><strong>{result.detail}</strong><p>{tr('Ouvrir son dossier complet','Open full record')}</p></div><ArrowRight/></button>
  if(result.kind==='followup')return <div className="analysis-list">{result.notes.map(note=>{const student=view.studentMap.get(note.student_id);return <button key={note.id} type="button" onClick={()=>onStudent(student)}><span>{new Date(`${note.follow_up_on}T12:00:00`).toLocaleDateString(localeCode(),{day:'2-digit',month:'short'})}</span><div><strong>{studentName(student)}</strong><small>{note.content}</small></div><ArrowRight/></button>})}</div>
  const groups=result.groups||[];const max=Math.max(...groups.map(item=>item.value),1);const total=groups.reduce((sum,item)=>sum+item.value,0)
  if(result.kind==='status')return <div className="status-visual"><div className="donut" style={{'--donut-progress':`${total?Math.round(groups[0].value/total*100):0}%`}}><div><strong>{total?Math.round(groups[0].value/total*100):0}%</strong><span>actifs</span></div></div><div className="status-legend">{groups.map((item,index)=><div key={item.label}><i className={`series-${index}`}/><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div>
  return <div className={`bar-visual ${result.kind==='money'?'money':''}`}>{groups.map((item,index)=><motion.div layout key={item.label} className="bar-row" initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:index*.035}}><div><strong>{item.label}</strong>{Number.isFinite(item.paid)&&<small>{money(item.paid)} {tr('versés','paid')}</small>}</div><div className="bar-track"><motion.i initial={{width:0}} animate={{width:`${Math.max(4,item.value/max*100)}%`}} transition={{duration:.55,delay:index*.04,ease:[.2,.8,.2,1]}}/></div><b>{result.kind==='money'?compactMoney(item.value):item.value}</b></motion.div>)}</div>
}
