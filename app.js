/**
 * ============================================================
 *  BLADE & CO. — app.js  (lógica del cliente)
 * ============================================================
 *  Funcionalidades:
 *  - Detección de modo Supabase vs. modo demo (localStorage)
 *  - Wizard de 3 pasos: servicio → fecha/hora → datos + confirmar
 *  - Calendario personalizado
 *  - Carga de turnos disponibles (excluyendo ocupados y bloqueados)
 *  - Generación de código de reserva
 *  - Sistema de toasts
 *  - Registro de Service Worker para PWA
 * ============================================================
 */

// ────────────────────────────────────────────────────────────
//  INICIALIZACIÓN
// ────────────────────────────────────────────────────────────

/** ¿Están configuradas las credenciales de Supabase? */
const DEMO_MODE = (
  CONFIG.supabase.url     === 'TU_SUPABASE_URL' ||
  CONFIG.supabase.anonKey === 'TU_SUPABASE_ANON_KEY'
);

/** Cliente de Supabase (null en modo demo) */
let supabase = null;
if (!DEMO_MODE) {
  try {
    supabase = window.supabase.createClient(
      CONFIG.supabase.url,
      CONFIG.supabase.anonKey
    );
  } catch (e) {
    console.error('Error al inicializar Supabase. Verificá las credenciales en config.js.', e);
    // La app continúa en modo demo
  }
}

// ────────────────────────────────────────────────────────────
//  ESTADO GLOBAL DEL WIZARD
// ────────────────────────────────────────────────────────────
const booking = {
  service:  null,   // objeto de CONFIG.services
  date:     null,   // string 'YYYY-MM-DD'
  time:     null,   // string 'HH:MM'
  name:     '',
  phone:    '',
  notes:    ''
};

/** Mes que muestra el calendario (Date con día=1) */
let calendarMonth = new Date();
calendarMonth.setDate(1);

// ────────────────────────────────────────────────────────────
//  DOM — REFERENCIAS
// ────────────────────────────────────────────────────────────
const domRefs = {
  demoBanner:       document.getElementById('demo-banner'),
  bookingModal:     document.getElementById('booking-modal'),
  btnOpenBooking:   document.getElementById('btn-open-booking'),
  btnCloseBooking:  document.getElementById('btn-close-booking'),

  // Pasos
  step1:            document.getElementById('step-1'),
  step2:            document.getElementById('step-2'),
  step3:            document.getElementById('step-3'),
  stepSuccess:      document.getElementById('step-success'),

  // Indicadores del wizard
  stepInd1:         document.getElementById('step-indicator-1'),
  stepInd2:         document.getElementById('step-indicator-2'),
  stepInd3:         document.getElementById('step-indicator-3'),
  wline1:           document.getElementById('wline-1'),
  wline2:           document.getElementById('wline-2'),

  // Grids de tarjetas
  serviceCardsGrid: document.getElementById('service-cards-grid'),
  servicesPreview:  document.getElementById('services-preview-grid'),

  // Botones de navegación
  btnStep1Next:     document.getElementById('btn-step1-next'),
  btnStep2Back:     document.getElementById('btn-step2-back'),
  btnStep2Next:     document.getElementById('btn-step2-next'),
  btnStep3Back:     document.getElementById('btn-step3-back'),
  btnConfirm:       document.getElementById('btn-confirm'),
  btnDone:          document.getElementById('btn-done'),

  // Calendario
  calPrev:          document.getElementById('cal-prev'),
  calNext:          document.getElementById('cal-next'),
  calMonthLabel:    document.getElementById('cal-month-label'),
  calDays:          document.getElementById('cal-days'),

  // Slots
  slotsSection:     document.getElementById('slots-section'),
  slotsDateLabel:   document.getElementById('slots-date-label'),
  slotsLoading:     document.getElementById('slots-loading'),
  slotsGrid:        document.getElementById('slots-grid'),

  // Resumen paso 3
  sumService:       document.getElementById('sum-service'),
  sumDate:          document.getElementById('sum-date'),
  sumTime:          document.getElementById('sum-time'),

  // Formulario paso 3
  inputName:        document.getElementById('input-name'),
  inputPhone:       document.getElementById('input-phone'),
  inputNotes:       document.getElementById('input-notes'),

  // Pantalla de éxito
  bookingCodeValue: document.getElementById('booking-code-value'),
  successService:   document.getElementById('success-service'),
  successDate:      document.getElementById('success-date'),
  successTime:      document.getElementById('success-time'),

  // Toasts
  toastContainer:   document.getElementById('toast-container'),

  // Info del negocio
  businessName:     document.getElementById('business-name'),
  businessTagline:  document.getElementById('business-tagline'),
  businessAddress:  document.getElementById('business-address'),
  businessPhone:    document.getElementById('business-phone'),
  businessInstagram: document.getElementById('business-instagram'),
};

