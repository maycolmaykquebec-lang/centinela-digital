-- CENTINELA DIGITAL | Migración 001 | 2026-11-04
-- Ejecutar en un proyecto NUEVO de Supabase mediante SQL Editor.
-- El contenido pedagógico y las claves de respuestas se cargarán después de revisarse.
-- Los roles de autorización NUNCA se toman del JWT user_metadata en las políticas.

begin;

create schema if not exists centinela_private;
revoke all on schema centinela_private from public, anon, authenticated;

-- 1. Identidades institucionales
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  large_unit text not null default '',
  small_unit text not null default '',
  company text not null default '',
  category text not null default '',
  role text not null default 'tropa'
    check (role in ('tropa', 'instructor', 'admin')),
  approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_role_status_idx on public.profiles(role, approval_status);

-- Crear perfil al registrarse desde Supabase Auth.
-- 'requested_role' solo admite 'tropa' o 'instructor'; jamás 'admin'.
create or replace function public.centinela_handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
begin
  v_role := case when new.raw_user_meta_data ->> 'requested_role' = 'instructor'
                 then 'instructor' else 'tropa' end;
  insert into public.profiles
    (id, email, first_name, last_name, large_unit, small_unit,
     company, category, role, approval_status)
  values
    (new.id, coalesce(new.email, ''),
     left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 150),
     left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 150),
     left(coalesce(new.raw_user_meta_data ->> 'large_unit', ''), 200),
     left(coalesce(new.raw_user_meta_data ->> 'small_unit', ''), 200),
     left(coalesce(new.raw_user_meta_data ->> 'company', ''), 150),
     left(coalesce(new.raw_user_meta_data ->> 'category', ''), 100),
     v_role,
     case when v_role = 'instructor' then 'pending' else 'approved' end);
  return new;
end;
$$;
drop trigger if exists centinela_on_auth_user_created on auth.users;
create trigger centinela_on_auth_user_created
  after insert on auth.users for each row
  execute function public.centinela_handle_new_user();
revoke execute on function public.centinela_handle_new_user() from public, anon, authenticated;

-- Funciones de autorización: consultan datos protegidos, no metadatos editables del usuario.
create or replace function public.centinela_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles
                where id = (select auth.uid()) and role = 'admin'
                  and approval_status = 'approved');
$$;
create or replace function public.centinela_is_approved_instructor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles
                where id = (select auth.uid()) and role = 'instructor'
                  and approval_status = 'approved');
$$;

-- 2. Aulas y registro del 01 al 81
create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  code varchar(8) not null unique check (code ~ '^[A-F0-9]{8}$'),
  large_unit text not null default '',
  small_unit text not null default '',
  company text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists classrooms_instructor_idx on public.classrooms(instructor_id);

create table if not exists public.classroom_members (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  troop_number smallint not null check (troop_number between 1 and 81),
  joined_at timestamptz not null default now(),
  unique(classroom_id, user_id),
  unique(classroom_id, troop_number)
);
create index if not exists members_user_idx on public.classroom_members(user_id);

create or replace function public.centinela_owns_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.classrooms c
    join public.profiles p on p.id = c.instructor_id
    where c.id = p_class_id and c.instructor_id = (select auth.uid())
      and p.role = 'instructor' and p.approval_status = 'approved');
$$;
create or replace function public.centinela_is_member(p_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.classroom_members m
    where m.classroom_id = p_class_id and m.user_id = (select auth.uid()));
$$;
create or replace function public.centinela_is_my_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.centinela_is_approved_instructor() and exists (
    select 1 from public.classroom_members m join public.classrooms c
      on c.id = m.classroom_id
    where m.user_id = p_student_id and c.instructor_id = (select auth.uid()));
$$;

