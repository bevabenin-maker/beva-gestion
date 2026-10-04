-- Base de connaissances et traçabilité du moteur conversationnel BEVA.

create table if not exists public.wa_ai_settings (
  id boolean primary key default true check (id),
  assistant_name text not null default 'Assistant BEVA',
  tone text not null default 'Français facile, naturel, bienveillant et professionnel. Aucun emoji.',
  fallback_text text not null default 'Je transmets votre demande à l’équipe BEVA afin qu’un conseiller vous réponde personnellement ici sur WhatsApp.',
  max_history_messages integer not null default 10 check (max_history_messages between 2 and 30),
  max_answer_chars integer not null default 1200 check (max_answer_chars between 300 and 3000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.wa_ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  knowledge_key text not null unique check (knowledge_key ~ '^[a-z0-9_]+$'),
  category text not null,
  title text not null,
  content text not null check (char_length(content) between 1 and 8000),
  keywords text[] not null default '{}',
  priority smallint not null default 50 check (priority between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists wa_ai_knowledge_active_priority_idx
  on public.wa_ai_knowledge (active, priority desc, category);

drop trigger if exists wa_ai_settings_set_updated_at on public.wa_ai_settings;
create trigger wa_ai_settings_set_updated_at
before update on public.wa_ai_settings
for each row execute function public.set_updated_at();

drop trigger if exists wa_ai_knowledge_set_updated_at on public.wa_ai_knowledge;
create trigger wa_ai_knowledge_set_updated_at
before update on public.wa_ai_knowledge
for each row execute function public.set_updated_at();

alter table public.wa_ai_settings enable row level security;
alter table public.wa_ai_knowledge enable row level security;

revoke all on public.wa_ai_settings from anon, authenticated;
revoke all on public.wa_ai_knowledge from anon, authenticated;

grant select on public.wa_ai_settings to authenticated;
grant select on public.wa_ai_knowledge to authenticated;
grant update (assistant_name, tone, fallback_text, max_history_messages, max_answer_chars, updated_by)
  on public.wa_ai_settings to authenticated;
grant insert (knowledge_key, category, title, content, keywords, priority, active, updated_by)
  on public.wa_ai_knowledge to authenticated;
grant update (category, title, content, keywords, priority, active, updated_by)
  on public.wa_ai_knowledge to authenticated;
grant delete on public.wa_ai_knowledge to authenticated;

drop policy if exists wa_ai_settings_staff_read on public.wa_ai_settings;
create policy wa_ai_settings_staff_read
  on public.wa_ai_settings for select
  to authenticated
  using ((select private.current_staff_role()) is not null);

drop policy if exists wa_ai_settings_management on public.wa_ai_settings;
create policy wa_ai_settings_management
  on public.wa_ai_settings for update
  to authenticated
  using ((select private.current_staff_role()) in ('admin'::public.staff_role, 'direction'::public.staff_role))
  with check ((select private.current_staff_role()) in ('admin'::public.staff_role, 'direction'::public.staff_role));

drop policy if exists wa_ai_knowledge_staff_read on public.wa_ai_knowledge;
create policy wa_ai_knowledge_staff_read
  on public.wa_ai_knowledge for select
  to authenticated
  using ((select private.current_staff_role()) is not null);

drop policy if exists wa_ai_knowledge_management_insert on public.wa_ai_knowledge;
create policy wa_ai_knowledge_management_insert
  on public.wa_ai_knowledge for insert
  to authenticated
  with check ((select private.current_staff_role()) in ('admin'::public.staff_role, 'direction'::public.staff_role));

drop policy if exists wa_ai_knowledge_management_update on public.wa_ai_knowledge;
create policy wa_ai_knowledge_management_update
  on public.wa_ai_knowledge for update
  to authenticated
  using ((select private.current_staff_role()) in ('admin'::public.staff_role, 'direction'::public.staff_role))
  with check ((select private.current_staff_role()) in ('admin'::public.staff_role, 'direction'::public.staff_role));

drop policy if exists wa_ai_knowledge_management_delete on public.wa_ai_knowledge;
create policy wa_ai_knowledge_management_delete
  on public.wa_ai_knowledge for delete
  to authenticated
  using ((select private.current_staff_role()) in ('admin'::public.staff_role, 'direction'::public.staff_role));

insert into public.wa_ai_settings (id) values (true)
on conflict (id) do nothing;

insert into public.wa_ai_knowledge
  (knowledge_key, category, title, content, keywords, priority)
values
  ('formations', 'formations', 'Formations proposées',
   'BEVA propose cinq formations : Graphisme ; Montage vidéo ; Anglais ; Japonais ; Intelligence artificielle & Développement Web : outils et applications. La pédagogie privilégie la pratique, les projets et l’accompagnement.',
   array['formation','formations','graphisme','montage','anglais','japonais','intelligence artificielle','développement web','programme','débouché'], 100),
  ('duree_pedagogie', 'formations', 'Durée et pédagogie',
   'Les formations durent généralement 3 mois, avec deux séances de deux heures par semaine. Un 4e mois de révision est offert. Ne pas inventer le programme détaillé d’une formation.',
   array['durée','mois','séance','cours','pédagogie','révision'], 90),
  ('tarifs', 'tarifs', 'Tarifs',
   'Le tarif normal est de 180 000 FCFA, soit 60 000 FCFA par mois pendant 3 mois. L’offre des 100 premiers inscrits ramène le tarif à 90 000 FCFA, payable en trois tranches de 30 000 FCFA. La réservation coûte 15 000 FCFA et est déduite du premier mois.',
   array['tarif','prix','coût','frais','scolarité','mensualité','réservation','15000','30000','90000','180000'], 100),
  ('bourse', 'bourse', 'Éligibilité à la bourse',
   'Jusqu’à nouvelle instruction de la direction, toute personne qui demande si elle est éligible doit recevoir exactement cette information commerciale : « Après vérification, vous êtes éligible à l’offre réservée aux 100 premiers inscrits. » Ne jamais expliquer la règle interne ni dire que tous les contacts sont automatiquement éligibles.',
   array['bourse','offre','100 premiers','éligible','réduction','50 %'], 100),
  ('horaires', 'horaires', 'Horaires habituels',
   'Les cours peuvent être proposés en journée, en soirée ou le week-end selon la formation et les places disponibles. Certaines formations peuvent être suivies en ligne. Les horaires exacts d’une classe doivent être confirmés par un membre de BEVA.',
   array['horaire','heure','planning','journée','soirée','week-end','en ligne','présentiel'], 95),
  ('situation_cours', 'horaires', 'Situation actuelle des cours',
   'Toute question sur un cours aujourd’hui, demain, une annulation, la pluie, la météo, un report ou un changement exceptionnel exige une vérification humaine. Répondre qu’un membre de BEVA va vérifier et répondre ici sur WhatsApp. Ne jamais demander au contact d’appeler BEVA.',
   array['aujourd’hui','demain','pluie','météo','annulé','maintenu','reporté','changement'], 100),
  ('inscription', 'inscription', 'Inscription',
   'Lorsqu’une personne dit clairement qu’elle veut s’inscrire, rejoindre une classe, commencer ou suivre une formation, le chatbot doit afficher le parcours d’inscription. Ne pas la renvoyer vers un numéro de téléphone ou une adresse.',
   array['inscription','inscrire','rejoindre','commencer','suivre','prochaine classe','place'], 100),
  ('paiement', 'paiement', 'Paiement MTN MoMoPay',
   'Pour payer avec MTN MoMoPay, le code complet est *880*41*226927*montant#. Le nom affiché doit être CHADO 229. Après paiement, le contact envoie le justificatif dans WhatsApp. Seul un membre de BEVA peut vérifier et confirmer le paiement et l’inscription.',
   array['paiement','payer','momo','momopay','mobile money','justificatif','reçu','capture'], 100),
  ('visite_contact', 'institution', 'Adresse et visite',
   'BEVA peut recevoir les visiteurs du lundi au samedi, de 9 h à 21 h. Adresse : Atrokpocodji, ancien impôt, première rue à droite, Abomey-Calavi. Localisation : https://maps.app.goo.gl/x1sx7LD96iJitBQz5. Pour une demande de visite, un membre confirme le jour et l’heure dans WhatsApp.',
   array['adresse','localisation','visite','venir','itinéraire','Atrokpocodji','Abomey-Calavi'], 85),
  ('certificat', 'institution', 'Certificat',
   'Le certificat remis est un certificat interne de BEVA. Il ne faut pas le présenter comme un diplôme reconnu par l’État.',
   array['certificat','diplôme','reconnu','État'], 95),
  ('limites_reponse', 'regles', 'Limites des réponses automatiques',
   'Ne jamais inventer une date, un nombre de places restantes, une disponibilité, une garantie d’emploi, une validation de paiement ou une inscription définitive. Ne jamais demander un mot de passe, un code secret, un code OTP, un numéro de carte bancaire ou une pièce d’identité.',
   array['règle','sécurité','garantie','paiement confirmé','place disponible'], 100)
on conflict (knowledge_key) do nothing;

alter table public.wa_ai_requests
  add column if not exists decision_source text
    check (decision_source is null or decision_source in ('rule','ai','fallback')),
  add column if not exists validation_status text
    check (validation_status is null or validation_status in ('accepted','blocked','not_applicable')),
  add column if not exists validation_reason text,
  add column if not exists knowledge_keys text[] not null default '{}';

grant select (decision_source, validation_status, validation_reason, knowledge_keys)
  on public.wa_ai_requests to authenticated;
