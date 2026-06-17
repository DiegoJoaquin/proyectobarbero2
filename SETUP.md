# 🪒 Blade & Co. — Guía de configuración

Esta guía está pensada para alguien **sin conocimientos técnicos**. Seguí los pasos en orden y en 30 minutos tenés la app publicada y funcionando en el celular.

---

## Paso 1 — Crear cuenta y proyecto en Supabase (gratis)

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta gratuita (podés usar Google o GitHub).
2. Hacé clic en **"New project"**.
3. Completá:
   - **Name**: `barbería-juan` (o como quieras llamarlo)
   - **Database Password**: escribí una contraseña segura y **guardala**
   - **Region**: elegí la más cercana (ej. `South America (São Paulo)`)
4. Esperá ~1 minuto mientras se crea el proyecto.

---

## Paso 2 — Crear las tablas en Supabase

1. En tu proyecto de Supabase, hacé clic en **"SQL Editor"** (ícono de terminal en el menú izquierdo).
2. Hacé clic en **"New query"**.
3. Copiá y pegá **todo** el código de abajo:

```sql
-- Tabla de turnos
CREATE TABLE appointments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name      VARCHAR(100) NOT NULL,
  client_phone     VARCHAR(30)  NOT NULL,
  service          VARCHAR(80)  NOT NULL DEFAULT 'Corte de pelo',
  appointment_date DATE         NOT NULL,
  appointment_time TIME         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','completed','cancelled')),
  notes            TEXT,
  booking_code     VARCHAR(20),
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- Tabla de horarios bloqueados
CREATE TABLE blocked_slots (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_date  DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  reason     VARCHAR(100)
);

-- Seguridad (acceso público controlado)
ALTER TABLE appointments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read appointments"   ON appointments FOR SELECT USING (true);
CREATE POLICY "Public insert appointments" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Open update appointments"   ON appointments FOR UPDATE USING (true);
CREATE POLICY "Open delete appointments"   ON appointments FOR DELETE USING (true);
CREATE POLICY "Open blocked_slots"         ON blocked_slots FOR ALL USING (true);

-- Activar actualizaciones en tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
```

4. Hacé clic en **"Run"** (o presioná Ctrl+Enter). Debe decir "Success".

---

## Paso 3 — Copiar las credenciales

1. En el menú izquierdo, hacé clic en ⚙️ **"Project Settings"**.
2. Luego en **"API"**.
3. Copiá:
   - **Project URL** (algo como `https://xyzxyz.supabase.co`)
   - **anon public** key (una clave larga que empieza con `eyJ...`)

---

## Paso 4 — Configurar el archivo `config.js`

Abrí el archivo `config.js` con cualquier editor de texto (Bloc de notas, VS Code, etc.) y:

1. Reemplazá `TU_SUPABASE_URL` con la URL copiada en el paso anterior.
2. Reemplazá `TU_SUPABASE_ANON_KEY` con la anon key.
3. **Cambiá el PIN**: buscá `adminPin: '1234'` y cambialo por el PIN que quieras (4 dígitos).
4. Actualizá los datos del negocio (nombre, dirección, teléfono, Instagram).

Ejemplo de cómo debe quedar:

```js
supabase: {
  url:     'https://abcdefghij.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'
},
adminPin: '5819',
business: {
  name:      'Juan Cortes',
  tagline:   'Tu barbero de confianza',
  address:   'Av. Siempreviva 742',
  phone:     '+54 9 299 000-0000',
  instagram: '@juancortes'
}
```

---

## Paso 5 — Crear los íconos de la app