-- 3. Nueve capítulos originales, pendientes de revisión sanitaria.
create table if not exists public.chapters (
  id smallint primary key check (id between 1 and 9),
  title text not null,
  summary text not null default '',
  pdf_path text,
  pass_score smallint not null default 70 check (pass_score between 0 and 100),
  published boolean not null default true
);
insert into public.chapters(id, title, summary, pdf_path) values
 (1,'Nociones generales','Salud, política sanitaria y estilos de vida saludables.','capitulos_pdf/01_Nociones_generales.pdf'),
 (2,'Nutrición','Orientación nutricional para el centinela y la familia.','capitulos_pdf/02_Nutricion_alimentacion_saludable.pdf'),
 (3,'La pareja','Educación y prevención para la pareja y la familia.','capitulos_pdf/03_La_pareja.pdf'),
 (4,'La familia','Higiene, vacunas y prevención familiar.','capitulos_pdf/04_La_familia.pdf'),
 (5,'La niña y el niño','Cuidado y prevención en la niñez.','capitulos_pdf/05_La_nina_y_el_nino.pdf'),
 (6,'Salud mental','Bienestar emocional y prevención de la violencia.','capitulos_pdf/06_Salud_mental.pdf'),
 (7,'Discapacidad','Prevención, rehabilitación, inclusión y accesibilidad.','capitulos_pdf/07_Discapacidad.pdf'),
 (8,'Desarrollo humano','Comunidad, medio ambiente y desastres.','capitulos_pdf/08_Desarrollo_humano.pdf'),
 (9,'Medicina tradicional','Prácticas tradicionales y cuidado de la salud.','capitulos_pdf/09_Medicina_tradicional.pdf')
on conflict(id) do nothing;

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id smallint not null references public.chapters(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  content jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique(chapter_id, position)
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  chapter_id smallint not null references public.chapters(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  position integer not null check (position > 0),
  kind text not null check (kind in ('multiple_choice','matching','ordering','fill_blank')),
  prompt text not null,
  options jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique(chapter_id, position)
);
create index if not exists exercises_lesson_idx on public.exercises(lesson_id);

-- Las respuestas correctas NO se exponen por la API de React.
create table if not exists centinela_private.exercise_answers (
  exercise_id uuid primary key references public.exercises(id) on delete cascade,
  correct_answer jsonb not null
);
revoke all on centinela_private.exercise_answers from public, anon, authenticated;

create table if not exists public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key(user_id, lesson_id)
);

-- Notas y evaluaciones: SOLO funciones de servidor pueden escribir.
create table if not exists public.chapter_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chapter_id smallint not null references public.chapters(id),
  correct_count integer not null check (correct_count >= 0),
  question_count integer not null check (question_count > 0),
  score smallint not null check (score between 0 and 100),
  passed boolean not null,
  submitted_at timestamptz not null default now()
);
create index if not exists chapter_attempts_user_idx on public.chapter_attempts(user_id,chapter_id);

create table if not exists public.chapter_results (
  user_id uuid not null references public.profiles(id) on delete cascade,
  chapter_id smallint not null references public.chapters(id),
  best_score smallint not null default 0 check (best_score between 0 and 100),
  last_score smallint not null default 0 check (last_score between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  passed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,chapter_id)
);

-- Actividades para toda el aula (la selección individual es una fase posterior).
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  chapter_id smallint not null references public.chapters(id),
  instructor_id uuid not null references public.profiles(id),
  title text not null,
  instructions text not null default '',
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists assignments_class_idx on public.assignments(classroom_id);

-- Autorizar lectura del capítulo 1 y de los siguientes tras aprobar el anterior.
create or replace function public.centinela_can_access_chapter(p_chapter smallint)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and exists(select 1 from public.chapters ch where ch.id=p_chapter and ch.published)
    and (
      public.centinela_is_admin() or public.centinela_is_approved_instructor()
      or (exists(select 1 from public.profiles p where p.id=(select auth.uid())
                 and p.role='tropa' and p.approval_status='approved')
          and (p_chapter=1 or exists(
            select 1 from public.chapter_results r where r.user_id=(select auth.uid())
              and r.chapter_id = p_chapter-1 and r.passed)))
    );
$$;

-- 4. RLS en TODAS las tablas de public.
alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.exercises enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.chapter_attempts enable row level security;
alter table public.chapter_results enable row level security;
alter table public.assignments enable row level security;
alter table centinela_private.exercise_answers enable row level security;

-- Revocar permisos amplios que Supabase puede dar automáticamente a objetos nuevos.
revoke all on public.profiles, public.classrooms, public.classroom_members,
  public.chapters, public.lessons, public.exercises,
  public.lesson_progress, public.chapter_attempts, public.chapter_results,
  public.assignments from public, anon, authenticated;

grant select on public.profiles, public.classrooms, public.classroom_members,
  public.chapters, public.lessons, public.exercises,
  public.lesson_progress, public.chapter_attempts, public.chapter_results,
  public.assignments to authenticated;