// ────────────────────────────────────────────────────────────
//  ARRANQUE
// ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  applyBusinessInfo();
  renderServicesPreview();
  renderServiceCards();
  initCalendar();
  bindEvents();

  if (DEMO_MODE) {
    domRefs.demoBanner.classList.add('visible');
    document.body.classList.add('demo-mode');
  }

  registerServiceWorker();
});

// ────────────────────────────────────────────────────────────
//  DATOS DEL NEGOCIO
// ────────────────────────────────────────────────────────────

function applyBusinessInfo() {
  const b = CONFIG.business;
  if (domRefs.businessName)     domRefs.businessName.textContent     = b.name;
  if (domRefs.businessTagline)  domRefs.businessTagline.textContent  = b.tagline;
  if (domRefs.businessAddress)  domRefs.businessAddress.textContent  = b.address;
  if (domRefs.businessPhone) {
    domRefs.businessPhone.textContent = b.phone;
    domRefs.businessPhone.href = `tel:${b.phone.replace(/\s/g,'')}`;
  }
  if (domRefs.businessInstagram) domRefs.businessInstagram.textContent = b.instagram;
  document.title = `${b.name} — Reservá tu turno`;
}

// ────────────────────────────────────────────────────────────
//  TARJETAS DE SERVICIO
// ────────────────────────────────────────────────────────────

/** Renderiza la grilla de servicios en el hero (decorativa, sin selección) */
function renderServicesPreview() {
  const grid = domRefs.servicesPreview;
  if (!grid) return;
  grid.innerHTML = CONFIG.services.map(s => `
    <div class="service-card animate-up" role="listitem" aria-label="${s.name}">
      <span class="service-icon" aria-hidden="true">${s.icon}</span>
      <div class="service-name">${s.name}</div>
      <div class="service-description">${s.description}</div>
      <div class="service-duration" aria-label="${s.duration} minutos">⏱ ${s.duration} min</div>
    </div>
  `).join('');
}

/** Renderiza las tarjetas del paso 1 del wizard */
function renderServiceCards() {
  const grid = domRefs.serviceCardsGrid;
  if (!grid) return;
  grid.innerHTML = CONFIG.services.map(s => `
    <div
      class="service-card"
      data-service-id="${s.id}"
      role="option"
      aria-selected="false"
      tabindex="0"
      aria-label="${s.name}: ${s.description}, ${s.duration} minutos"
    >
      <div class="service-check" aria-hidden="true">✓</div>
      <span class="service-icon" aria-hidden="true">${s.icon}</span>
      <div class="service-name">${s.name}</div>
      <div class="service-description">${s.description}</div>
      <div class="service-duration">⏱ ${s.duration} min</div>
    </div>
  `).join('');

  // Eventos de click/teclado en cada tarjeta
  grid.querySelectorAll('.service-card').forEach(card => {
    const selectCard = () => {
      grid.querySelectorAll('.service-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-selected', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-selected', 'true');
      const sid = card.dataset.serviceId;
      booking.service = CONFIG.services.find(s => s.id === sid);
      domRefs.btnStep1Next.disabled = false;
    };

    card.addEventListener('click', selectCard);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(); }
    });
  });
}

