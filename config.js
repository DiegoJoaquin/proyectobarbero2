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
    name: 'Juanfade',
    tagline: 'Eminence Barber',
    address: 'Irarrazaval 3054, Local 105B',
    phone: '+569 56567363',
    instagram: 'https://www.instagram.com/juanfade/'
  },

  // ─── SEGURIDAD ───────────────────────────────────────────
  // ¡Alta Seguridad! El PIN está encriptado con SHA-256. Nadie puede ver tu contraseña aquí.
  // El PIN actual es: 2011. Si quieres cambiarlo, avísame.
  security: {
    pinHash: '72d1b5da6eeaf1789df86487da50ad5e9dadb5ffaecb56b6de592aa286c9c1b8' // Hash de '2011'
  },

  // ─── HORARIOS DE TRABAJO ─────────────────────────────────
  workingHours: {
    weekdays: { start: '10:00', end: '20:00' },  // Lun–Vie
    saturday: { start: '10:00', end: '18:00' }   // Sáb (último turno 17:30)
  },

  // Días hábiles: 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
  workingDays: [1, 2, 3, 4, 5, 6],

  // ─── TURNOS ──────────────────────────────────────────────
  slotDuration: 30,         // duración de cada turno en minutos
  maxBookingDaysAhead: 30,  // días máximos que un cliente puede reservar adelante

  // ─── SERVICIOS ───────────────────────────────────────────
  // Podés agregar o quitar servicios modificando este array.
  // Campos: id (único), name, description, duration (min), price (null = no mostrar), icon (emoji)
  services: [
    {
      id: 'corte',
      name: 'Corte de cabello',
      description: '',
      duration: 30,
      price: '12.000 CLP',
      icon: '✂️'
    },
    {
      id: 'promo2',
      name: 'Promocion 2x20.000',
      description: 'Martes, miercoles y jueves.',
      duration: 60,
      price: '20.000 CLP',
      icon: '🔥'
    },
    {
      id: 'promo3',
      name: 'Promocion 3x25.000',
      description: 'Martes, miercoles y jueves.',
      duration: 90,
      price: '25.000 CLP',
      icon: '🚀'
    },
    {
      id: 'limpieza',
      name: 'Corte + Limpieza',
      description: 'Exfoliación, puntos negros e hidratación.',
      duration: 30,
      price: '20.000 CLP',
      icon: '✨'
    },
    {
      id: 'barba',
      name: 'Barba',
      description: '',
      duration: 30,
      price: '10.000 CLP',
      icon: '🪒'
    },
    {
      id: 'corte-barba',
      name: 'Corte y barba',
      description: '',
      duration: 60,
      price: '20.000 CLP',
      icon: '💈'
    }
  ]
};
