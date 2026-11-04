# CENTINELA DIGITAL — Base de datos, primera migración

## 1. Antes de ejecutarla

- Esta migración fue preparada para un **proyecto nuevo** de Supabase. No ejecutar sobre una base existente sin revisar objetos y datos.
- Mantener el proyecto y el repositorio privados para las pruebas institucionales.
- No registrar datos personales reales de TROPA hasta revisar autorización, privacidad y ubicación del alojamiento.
- El valor **70/100** es un umbral **provisional** de aprobación, configurable por capítulo.
- Los contenidos de los nueve capítulos se han registrado únicamente por título y ruta del PDF. Las lecciones, ejercicios y respuestas se cargarán después de verificar el contenido sanitario.

## 2. Guardar en GitHub

1. Abrir la carpeta local de `centinela-digital` en Visual Studio Code.
2. Crear la ruta `supabase/migrations/` si no existe.
3. Copiar a esa ruta el archivo `20261104_001_initial_schema.sql`.
4. Al terminar de verificar en Supabase, subir los cambios:

```powershell
git add supabase/migrations/20261104_001_initial_schema.sql
git commit -m "Crear esquema inicial de Supabase para Centinela Digital"
git push origin main
```

## 3. Crear tablas en Supabase

1. Abrir el proyecto `centinela-digital` en https://supabase.com/dashboard.
2. Menú lateral **SQL Editor > New query**.
3. Abrir el archivo `.sql` con VS Code, copiar todo (`Ctrl + A`, `Ctrl + C`) y pegar en SQL Editor.
4. Pulsar **Run**. Esperar el mensaje de ejecución satisfactoria; si aparece error, registrar el error exacto y **no ejecutar cambios manuales**.

## 4. Verificaciones de solo lectura

Ejecutar por separado en **SQL Editor**:

```sql
select count(*) as capitulos from public.chapters;
```

Resultado esperado: **9**.

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles','classrooms','classroom_members','chapters','lessons',
    'exercises','lesson_progress','chapter_attempts','chapter_results','assignments'
  )
order by tablename;
```

Resultado esperado: **10 filas con `rowsecurity = true`**.

```sql
select count(*) as lecciones_publicadas from public.lessons where published;
select count(*) as ejercicios_publicados from public.exercises where published;
```

Resultado esperado: **0** y **0** hasta crear y validar contenido educativo.

## 5. Registro y aprobación (posterior)

- Crear usuarios mediante **Supabase Auth** (no guardar contraseñas en `public.profiles`).
- El formulario React enviará `options.data` con `requested_role: 'tropa'` o `'instructor'`, y datos `first_name`, `last_name`, `large_unit`, `small_unit`, `company`, `category`.
- El trigger crea el perfil. Las cuentas de instructor quedan `pending`.
- Para crear el **primer administrador**, registrar antes su cuenta normal y ejecutar **una sola vez**, en SQL Editor, sustituyendo el correo:

```sql
update public.profiles
set role = 'admin', approval_status = 'approved', approved_at = now()
where id = (select id from auth.users where email = 'ADMINISTRADOR@EJEMPLO.COM');
```

- La aprobación de instructores desde el futuro panel administrativo usará la función RPC `centinela_review_instructor`.
- Las aulas se crean con `centinela_create_classroom`. La tropa se une con `centinela_join_classroom`. El código de aula será de 8 caracteres.
- Las notas se calculan mediante `centinela_submit_chapter`, **no** mediante inserciones directas desde el navegador.

## 6. Pendiente antes del uso institucional

- Pruebas RLS con cuentas separadas (administrador, instructor pendiente/aprobado, tropa de otra aula).
- Prueba de calificación real, límites de intentos/velocidad y registro auditable.
- Revisión sanitaria, licencias de PDF e imágenes y aprobación institucional de tratamiento de datos.
- Revisar en Supabase Auth las URL de redirección antes de conectar React.
- No subir `.env.local`, claves secretas ni credenciales de base de datos al repositorio.