La app necesita dos íconos para instalarse en el celular. Podés crearlos gratis en [favicon.io](https://favicon.io) o [realfavicongenerator.net](https://realfavicongenerator.net).

Necesitás dos archivos:
- `icons/icon-192.png` (192×192 px)
- `icons/icon-512.png` (512×512 px)

Creá una carpeta llamada `icons` dentro de la carpeta del proyecto y poné los íconos ahí.

> 💡 **Tip rápido**: Si no tenés íconos, la app igual funciona, solo que al instalarla puede aparecer un ícono genérico del navegador.

---

## Paso 6 — Publicar la app gratis

Tenés dos opciones muy fáciles:

### Opción A: GitHub Pages (recomendado, gratis)

1. Creá una cuenta en [github.com](https://github.com) si no tenés.
2. Creá un repositorio nuevo (hacé clic en el "+" → "New repository").
3. Subí todos los archivos del proyecto.
4. Ve a **Settings** → **Pages** → **Source**: elegí `main` y la carpeta `/root`.
5. GitHub te dará una URL como `https://tu-usuario.github.io/tu-repo/`.

### Opción B: Netlify (más fácil todavía)

1. Entrá a [netlify.com](https://netlify.com) y creá una cuenta gratis.
2. En el dashboard, buscá el área de **"Sites"** y arrastrá la **carpeta entera** del proyecto.
3. Netlify la publica automáticamente con una URL como `https://nombre-random.netlify.app`.
4. Podés cambiar el nombre de la URL en Netlify → Site settings → Site name.

---

## Paso 7 — Instalar como app en el celular

### Android (Chrome)
1. Abrí la URL de tu app en **Chrome**.
2. Tocá los tres puntos (⋮) arriba a la derecha.
3. Tocá **"Agregar a pantalla de inicio"** → **"Agregar"**.
4. ¡Listo! Aparece como una app en tu pantalla de inicio.

### iPhone / iPad (Safari)
1. Abrí la URL en **Safari** (no Chrome).
2. Tocá el ícono de **compartir** (cuadrado con flecha hacia arriba).
3. Deslizá hacia abajo y tocá **"Agregar a pantalla de inicio"**.
4. Poné un nombre y tocá **"Agregar"**.

---

## Paso 8 — Acceder al panel del barbero

1. Abrí `tu-url/admin.html` en el navegador.
2. Ingresá el PIN que configuraste en `config.js`.
3. ¡Listo! Podés ver y gestionar los turnos.

> 🔒 **Consejo de seguridad**: Cambiá el PIN por defecto (`1234`) antes de publicar la app.

---

## ⚠️ Advertencia importante sobre Supabase gratuito

El plan gratuito de Supabase **pausa tu base de datos después de 7 días de inactividad** (sin que nadie reserve ni visite la app).

Si la app deja de funcionar después de un tiempo sin uso:
1. Entrá a [supabase.com](https://supabase.com).
2. Abrí tu proyecto.
3. Hacé clic en **"Restore project"** (o "Resume project").
4. Esperá ~1 minuto y volvé a funcionar.

Para evitar esto, podés visitar la app al menos una vez por semana, o usar un servicio como [UptimeRobot](https://uptimerobot.com) (gratuito) para hacer un ping diario a tu URL.

---

## 🆘 Problemas frecuentes

| Problema | Solución |
|---|---|
| La app dice "Modo demo" | Las credenciales en `config.js` no están configuradas. Revisá el Paso 3 y 4. |
| El calendario no muestra horarios | Verificá que las tablas de Supabase se crearon correctamente (Paso 2). |
| El PIN no funciona | Verificá el valor de `adminPin` en `config.js`. |
| No puedo instalar como app | Asegurate de usar Chrome en Android o Safari en iPhone. |
| La app no carga | Verificá que todos los archivos están subidos (incluido `config.js`). |

---

## 📁 Estructura de archivos

```
tu-proyecto/
├── index.html      ← Página del cliente
├── admin.html      ← Panel del barbero
├── style.css       ← Todo el diseño
├── app.js          ← Lógica del cliente
├── admin.js        ← Lógica del panel
├── config.js       ← ⭐ EDITAR ESTE ARCHIVO PRIMERO
├── manifest.json   ← Para instalar como app
├── sw.js           ← Funcionalidad offline
├── SETUP.md        ← Esta guía
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

*¿Necesitás ayuda? Contactá al desarrollador que configuró esta app para vos.* 🚀