// ────────────────────────────────────────────────────────────
//  MODAL — ABRIR / CERRAR
// ────────────────────────────────────────────────────────────

function openBookingModal() {
  resetWizard();
  domRefs.bookingModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  domRefs.bookingModal.focus();
}

function closeBookingModal() {
  domRefs.bookingModal.classList.remove('active');
  document.body.style.overflow = '';
}

function resetWizard() {
  // Resetear estado
  booking.service = null;
  booking.date    = null;
  booking.time    = null;
  booking.name    = '';
  booking.phone   = '';
  booking.notes   = '';

  // Mostrar solo paso 1
  showStep(1);

  // Limpiar selecciones
  domRefs.serviceCardsGrid.querySelectorAll('.service-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-selected', 'false');
  });
  domRefs.btnStep1Next.disabled = true;
  domRefs.btnStep2Next.disabled = true;
  domRefs.inputName.value  = '';
  domRefs.inputPhone.value = '';
  domRefs.inputNotes.value = '';
  domRefs.slotsSection.style.display = 'none';
  domRefs.slotsGrid.innerHTML = '';

  // Resetear mes del calendario al mes actual
  calendarMonth = new Date();
  calendarMonth.setDate(1);
  renderCalendar();
}

// ────────────────────────────────────────────────────────────
//  WIZARD — NAVEGACIÓN DE PASOS
// ────────────────────────────────────────────────────────────

/** Muestra el paso indicado y actualiza la barra de progreso */
function showStep(step) {
  // Ocultar todos los pasos
  [domRefs.step1, domRefs.step2, domRefs.step3, domRefs.stepSuccess].forEach(el => {
    el.style.display = 'none';
  });

  // Actualizar indicadores del wizard
  [1, 2, 3].forEach(n => {
    const ind = document.getElementById(`step-indicator-${n}`);
    ind.classList.remove('active', 'done');
    ind.setAttribute('aria-selected', 'false');
    if (n < step) {
      ind.classList.add('done');
    } else if (n === step) {
      ind.classList.add('active');
      ind.setAttribute('aria-selected', 'true');
    }
  });

  // Actualizar líneas del wizard
  domRefs.wline1.classList.toggle('done', step > 1);
  domRefs.wline2.classList.toggle('done', step > 2);

  // Mostrar el paso correspondiente
  if (step === 1)          { domRefs.step1.style.display = 'block'; }
  else if (step === 2)     { domRefs.step2.style.display = 'block'; }
  else if (step === 3)     { domRefs.step3.style.display = 'block'; populateSummary(); }
  else if (step === 'ok')  { domRefs.stepSuccess.style.display = 'block'; }
}

/** Rellena el resumen del paso 3 */
function populateSummary() {
  domRefs.sumService.textContent = booking.service?.name ?? '–';
  domRefs.sumDate.textContent    = formatDate(booking.date);
  domRefs.sumTime.textContent    = booking.time ?? '–';
}

// ────────────────────────────────────────────────────────────
//  CALENDARIO
// ────────────────────────────────────────────────────────────

function initCalendar() {
  renderCalendar();
  domRefs.calPrev.addEventListener('click', () => {
    calendarMonth.setMonth(calendarMonth.getMonth() - 1);
    renderCalendar();
  });
  domRefs.calNext.addEventListener('click', () => {
    calendarMonth.setMonth(calendarMonth.getMonth() + 1);
    renderCalendar();
  });
}

