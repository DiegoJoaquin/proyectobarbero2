/**
 * ============================================================
 *  BLADE & CO. — Configuración principal
 *  ¡EDITA ESTE ARCHIVO PRIMERO antes de publicar la app!
 * ============================================================
 *
 *  Instrucciones rápidas:
 *  1. Reemplazá TU_SUPABASE_URL y TU_SUPABASE_ANON_KEY
 *     con los valores de tu proyecto en supabase.com
 *  2. Cambiá el adminPin (PIN de acceso al panel del barbero)
 *  3. Actualizá los datos del negocio (nombre, teléfono, etc.)
 *  4. Guardá el archivo y subí la app
 * ============================================================
 */

const CONFIG = {

  // ─── SUPABASE ────────────────────────────────────────────
  // Conseguís estos valores en: supabase.com → tu proyecto → Settings → API
  supabase: {
    url: 'https://dpenxscxmeecaeywtxdz.supabase.co',        // ← pegar aquí la URL del proyecto
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZW54c2N4bWVlY2FleXd0eGR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NTQ5MTMsImV4cCI6MjA5NzIzMDkxM30._D2UiqiZeVuaR3GhGMfmz5bWdy8umaP6ugx3KlX20-w'   // ← pegar aquí la anon/public key
  },

  // ─── DATOS DEL NEGOCIO ───────────────────────────────────
  business: {
    name: 'Blade & Co.',
    tagline: 'Cortes que hablan por sí solos',
    address: 'Av. Corrientes 1234, CABA',
    phone: '+54 9 11 0000-0000',
    instagram: '@bladeandco'
  },

  // ─── SEGURIDAD ───────────────────────────────────────────
  // ¡IMPORTANTE! Cambiá este PIN antes de publicar la app.
  adminPin: '1234',

  // ─── HORARIOS DE TRABAJO ─────────────────────────────────
  workingHours: {
    weekdays: { start: '09:00', end: '19:00' },  // Lun–Vie
    saturday: { start: '09:00', end: '16:00' }   // Sáb
  },

  // Días hábiles: 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
  workingDays: [1, 2, 3, 4, 5, 6],

  // ─── TURNOS ──────────────────────────────────────────────
  slotDuration: 45,         // duración de cada turno en minutos
  maxBookingDaysAhead: 30,  // días máximos que un cliente puede reservar adelante

  // ─── SERVICIOS ───────────────────────────────────────────
  // Podés agregar o quitar servicios modificando este array.
  // Campos: id (único), name, description, duration (min), price (null = no mostrar), icon (emoji)
  services: [
    {
      id: 'corte',
      name: 'Corte Clásico',
      description: 'Corte con tijera o máquina, perfilado y terminación profesional',
      duration: 45,
      price: null,
      icon: '✂️'
    },
    {
      id: 'barba',
      name: 'Arreglo de Barba',
      description: 'Perfilado, afeitado y definición de contornos',
      duration: 30,
      price: null,
      icon: '🪒'
    },
    {
      id: 'combo',
      name: 'Combo Full',
      description: 'Corte de pelo + arreglo de barba + lavado',
      duration: 75,
      price: null,
      icon: '💈'
    },
    {
      id: 'degrade',
      name: 'Degradé / Fade',
      description: 'Corte con degradado a máquina, acabado preciso',
      duration: 45,
      price: null,
      icon: '⚡'
    }
  ]
};