grant update (first_name, last_name, large_unit, small_unit, company, category)
  on public.profiles to authenticated;
grant insert on public.assignments to authenticated;
grant update (title, instructions, chapter_id, due_at) on public.assignments to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (id=(select auth.uid()) or public.centinela_is_admin()
         or public.centinela_is_my_student(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id=(select auth.uid())) with check (id=(select auth.uid()));

create policy classrooms_read on public.classrooms for select to authenticated
  using (public.centinela_is_admin() or public.centinela_owns_class(id)
         or public.centinela_is_member(id));
create policy members_read on public.classroom_members for select to authenticated
  using (user_id=(select auth.uid()) or public.centinela_is_admin()
         or public.centinela_owns_class(classroom_id));

create policy chapters_read on public.chapters for select to authenticated
  using (published or public.centinela_is_admin());
create policy lessons_read on public.lessons for select to authenticated
  using (public.centinela_is_admin() or (published and
         public.centinela_can_access_chapter(chapter_id)));
create policy exercises_read on public.exercises for select to authenticated
  using (public.centinela_is_admin() or (published and
         public.centinela_can_access_chapter(chapter_id)));

create policy progress_read on public.lesson_progress for select to authenticated
  using (user_id=(select auth.uid()) or public.centinela_is_admin()
         or public.centinela_is_my_student(user_id));
create policy attempts_read on public.chapter_attempts for select to authenticated
  using (user_id=(select auth.uid()) or public.centinela_is_admin()
         or public.centinela_is_my_student(user_id));
create policy results_read on public.chapter_results for select to authenticated
  using (user_id=(select auth.uid()) or public.centinela_is_admin()
         or public.centinela_is_my_student(user_id));

create policy assignments_read on public.assignments for select to authenticated
  using (public.centinela_is_admin() or public.centinela_owns_class(classroom_id)
         or public.centinela_is_member(classroom_id));
create policy assignments_insert on public.assignments for insert to authenticated
  with check (instructor_id=(select auth.uid())
              and public.centinela_owns_class(classroom_id));
create policy assignments_update on public.assignments for update to authenticated
  using (instructor_id=(select auth.uid())
         and public.centinela_owns_class(classroom_id))
  with check (instructor_id=(select auth.uid())
              and public.centinela_owns_class(classroom_id));

-- 5. Procedimientos controlados de negocio.
create or replace function public.centinela_review_instructor(
  p_user_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.centinela_is_admin() then
    raise exception 'Acción reservada a administradores';
  end if;
  update public.profiles
     set approval_status=case when p_approve then 'approved' else 'rejected' end,
         approved_by=(select auth.uid()),
         approved_at=case when p_approve then now() else null end,
         updated_at=now()
   where id=p_user_id and role='instructor';
  if not found then
    raise exception 'No existe una solicitud de instructor válida';
  end if;
end;
$$;

create or replace function public.centinela_create_classroom(
  p_title text, p_large_unit text default '', p_small_unit text default '',
  p_company text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_code text;
  v_attempt integer;
begin
  if not public.centinela_is_approved_instructor() then
    raise exception 'Instructor no aprobado';
  end if;
  if length(btrim(coalesce(p_title,''))) < 3 then
    raise exception 'El nombre del aula debe tener al menos 3 caracteres';
  end if;
  for v_attempt in 1..20 loop
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    begin
      insert into public.classrooms
        (instructor_id,title,code,large_unit,small_unit,company)
      values ((select auth.uid()),btrim(p_title),v_code,
              coalesce(p_large_unit,''),coalesce(p_small_unit,''),coalesce(p_company,''))
      returning id into v_id;
      return jsonb_build_object('classroom_id',v_id,'code',v_code);
    exception when unique_violation then
      null; -- muy rara colisión de código: reintentar
    end;
  end loop;
  raise exception 'No se pudo generar un código único';
end;
$$;

create or replace function public.centinela_join_classroom(p_code text, p_number integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_class_id uuid;
begin
  if (select auth.uid()) is null or not exists(
      select 1 from public.profiles p where p.id=(select auth.uid())
        and p.role='tropa' and p.approval_status='approved') then
    raise exception 'Solo cuentas de TROPA pueden unirse a aulas';
  end if;
  if p_number is null or p_number not between 1 and 81 then
    raise exception 'Número de instruido fuera del rango 01–81';
  end if;
  select id into v_class_id from public.classrooms
    where code=upper(btrim(coalesce(p_code,''))) and active=true;
  if v_class_id is null then
    raise exception 'Código de aula inexistente o inactivo';
  end if;
  if exists(select 1 from public.classroom_members where classroom_id=v_class_id
       and user_id=(select auth.uid())) then
    raise exception 'La cuenta ya está inscrita en esta aula';
  end if;
  begin
    insert into public.classroom_members(classroom_id,user_id,troop_number)
      values (v_class_id,(select auth.uid()),p_number);
  exception when unique_violation then
    raise exception 'Este número de instruido ya está ocupado en el aula';
  end;
  return v_class_id;
end;
$$;

create or replace function public.centinela_complete_lesson(p_lesson_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_lesson public.lessons%rowtype;
begin
  if not exists(select 1 from public.profiles p
                where p.id=(select auth.uid()) and p.role='tropa') then
    raise exception 'Solo TROPA puede registrar su avance';
  end if;
  select * into v_lesson from public.lessons where id=p_lesson_id and published=true;
  if not found or not public.centinela_can_access_chapter(v_lesson.chapter_id) then
    raise exception 'Lección no disponible o capítulo bloqueado';
  end if;
  if exists (
    select 1 from public.lessons l where l.chapter_id=v_lesson.chapter_id
      and l.published=true and l.position<v_lesson.position
      and not exists(select 1 from public.lesson_progress pr
        where pr.user_id=(select auth.uid()) and pr.lesson_id=l.id)
  ) then
    raise exception 'Primero completa las lecciones anteriores';
  end if;
  insert into public.lesson_progress(user_id,lesson_id)
    values ((select auth.uid()),p_lesson_id)
  on conflict(user_id,lesson_id) do nothing;
end;
$$;

-- Envía JSONB {"uuid-pregunta": respuesta, ...}.
-- Formatos de respuesta y clave secreta:
-- multiple_choice: ["a", "c"] (orden indiferente)
-- matching: {"concepto_1":"definicion_2", ...}
-- ordering: ["paso_2", "paso_1", ...]
-- fill_blank: ["palabra 1", "palabra 2"] (comparación sin distinguir mayúsculas)
create or replace function public.centinela_submit_chapter(
  p_chapter smallint, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_total integer := 0;
  v_correct integer := 0;
  v_score smallint;
  v_pass_score smallint;
  v_passed boolean;
  v_ex record;
  v_response jsonb;
  v_ok boolean;
begin
  if v_uid is null or not exists(
      select 1 from public.profiles p where p.id=v_uid and p.role='tropa') then
    raise exception 'Solo TROPA puede rendir evaluaciones';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Las respuestas deben enviarse como objeto JSON';
  end if;
  if not public.centinela_can_access_chapter(p_chapter) then
    raise exception 'Capítulo bloqueado';
  end if;
  select pass_score into v_pass_score from public.chapters
    where id=p_chapter and published=true;
  if not found then raise exception 'Capítulo no publicado'; end if;
  if not exists(select 1 from public.lessons where chapter_id=p_chapter and published=true) then
    raise exception 'El capítulo todavía no tiene lecciones publicadas';
  end if;
  if exists(
    select 1 from public.lessons l where l.chapter_id=p_chapter and l.published=true
      and not exists(select 1 from public.lesson_progress pr
        where pr.user_id=v_uid and pr.lesson_id=l.id)
  ) then
    raise exception 'Primero completa todas las lecciones del capítulo';
  end if;
  for v_ex in
    select e.id,e.kind,k.correct_answer from public.exercises e
      join centinela_private.exercise_answers k on k.exercise_id=e.id
    where e.chapter_id=p_chapter and e.published=true order by e.position
  loop
    v_total := v_total + 1;
    v_response := p_answers -> (v_ex.id::text);
    v_ok := false;
    if v_response is not null and jsonb_typeof(v_response)=jsonb_typeof(v_ex.correct_answer) then
      if v_ex.kind='multiple_choice' and jsonb_typeof(v_response)='array' then
        v_ok := (v_response @> v_ex.correct_answer and v_ex.correct_answer @> v_response
           and jsonb_array_length(v_response)=jsonb_array_length(v_ex.correct_answer));
      elsif v_ex.kind='fill_blank' and jsonb_typeof(v_response)='array' then
        select coalesce(jsonb_agg(lower(btrim(value)) order by ordinality),'[]'::jsonb)
          into v_response from jsonb_array_elements_text(v_response) with ordinality as x(value,ordinality);
        select v_response = coalesce(jsonb_agg(lower(btrim(value)) order by ordinality),'[]'::jsonb)
          into v_ok from jsonb_array_elements_text(v_ex.correct_answer) with ordinality as x(value,ordinality);
      else
        v_ok := (v_response = v_ex.correct_answer);
      end if;
    end if;
    if v_ok then v_correct := v_correct + 1; end if;
  end loop;
  if v_total=0 then raise exception 'El capítulo no tiene evaluación publicada'; end if;
  v_score := round((100.0 * v_correct) / v_total)::smallint;
  v_passed := v_score>=v_pass_score;
  insert into public.chapter_attempts
    (user_id,chapter_id,correct_count,question_count,score,passed)
  values(v_uid,p_chapter,v_correct,v_total,v_score,v_passed);
  insert into public.chapter_results
    (user_id,chapter_id,best_score,last_score,attempt_count,passed,updated_at)
  values(v_uid,p_chapter,v_score,v_score,1,v_passed,now())
  on conflict(user_id,chapter_id) do update
    set best_score=greatest(public.chapter_results.best_score,excluded.best_score),
        last_score=excluded.last_score,
        attempt_count=public.chapter_results.attempt_count+1,
        passed=(public.chapter_results.passed or excluded.passed),
        updated_at=now();
  return jsonb_build_object('chapter',p_chapter,'correct',v_correct,
    'total',v_total,'score',v_score,'passed',v_passed,'pass_score',v_pass_score);
end;
$$;

-- Endpoints RPC: solo sesiones autenticadas.
revoke execute on function public.centinela_is_admin() from public, anon;
revoke execute on function public.centinela_is_approved_instructor() from public, anon;
revoke execute on function public.centinela_owns_class(uuid) from public, anon;
revoke execute on function public.centinela_is_member(uuid) from public, anon;
revoke execute on function public.centinela_is_my_student(uuid) from public, anon;
revoke execute on function public.centinela_can_access_chapter(smallint) from public, anon;
revoke execute on function public.centinela_review_instructor(uuid, boolean) from public, anon;
revoke execute on function public.centinela_create_classroom(text,text,text,text) from public, anon;
revoke execute on function public.centinela_join_classroom(text,integer) from public, anon;
revoke execute on function public.centinela_complete_lesson(uuid) from public, anon;
revoke execute on function public.centinela_submit_chapter(smallint,jsonb) from public, anon;

grant execute on function public.centinela_is_admin() to authenticated;
grant execute on function public.centinela_is_approved_instructor() to authenticated;
grant execute on function public.centinela_owns_class(uuid) to authenticated;
grant execute on function public.centinela_is_member(uuid) to authenticated;
grant execute on function public.centinela_is_my_student(uuid) to authenticated;
grant execute on function public.centinela_can_access_chapter(smallint) to authenticated;
grant execute on function public.centinela_review_instructor(uuid,boolean) to authenticated;
grant execute on function public.centinela_create_classroom(text,text,text,text) to authenticated;
grant execute on function public.centinela_join_classroom(text,integer) to authenticated;
grant execute on function public.centinela_complete_lesson(uuid) to authenticated;
grant execute on function public.centinela_submit_chapter(smallint,jsonb) to authenticated;

commit;

-- VERIFICACIÓN BÁSICA (consulta de solo lectura):
-- select id, title, pass_score from public.chapters order by id;
-- select schemaname, tablename, rowsecurity from pg_tables
--   where schemaname='public' and tablename in ('profiles','classrooms',
--   'classroom_members','chapters','lessons','exercises','lesson_progress',
--   'chapter_attempts','chapter_results','assignments');

-- PRIMER ADMINISTRADOR (EJECUTAR DESPUÉS DE REGISTRAR SU CUENTA POR SUPABASE AUTH):
-- update public.profiles set role='admin', approval_status='approved',
--   approved_at=now() where id=(select id from auth.users
--   where email='CAMBIAR_POR_EMAIL_DEL_ADMINISTRADOR');
-- NUNCA pongas una clave service_role en React, GitHub ni .env.local.