/** Renderiza el calendario del mes actual en calendarMonth */
function renderCalendar() {
  const today    = toLocalDate(new Date());
  const maxDate  = new Date(today);
  maxDate.setDate(today.getDate() + CONFIG.maxBookingDaysAhead);

  const year  = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  // Nombre del mes
  const monthName = new Date(year, month, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  domRefs.calMonthLabel.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Primer día del mes y cantidad de días
  const firstDay   = new Date(year, month, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = '';

  // Celdas vacías al principio
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="calendar-day empty" aria-hidden="true"></div>`;
  }

  // Días del mes
  for (let d = 1; d <= daysInMonth; d++) {
    const date     = new Date(year, month, d);
    const dateStr  = formatDateISO(date);
    const dayOfWeek = date.getDay();

    const isToday    = dateStr === formatDateISO(today);
    const isPast     = date < today;
    const isTooFar   = date > maxDate;
    const isWorkDay  = CONFIG.workingDays.includes(dayOfWeek);
    const isDisabled = isPast || isTooFar || !isWorkDay;
    const isSelected = dateStr === booking.date;

    const classes = [
      'calendar-day',
      isToday    ? 'today'    : '',
      isDisabled ? 'disabled' : '',
      isSelected ? 'selected' : ''
    ].filter(Boolean).join(' ');

    html += `
      <div
        class="${classes}"
        data-date="${dateStr}"
        role="gridcell"
        aria-label="${date.toLocaleDateString('es-AR', {day:'numeric',month:'long'})}"
        aria-disabled="${isDisabled}"
        ${!isDisabled ? 'tabindex="0"' : ''}
      >${d}</div>
    `;
  }

  domRefs.calDays.innerHTML = html;

  // Eventos en los días habilitados
  domRefs.calDays.querySelectorAll('.calendar-day:not(.disabled):not(.empty)').forEach(cell => {
    const handler = () => selectDate(cell.dataset.date);
    cell.addEventListener('click', handler);
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
  });

  // Deshabilitar botón ← si el mes es el actual o anterior
  const now = new Date();
  domRefs.calPrev.disabled = (year < now.getFullYear()) ||
    (year === now.getFullYear() && month <= now.getMonth());
}

/** Maneja la selección de un día en el calendario */
async function selectDate(dateStr) {
  booking.date = dateStr;
  booking.time = null;
  domRefs.btnStep2Next.disabled = true;

  // Resaltar día seleccionado
  domRefs.calDays.querySelectorAll('.calendar-day').forEach(c => {
    c.classList.toggle('selected', c.dataset.date === dateStr);
  });

  // Mostrar sección de slots
  domRefs.slotsSection.style.display = 'block';
  const d = new Date(dateStr + 'T00:00:00');
  domRefs.slotsDateLabel.textContent = d.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  await loadSlots(dateStr);
}

// ────────────────────────────────────────────────────────────
//  SLOTS DE HORARIO
// ────────────────────────────────────────────────────────────

/** Genera todos los horarios posibles para un día según la configuración */
function generateAllSlots(dateStr) {
  const d         = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay();
  const isSaturday = dayOfWeek === 6;

  const hours = isSaturday
    ? CONFIG.workingHours.saturday
    : CONFIG.workingHours.weekdays;

  const slots = [];
  let [sh, sm] = hours.start.split(':').map(Number);
  const [eh, em] = hours.end.split(':').map(Number);
  const endTotal = eh * 60 + em;

  let current = sh * 60 + sm;
  while (current + CONFIG.slotDuration <= endTotal) {
    const hh = String(Math.floor(current / 60)).padStart(2, '0');
    const mm = String(current % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    current += CONFIG.slotDuration;
  }

  return slots;
}

/** Carga los slots disponibles para la fecha indicada */
async function loadSlots(dateStr) {
  domRefs.slotsLoading.style.display = 'block';
  domRefs.slotsGrid.innerHTML = '';

  const allSlots = generateAllSlots(dateStr);
  let occupiedTimes = [];
  let blockedRanges = [];

  if (DEMO_MODE) {
    // Modo demo: leer localStorage
    const data = getLocalAppointments();
    occupiedTimes = data
      .filter(a => a.appointment_date === dateStr && ['pending','confirmed'].includes(a.status))
      .map(a => a.appointment_time.substring(0,5));

    const blocks = getLocalBlockedSlots();
    blockedRanges = blocks.filter(b => b.slot_date === dateStr);

  } else {
    // Modo Supabase
    try {
      const [apptRes, blockRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('appointment_time')
          .eq('appointment_date', dateStr)
          .in('status', ['pending', 'confirmed']),
        supabase
          .from('blocked_slots')
          .select('start_time, end_time')
          .eq('slot_date', dateStr)
      ]);

      if (apptRes.error) throw apptRes.error;
      if (blockRes.error) throw blockRes.error;

      occupiedTimes = (apptRes.data || []).map(a => a.appointment_time.substring(0,5));
      blockedRanges = blockRes.data || [];
    } catch (err) {
      console.error('Error cargando turnos:', err);
      showToast('Error al cargar los horarios. Intente de nuevo.', 'error');
    }
  }

  domRefs.slotsLoading.style.display = 'none';

  if (allSlots.length === 0) {
    domRefs.slotsGrid.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;grid-column:1/-1">Sin horarios disponibles para este día.</p>`;
    return;
  }

  /** Verifica si un slot está cubierto por un bloqueo */
  const isBlocked = (slotTime) => {
    return blockedRanges.some(b => {
      const start = b.start_time.substring(0,5);
      const end   = b.end_time.substring(0,5);
      return slotTime >= start && slotTime < end;
    });
  };

  domRefs.slotsGrid.innerHTML = allSlots.map(time => {
    const occupied = occupiedTimes.includes(time) || isBlocked(time);
    const isSelected = time === booking.time;
    const classes = ['slot-chip', occupied ? 'occupied' : '', isSelected ? 'selected' : ''].filter(Boolean).join(' ');
    return `
      <button
        class="${classes}"
        data-time="${time}"
        ${occupied ? 'disabled aria-disabled="true"' : ''}
        role="option"
        aria-selected="${isSelected}"
        aria-label="${time}${occupied ? ' (no disponible)' : ''}"
      >${time}</button>
    `;
  }).join('');

  // Eventos de selección de slot
  domRefs.slotsGrid.querySelectorAll('.slot-chip:not(.occupied)').forEach(btn => {
    btn.addEventListener('click', () => {
      domRefs.slotsGrid.querySelectorAll('.slot-chip').forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-selected', 'true');
      booking.time = btn.dataset.time;
      domRefs.btnStep2Next.disabled = false;
    });
  });
}

// ────────────────────────────────────────────────────────────
//  CONFIRMACIÓN DE RESERVA
// ────────────────────────────────────────────────────────────

async function confirmBooking() {
  // Validar formulario
  const name  = domRefs.inputName.value.trim();
  const phone = domRefs.inputPhone.value.trim();

  if (!name) {
    showToast('Por favor ingresá tu nombre.', 'error');
    domRefs.inputName.focus();
    return;
  }
  if (!phone) {
    showToast('Por favor ingresá tu teléfono.', 'error');
    domRefs.inputPhone.focus();
    return;
  }

  booking.name  = name;
  booking.phone = phone;
  booking.notes = domRefs.inputNotes.value.trim();

  // Deshabilitar botón y mostrar spinner
  domRefs.btnConfirm.disabled = true;
  document.getElementById('btn-confirm-text').textContent    = 'Guardando...';
  document.getElementById('btn-confirm-spinner').style.display = 'inline-block';

  const code = generateBookingCode();

  const apptData = {
    client_name:      booking.name,
    client_phone:     booking.phone,
    service:          booking.service.name,
    appointment_date: booking.date,
    appointment_time: booking.time + ':00',
    status:           'pending',
    notes:            booking.notes || null,
    booking_code:     code
  };

  let success = false;

  if (DEMO_MODE) {
    // Guardar en localStorage
    const all = getLocalAppointments();
    all.push({ id: crypto.randomUUID(), ...apptData, created_at: new Date().toISOString() });
    saveLocalAppointments(all);
    success = true;
  } else {
    try {
      const { error } = await supabase.from('appointments').insert([apptData]);
      if (error) throw error;
      success = true;
    } catch (err) {
      console.error('Error guardando turno:', err);
      showToast('No se pudo guardar el turno. Intentá de nuevo.', 'error');
    }
  }

  // Restablecer botón
  domRefs.btnConfirm.disabled = false;
  document.getElementById('btn-confirm-text').textContent    = 'Confirmar';
  document.getElementById('btn-confirm-spinner').style.display = 'none';

  if (!success) return;

  // Pantalla de éxito
  domRefs.bookingCodeValue.textContent = code;
  domRefs.successService.textContent   = booking.service.name;
  domRefs.successDate.textContent      = formatDate(booking.date);
  domRefs.successTime.textContent      = booking.time;

  showStep('ok');
  showToast('¡Turno reservado con éxito!', 'success');
}

// ────────────────────────────────────────────────────────────
//  EVENTOS
// ────────────────────────────────────────────────────────────

function bindEvents() {
  // Abrir/cerrar modal
  domRefs.btnOpenBooking.addEventListener('click', openBookingModal);
  domRefs.btnCloseBooking.addEventListener('click', closeBookingModal);
  domRefs.btnDone.addEventListener('click', closeBookingModal);

  // Cerrar al hacer clic en el overlay
  domRefs.bookingModal.addEventListener('click', e => {
    if (e.target === domRefs.bookingModal) closeBookingModal();
  });

  // Cerrar con Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && domRefs.bookingModal.classList.contains('active')) {
      closeBookingModal();
    }
  });

  // Paso 1 → 2
  domRefs.btnStep1Next.addEventListener('click', () => showStep(2));

  // Paso 2 ← 1
  domRefs.btnStep2Back.addEventListener('click', () => showStep(1));

  // Paso 2 → 3
  domRefs.btnStep2Next.addEventListener('click', () => showStep(3));

  // Paso 3 ← 2
  domRefs.btnStep3Back.addEventListener('click', () => showStep(2));

  // Confirmar
  domRefs.btnConfirm.addEventListener('click', confirmBooking);

  // Las tarjetas de la preview del hero también abren el modal
  document.querySelectorAll('#services-preview-grid .service-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', openBookingModal);
  });
}

