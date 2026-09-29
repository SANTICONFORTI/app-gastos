# Puly — app de gastos personales y compartidos

La app se llama **Puly** (dirección: `puly.vercel.app`). Usá ese nombre en todo lo que ve el usuario (títulos, pantallas, Wrapped, PWA). El proyecto de Supabase y el repo conservan su nombre interno `app-gastos`.

Este archivo es el brief del proyecto. Leelo completo antes de hacer cualquier cosa y respetalo en cada sesión.

Mockup visual de referencia (pantallas Personal, Grupo y Nuevo gasto):
https://claude.ai/artifact/FVGUoQdYxmeAbBNP1QRr7N

---

## Cómo trabajar conmigo

- Hablame siempre en español rioplatense. Soy principiante: explicá brevemente qué hacés y por qué, sin jerga innecesaria.
- Avanzá **etapa por etapa** (ver Hoja de ruta). No empieces una etapa nueva sin que yo lo confirme.
- Al terminar cada paso importante, dejá la app funcionando, decime cómo probarla y hacé un commit en git con un mensaje claro en español.
- **Costo cero**: no uses servicios pagos ni APIs de IA. Si algo requiere pagar, avisame antes y proponé una alternativa gratis.
- Preguntá antes de instalar dependencias grandes o cambiar el stack.
- Nunca subas claves ni secretos al repositorio: van en `.env` (incluido en `.gitignore`), con un `.env.example` sin valores reales.
- El código, nombres de variables y comentarios pueden estar en inglés; todos los textos que ve el usuario, en español (Argentina).

---

## Qué es la app

Una web app (instalable en el celular como PWA) para controlar gastos, con dos espacios bien separados:

1. **Personal**: tus gastos, solo los ves vos.
2. **Grupos**: gastos compartidos entre varias personas (depto, viaje, asado), en tiempo real, con cálculo de quién le debe a quién.

La diferencia entre Personal y Grupo tiene que ser **imposible de confundir**: cada espacio tiene su color de acento, su resplandor de fondo y una transición notoria al cambiar entre ellos.

Cada usuario puede estar en **todos los grupos que quiera**.

### Lo que la diferencia de Splitwise, Tricount y compañía

Posicionamiento: **la app de gastos hecha para Argentina**. Tres diferenciales centrales (tratarlos como prioridad de producto):

1. **Cuotas**: compras en cuotas repartidas mes a mes, con vista de lo comprometido a futuro.
2. **Eventos y modo asado sin registro**: subeventos dentro de un grupo ("Juntada casa Roberto", "Salida a boliche") y eventos sueltos, con invitados que participan por link **sin crear cuenta**.
3. **Wrapped**: resumen visual mensual y anual, pensado para compartir en historias.

Además: personal y grupos en una sola app, transparencia total (nada se borra), dólar blue y dólar tarjeta, gratis y sin publicidad.

---

## Principios no negociables

- **Nada se borra en los grupos.** Un movimiento no se elimina: se **anula**. Queda visible, tachado, con quién lo anuló, cuándo y el motivo (obligatorio). Las ediciones también quedan registradas en un historial. Esto aplica incluso a los administradores.
- **Solo los administradores** de un grupo pueden cargar, editar o anular movimientos. Los miembros ven todo en tiempo real.
- Los permisos se aplican en la base de datos (RLS de Supabase), no solo ocultando botones.
- **Sin IA y sin costos.** El análisis de gastos hormiga se hace con reglas propias.
- **Mobile first**: pensada primero para celular, pero se ve bien en cualquier pantalla.

---

## Stack