// ────────────────────────────────────────────────────────────
//  TOASTS
// ────────────────────────────────────────────────────────────

/**
 * Muestra un toast de notificación.
 * @param {string} message - Texto del mensaje
 * @param {'success'|'error'|'info'} type - Tipo de toast
 * @param {number} duration - Duración en ms (default 3500)
 */
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-icon" aria-hidden="true"></div>
    <span>${message}</span>
  `;
  domRefs.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ────────────────────────────────────────────────────────────
//  MODO DEMO — localStorage
// ────────────────────────────────────────────────────────────

function getLocalAppointments() {
  try { return JSON.parse(localStorage.getItem('blade_appointments') || '[]'); }
  catch { return []; }
}
function saveLocalAppointments(data) {
  localStorage.setItem('blade_appointments', JSON.stringify(data));
}
function getLocalBlockedSlots() {
  try { return JSON.parse(localStorage.getItem('blade_blocked_slots') || '[]'); }
  catch { return []; }
}

// ────────────────────────────────────────────────────────────
//  UTILIDADES
// ────────────────────────────────────────────────────────────

/** Genera un código de reserva corto, ej: "ZHR-4F2A" */
function generateBookingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const prefix = ['Z','H','R','B','C','D','F','G','K','M','N','P','T','W'][Math.floor(Math.random() * 14)];
  const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}${['H','R','C'][Math.floor(Math.random()*3)]}-${suffix}`;
}

/** Formatea 'YYYY-MM-DD' como "lunes 16 de junio de 2025" */
function formatDate(dateStr) {
  if (!dateStr) return '–';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

/** Retorna la fecha como string 'YYYY-MM-DD' (sin zona horaria) */
function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Retorna un objeto Date fijado a medianoche local */
function toLocalDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ────────────────────────────────────────────────────────────
//  SERVICE WORKER (PWA)
// ────────────────────────────────────────────────────────────

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Si el archivo sw.js no existe, lo ignora silenciosamente
      });
    });
  }
}