- **Frontend**: React + Vite (JavaScript).
- **Animaciones**: Framer Motion (efecto resorte, transiciones entre pantallas y espacios).
- **Gráficos**: Chart.js (con react-chartjs-2).
- **Backend**: Supabase (plan gratis): Auth, Postgres, Realtime, Storage.
- **PWA**: vite-plugin-pwa.
- **Hosting**: Vercel o Netlify (plan gratis).
- **Cotización del dólar**: DolarApi (https://dolarapi.com), gratis y sin clave. Verificar endpoints en su documentación (dólar oficial, blue, bolsa/MEP, CCL, mayorista).
- **Inflación** (para ajustar comparaciones entre meses): buscar una fuente gratuita (por ejemplo ArgentinaDatos). Verificar que esté activa antes de usarla.

---

## Funcionalidades

### Espacio Personal
- Cargar gasto: monto, moneda (ARS/USD), categoría, fecha, nota y **foto del ticket opcional** (solo se guarda como comprobante, no se lee con IA).
- Editar y anular gastos (en Personal también se anula en vez de borrar, con historial).
- Categorías con color fijo: Comida, Servicios, Transporte, Salidas, Salud, Hogar, Ropa, Otros. El usuario puede crear las suyas.
- Soporte pesos y dólares: al cargar en USD se muestra la conversión con la cotización del día, y se guarda la cotización usada en ese momento.
- Resumen del mes con el monto grande (decimales atenuados) y comparación con el mes anterior.
- Gastos fijos recurrentes (alquiler, suscripciones) que se generan solos cada mes.
- Presupuestos por categoría con aviso al acercarse al límite.
- Metas de ahorro con barra de progreso.
- Recordatorios de vencimientos de gastos fijos.
- Exportar a Excel y PDF.

### Gastos hormiga (reglas, sin IA)
- Detectar gastos chicos y frecuentes: mismo comercio o categoría, monto bajo (umbral configurable), que se repiten varias veces en el mes.
- Mostrar: cantidad de compras, total del mes y **proyección anual** ("a este ritmo son $X al año").
- Comparar con meses anteriores y destacar lo que más creció.
- Mensajes claros y concretos, en tono amable.

### Grupos
- Crear grupo con nombre (y foto opcional). Quien lo crea es admin.
- Roles: **admin** y **miembro**. Un admin puede nombrar otros admins y sacar integrantes.
- Tiempo real (Supabase Realtime): todos ven los movimientos al instante, indicador "X en línea ahora" con punto verde.
- Cargar gasto indicando quién pagó y entre quiénes se divide (partes iguales o montos distintos).
- Cálculo de deudas con **simplificación** (mínima cantidad de transferencias para quedar a mano).
- Botón **Saldar / Pagar**: registra el pago y muestra el alias/CVU de quien cobra para copiarlo.
- Historial completo de cambios y anulaciones.
- Notificaciones cuando se carga algo en el grupo.

### Cuotas
- Al cargar un gasto, opción "en cuotas": monto total o valor de cuota, cantidad de cuotas, mes de la primera cuota y tarjeta (opcional).
- Cada cuota se imputa en su mes: el resumen de cada mes cuenta solo la cuota de ese mes, no el total de la compra.
- Vista **"Comprometido a futuro"**: cuánto debés en cuotas en cada uno de los próximos meses (gráfico de barras) y qué compras lo componen.
- Indicador por compra: "cuota 3 de 12", cuántas faltan y cuándo termina. Aviso cuando una compra termina de pagarse.
- Anular una compra en cuotas anula las cuotas futuras; las ya imputadas quedan en el historial.
- Funciona en Personal y también en gastos de grupo.
- Dólar tarjeta (DolarApi) para compras en USD con tarjeta.

### Eventos (subeventos de grupo y modo asado sin registro)
- Un grupo puede tener **varios eventos** (ej. "Juntada casa Roberto", "Salida a boliche"). Cada gasto del grupo puede asignarse a un evento o quedar como gasto general.
- Cada evento tiene: nombre, fecha, participantes (un subconjunto del grupo más invitados), total, y su propio balance de quién debe a quién.
- **Cerrar evento**: queda archivado con su resumen final; sus saldos se suman al balance general del grupo para simplificar transferencias.
- **Eventos sueltos**: se pueden crear sin grupo, en segundos, para juntadas puntuales.
- **Invitados sin cuenta**: se agregan solo con un nombre. El evento tiene un **link público para compartir** (token largo, no adivinable) que abre una vista sin login con: gastos, total, cuánto le toca a cada uno y el alias/CVU para transferir.
- Desde el link, un invitado elige su nombre y toca **"Ya pagué"** → queda como **pago informado**, hasta que un admin del evento lo **confirma**. Nadie queda saldado sin confirmación.
- La vista pública es de solo lectura (salvo informar pago). Se implementa con funciones RPC `security definer` que validan el token, nunca abriendo las tablas a usuarios anónimos.
- El link se puede desactivar o renovar.
- **Reclamar lugar**: si un invitado después se registra, puede vincular su invitado a su cuenta y conservar el historial.
- Mismas reglas de siempre: nada se borra, los gastos se anulan con motivo.

### Wrapped (resumen para compartir)
- **Mensual** (se ofrece al cerrar el mes) y **anual** (en diciembre).
- Formato historia (9:16), varias láminas animadas que se pasan tocando: total del período, categoría top, gasto hormiga campeón con equivalencia ("tus cafés = 2 cuotas del alquiler"), mes más gastador, comparación ajustada por inflación, cuotas que terminaste de pagar.
- **Wrapped de grupo**: quién pagó más, quién debe más, evento más caro, gasto más raro.
- Botón para **descargar como imagen o compartir** (Web Share API), generado en el navegador sin servicios pagos.
- Mismo estilo visual de la app (azul marino, acentos, animaciones fluidas), con la marca de la app chiquita abajo para que se difunda.

### Perfiles e invitaciones
- Inicio de sesión con Google o con mail y contraseña.
- Pantalla de bienvenida al crear la cuenta: nombre para mostrar, **@usuario único** (validación en vivo de disponibilidad) y **foto de perfil** (galería o cámara, se comprime antes de subir). Sin foto: avatar con inicial y color.
- Alias/CVU opcional en el perfil para recibir pagos.
- Unirse a un grupo por: **link de invitación**, **código corto** (ej. `PLM-4829`), **QR**, o invitación por @usuario.
- El admin elige si la entrada es directa o requiere aprobación. Los links se pueden desactivar o renovar.
- Pantalla de Integrantes: foto, nombre, @usuario, rol y estado en línea. Las fotos aparecen en movimientos, deudas y la fila de avatares.

---

## Supabase: YA ESTÁ CREADO

- Proyecto: **app-gastos** (id `lugdaqxmcxafekcjjktw`, región São Paulo, plan gratis). No crear otro.
- La URL del proyecto y la clave pública (anon/publishable) se sacan del panel de Supabase (Project Settings → API) y van en `.env` como `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Ya aplicadas 8 migraciones: 01-05 (tablas, funciones/triggers, RLS, buckets de Storage y categorías por defecto + Realtime), 06 (funciones auxiliares de RLS movidas al esquema `private`, fuera de la API), 07 (cuotas: `installment_plans`, `installment_plan_history`, columnas de cuota en `expenses` y RPC `create_installment_plan`, `edit_installment_plan`, `void_installment_plan`), 08 (permisos de funciones trigger), 09 (reglas de integrantes en la base con el trigger `group_members_guard`: un admin no puede activar a nadie sin que acepte y el grupo nunca queda sin admin; RPC `leave_group(gid)`; RPC `save_group_expense(...)` que guarda gasto de grupo + división juntos y copia la división en `expenses.split_snapshot` para que el historial la registre). Desde la 06 se guardan también en `supabase/migrations/`. Antes de cambiar el esquema, revisá lo existente y creá migraciones nuevas (no edites las viejas).
- Asesor de seguridad revisado (etapa 5): quedan solo 3 avisos esperables (las RPC de invitaciones, que la app llama a propósito). Volver a correrlo después de cada migración.
- Login con Google: hay que activarlo en Authentication → Providers (requiere un cliente OAuth gratis de Google Cloud). El SMTP que trae Supabase solo manda mails a miembros del equipo: para usuarios reales, desactivar "Confirm email" o configurar un SMTP propio gratuito.
- Funciones listas para usar desde el frontend (RPC): `preview_invite(invite_code)`, `join_group_with_code(invite_code)`, `respond_group_invite(gid, accept)`, `leave_group(gid)`, `save_group_expense(...)`, `create_installment_plan(...)`, `edit_installment_plan(...)`, `void_installment_plan(...)`.
- Links de invitación: `https://puly.vercel.app/?unirse=CODIGO` (la app guarda el código aunque haya que iniciar sesión primero).
- La "protección contra contraseñas filtradas" de Supabase Auth es solo del plan pago: queda apagada a propósito.
- Triggers que ya funcionan solos: se crea el perfil al registrarse, quien crea un grupo queda admin, historial automático de cada alta/edición/anulación, y bloqueo de cambios a movimientos o pagos anulados.
- Rutas de Storage: `avatars/users/{uid}/...`, `avatars/groups/{group_id}/...`, `receipts/users/{uid}/...`, `receipts/groups/{group_id}/...`. Los tickets no se pueden reemplazar ni borrar.
- Estados de integrante: `active`, `pending` (pidió entrar, espera aprobación), `invited` (lo invitó un admin por @usuario), `removed`.

## Modelo de datos (ya creado en Supabase)

- `profiles`: id (= auth user), display_name, username (único), avatar_url, alias_cvu, created_at.
- `groups`: id, name, avatar_url, join_mode (`direct` | `approval`), created_by, created_at.
- `group_members`: group_id, user_id, role (`admin` | `member`), status (`active` | `pending` | `invited` | `removed`), joined_at.
- `group_invites`: id, group_id, code, active, expires_at, created_by.
- `categories`: id, owner_id (null = por defecto), name, color, icon.
- `expenses`: id, owner_id (si es personal), group_id (si es de grupo), paid_by, amount, currency, exchange_rate, category_id, note, receipt_url, spent_at, status (`active` | `voided`), voided_by, voided_at, void_reason, created_by, created_at.
- `expense_splits`: expense_id, user_id, amount.
- `expense_history`: expense_id, action (`created` | `edited` | `voided`), changed_by, changed_at, before (json), after (json).
- `settlements`: id, group_id, from_user, to_user, amount, currency, created_at.
- `recurring_expenses`, `budgets`, `savings_goals`: según cada etapa.

- `installment_plans` (creada en la etapa 5): compra en cuotas; cada cuota es una fila de `expenses` con `installment_plan_id` e `installment_number`, fechada en su mes. Por ahora solo personales; las de grupo llegan con la etapa 6.

**Pendiente de crear (migraciones nuevas, cuando llegue su etapa)** — propuesta, ajustable:
- Eventos: `events` (id, group_id nullable para eventos sueltos, name, date, status `open` | `closed`, created_by, share_token, share_active), `event_participants` (event_id, user_id nullable, guest_name nullable, claimed_by nullable) y `event_id` opcional en `expenses`. Los splits de evento apuntan a `event_participants` para poder incluir invitados.
- Pagos informados: estado `reported` → `confirmed` para pagos hechos desde el link público.
- Vista pública por link: funciones `security definer` que reciben el `share_token` (ej. `get_public_event(token)`, `report_guest_payment(token, participant_id, amount)`), con validaciones y límites. Nada de acceso directo de `anon` a las tablas.

Storage: bucket `avatars` (lectura para usuarios autenticados) y bucket `receipts` (privado, solo quien tiene acceso al gasto).

RLS: un usuario solo ve sus gastos personales y los de grupos donde es miembro activo; solo admins insertan/actualizan gastos de grupo; nadie puede hacer DELETE en `expenses` ni en `expense_history`.

---

## Diseño

Estilo: minimalista, oscuro, tipo Apple, con influencia de apps fintech modernas. Fluido, con buenas animaciones.

### Colores
- Fondo Personal: `#0A1428`, con resplandor radial arriba (`#1B4C7C` → `#0F2548` → `#0A1428`).
- Fondo Grupo: `#0E1230`, con resplandor radial arriba (`#3D2F86` → `#1D1B52` → `#0E1230`).
- Acento Personal: celeste `#5AC8FA` (degradé de botón `#7FD6FF` → `#3FB4EE`).
- Acento Grupo: violeta `#A78BFA` (degradé de botón `#C2AEFF` → `#9A7BF5`).
- Texto principal `#F2F5FA`; texto secundario `#A9B6CE` (Personal) / `#C3C6E4` (Grupo); decimales atenuados `#4B5D80` / `#57558F`.
- En línea: `#4ADE80`. Alerta/hormiga: `#FFB547`.
- Categorías: Comida `#5AC8FA`, Servicios `#FFB547`, Transporte `#8B93FF`, Salidas `#FF7A96`, Salud `#4ADE80`, Hogar `#F59E0B`, Ropa `#E879F9`, Otros `#8C9BBB`.

### Superficies y componentes
- **Vidrio**: fondo `rgba(255,255,255,.05)`, borde `1px rgba(255,255,255,.09)`, brillo interno superior `inset 0 1px 0 rgba(255,255,255,.07)`.
- Botones siempre redondeados completos (pastilla o círculo). Principal: degradé del acento + sombra de color. Secundario: vidrio.
- Tarjetas "chip": círculo de ícono + dos líneas de texto + flechita.
- Íconos dentro de círculos con borde sutil del color de la categoría.
- Selector Personal/Grupos tipo pastilla con el activo iluminado.
- Barra de navegación **flotante** en pastilla con botones circulares; el activo brilla con el acento. Botón **+** separado en su propio círculo con degradé.
- Montos grandes y pesados (≈44px, peso 800) con decimales atenuados.
- Movimientos anulados: tachados, atenuados, con borde punteado y el detalle de la anulación.
- Tipografía: la del sistema (SF en Apple) con Manrope como alternativa.
- Íconos: línea, trazo 2px, redondeados (por ejemplo Lucide).

### Animaciones
- Efecto resorte en todo (Framer Motion, spring suave).
- Botones que se achican levemente al tocarlos (scale ≈ 0.94).
- Entrada escalonada de tarjetas al abrir una pantalla.
- Gráficos que se dibujan al aparecer; números que cuentan al cambiar.
- Cambio Personal ↔ Grupo con deslizamiento lateral y transición de color.
- Formulario de nuevo gasto como hoja que sube desde abajo; al elegir destino, toda la hoja cambia de color.
- Respetar `prefers-reduced-motion`.

### Accesibilidad
- Botones reales (`<button>`, `<a>`), áreas táctiles de al menos 44px, `aria-label` en botones de solo ícono, buen contraste de texto.

---

## Hoja de ruta

1. **Base y diseño**: proyecto React + Vite, sistema visual (colores, componentes, animaciones), navegación entre espacios, git y GitHub.
2. **Gastos personales**: cargar, editar, anular con historial, categorías, foto opcional, ARS/USD (blue y tarjeta) con DolarApi. (Al principio los datos pueden guardarse localmente.)
3. **Cuotas**: compras en cuotas, imputación mes a mes, vista "Comprometido a futuro".
4. **Gráficos y resúmenes**: torta por categoría, comparación mensual, evolución, ajuste por inflación.
5. **Cuentas y nube**: Supabase, login, perfiles con @usuario y foto, migrar datos a la base.
6. **Grupos en tiempo real**: varios grupos por usuario, roles, invitaciones (link, código, QR, @usuario), aprobación, anulaciones con registro, división de gastos, simplificación de deudas, saldar con alias/CVU.
7. **Eventos y modo asado**: subeventos dentro de grupos, eventos sueltos, invitados sin cuenta con link público, pagos informados y confirmados, cerrar evento, reclamar lugar.
8. **Gastos hormiga**: detección con reglas, proyección anual, equivalencias, comparación entre meses.
9. **Wrapped**: resumen mensual y anual (personal y de grupo) para compartir como imagen.
10. **Extras**: metas de ahorro, gastos recurrentes, presupuestos, recordatorios, notificaciones, exportar a Excel/PDF y PWA instalable.

Deploy: el proyecto ya está conectado a Vercel (dirección principal `puly.vercel.app`; también responde `app-gastos-rosy.vercel.app`) con las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` cargadas. Cada push a `main` publica solo. Cuando la app esté online, configurar en Supabase (Authentication → URL Configuration) la dirección de Vercel como Site URL y Redirect URL.

Empezá por la **etapa 1**.
