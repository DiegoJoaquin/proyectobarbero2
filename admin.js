/**
 * ============================================================
 *  BLADE & CO. — admin.js  (lógica del panel del barbero)
 * ============================================================
 *  Funcionalidades:
 *  - Login con PIN de 4 dígitos (teclado en pantalla)
 *  - Dashboard con estadísticas del día
 *  - Navegación de fechas (anterior / hoy / siguiente)
 *  - Timeline de turnos con estados
 *  - Modal de detalle: marcar completado / cancelar
 *  - FAB con acciones: agregar turno + bloquear horario
 *  - Modo demo (localStorage) y modo Supabase
 *  - Realtime de Supabase (actualización en vivo)
 * ============================================================
 */

// ────────────────────────────────────────────────────────────
//  INICIALIZACIÓN
// ────────────────────────────────────────────────────────────

const DEMO_MODE = (
  CONFIG.supabase.url     === 'TU_SUPABASE_URL' ||
  CONFIG.supabase.anonKey === 'TU_SUPABASE_ANON_KEY'
);

let supabase = null;
if (!DEMO_MODE) {
  try {
    supabase = window.supabase.createClient(
      CONFIG.supabase.url,
      CONFIG.supabase.anonKey
    );
  } catch (e) {
    console.error('Error al inicializar Supabase. Verificá las credenciales en config.js.', e);
  }
}

// ────────────────────────────────────────────────────────────
//  ESTADO GLOBAL
// ────────────────────────────────────────────────────────────

/** Fecha actualmente seleccionada en el dashboard */
let selectedDate = todayISO();

/** ID del turno abierto en el modal de detalle */
let selectedApptId = null;

/** Canal de realtime (Supabase) */
let realtimeChannel = null;

// ────────────────────────────────────────────────────────────
//  DOM — REFERENCIAS
// ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const dom = {
  demoBanner:       $('demo-banner'),
  loginScreen:      $('login-screen'),
  dashboard:        $('admin-dashboard'),
  fabContainer:     $('fab-container'),
  toastContainer:   $('toast-container'),

  // PIN
  dots:             [1,2,3,4].map(n => $(`dot-${n}`)),
  pinKeypad:        document.querySelectorAll('.pin-key'),

  // Topbar
  dateLabel:        $('current-date-label'),
  btnDatePrev:      $('btn-date-prev'),
  btnDateNext:      $('btn-date-next'),
  btnToday:         $('btn-today'),
  btnLogout:        $('btn-logout'),

  // Stats
  statTotal:        $('stat-total'),
  statPending:      $('stat-pending'),
  statDone:         $('stat-done'),

  // Timeline
  timelineLoading:  $('timeline-loading'),
  timelineContent:  $('timeline-content'),

  // Modal detalle
  apptDetailModal:  $('appt-detail-modal'),
  apptDetailBody:   $('appt-detail-body'),
  btnCloseDetail:   $('btn-close-appt-detail'),

  // Modal agregar
  addApptModal:     $('add-appt-modal'),
  addName:          $('add-name'),
  addPhone:         $('add-phone'),
  addService:       $('add-service'),
  addDate:          $('add-date'),
  addTimeSelect:    $('add-time-select'),
  addNotes:         $('add-notes'),
  btnCloseAddAppt:  $('btn-close-add-appt'),
  btnSaveAppt:      $('btn-save-appt'),

  // Modal bloqueo
  blockModal:       $('block-modal'),
  blockDate:        $('block-date'),
  blockStart:       $('block-start'),
  blockEnd:         $('block-end'),
  blockReason:      $('block-reason'),
  btnCloseBlock:    $('btn-close-block'),
  btnSaveBlock:     $('btn-save-block'),

  // FAB
  fabMain:          $('fab-main'),
  fabAdd:           $('fab-add'),
  fabBlock:         $('fab-block'),
};

// ────────────────────────────────────────────────────────────
//  ARRANQUE
// ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Actualizar nombre del negocio en el logo de login
  const loginLogo = $('admin-login-logo');
  if (loginLogo) loginLogo.textContent = CONFIG.business.name;

  if (DEMO_MODE) {
    dom.demoBanner.classList.add('visible');
    document.body.classList.add('demo-mode');
  }

  initPinKeypad();
  bindAdminEvents();
  populateServiceSelect();
});

// ────────────────────────────────────────────────────────────
//  LOGIN — PIN
// ────────────────────────────────────────────────────────────

let pinBuffer = '';

function initPinKeypad() {
  dom.pinKeypad.forEach(key => {
    key.addEventListener('click', () => handlePinKey(key.dataset.key));
  });

  // También acepta teclado físico en la pantalla de login
  document.addEventListener('keydown', e => {
    if (!dom.loginScreen.style.display === 'none') return;
    if (/^\d$/.test(e.key)) handlePinKey(e.key);
    if (e.key === 'Backspace') handlePinKey('del');
  });
}

function handlePinKey(key) {
  if (key === 'clear') {
    pinBuffer = '';
  } else if (key === 'del') {
    pinBuffer = pinBuffer.slice(0, -1);
  } else if (pinBuffer.length < 4) {
    pinBuffer += key;
  }

  updatePinDots();

  // Cuando se completan 4 dígitos, verificar el PIN
  if (pinBuffer.length === 4) {
    setTimeout(checkPin, 150);
  }
}

function updatePinDots() {
  dom.dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinBuffer.length);
    dot.classList.remove('error');
  });
}

function checkPin() {
  if (pinBuffer === String(CONFIG.adminPin)) {
    // PIN correcto → ir al dashboard
    sessionStorage.setItem('blade_admin_auth', '1');
    showDashboard();
  } else {
    // PIN incorrecto → animación de error
    dom.dots.forEach(dot => dot.classList.add('error'));
    pinBuffer = '';
    setTimeout(updatePinDots, 600);
    showToast('PIN incorrecto. Intentá de nuevo.', 'error');
  }
}

// ────────────────────────────────────────────────────────────
//  MOSTRAR DASHBOARD
// ────────────────────────────────────────────────────────────

function showDashboard() {
  dom.loginScreen.style.display = 'none';
  dom.dashboard.style.display   = 'block';
  dom.fabContainer.style.display = 'flex';
  selectedDate = todayISO();
  renderDateLabel();
  loadDayData();
  subscribeRealtime();
}

function logout() {
  sessionStorage.removeItem('blade_admin_auth');
  pinBuffer = '';
  updatePinDots();
  dom.loginScreen.style.display = 'flex';
  dom.dashboard.style.display   = 'none';
  dom.fabContainer.style.display = 'none';
  if (realtimeChannel) {
    supabase?.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ────────────────────────────────────────────────────────────
//  NAVEGACIÓN DE FECHAS
// ────────────────────────────────────────────────────────────

function renderDateLabel() {
  const d = new Date(selectedDate + 'T00:00:00');
  const label = d.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  dom.dateLabel.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

function changeDate(delta) {
  const d = new Date(selectedDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  selectedDate = formatDateISO(d);
  renderDateLabel();
  loadDayData();
}

// ────────────────────────────────────────────────────────────
//  CARGA DE DATOS DEL DÍA
// ────────────────────────────────────────────────────────────

async function loadDayData() {
  dom.timelineLoading.style.display = 'block';
  dom.timelineContent.innerHTML = '';

  let appointments = [];

  if (DEMO_MODE) {
    const all = getLocalAppointments();
    appointments = all
      .filter(a => a.appointment_date === selectedDate)
      .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
  } else {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', selectedDate)
        .order('appointment_time', { ascending: true });

      if (error) throw error;
      appointments = data || [];
    } catch (err) {
      console.error('Error cargando turnos del día:', err);
      showToast('Error al cargar los turnos. Revisá la conexión.', 'error');
    }
  }

  dom.timelineLoading.style.display = 'none';
  renderTimeline(appointments);
  updateStats(appointments);
}

// ────────────────────────────────────────────────────────────
//  TIMELINE
// ────────────────────────────────────────────────────────────

function renderTimeline(appointments) {
  if (appointments.length === 0) {
    dom.timelineContent.innerHTML = `
      <div class="timeline-empty">
        <span class="timeline-empty-icon" aria-hidden="true">📭</span>
        <p class="timeline-empty-text">Sin turnos para este día.</p>
      </div>
    `;
    return;
  }

  dom.timelineContent.innerHTML = appointments.map(appt => {
    const time = appt.appointment_time?.substring(0, 5) ?? '--:--';
    const statusLabel = {
      pending:   'Pendiente',
      confirmed: 'Confirmado',
      completed: 'Completado',
      cancelled: 'Cancelado'
    }[appt.status] || appt.status;

    return `
      <div
        class="appointment-card animate-up"
        data-appt-id="${appt.id}"
        role="button"
        tabindex="0"
        aria-label="Turno de ${appt.client_name} a las ${time}, ${statusLabel}"
      >
        <div class="appt-time">${time}</div>
        <div class="appt-body">
          <div class="appt-name">${escapeHtml(appt.client_name)}</div>
          <div class="appt-service">${escapeHtml(appt.service)}</div>
        </div>
        <div class="status-badge ${appt.status}">${statusLabel}</div>
      </div>
    `;
  }).join('');

  // Eventos en las tarjetas
  dom.timelineContent.querySelectorAll('.appointment-card').forEach(card => {
    const openDetail = () => openApptDetail(card.dataset.apptId, appointments);
    card.addEventListener('click', openDetail);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); }
    });
  });
}

// ────────────────────────────────────────────────────────────
//  ESTADÍSTICAS
// ────────────────────────────────────────────────────────────

function updateStats(appointments) {
  const total   = appointments.length;
  const pending = appointments.filter(a => ['pending','confirmed'].includes(a.status)).length;
  const done    = appointments.filter(a => a.status === 'completed').length;

  dom.statTotal.textContent   = total;
  dom.statPending.textContent = pending;
  dom.statDone.textContent    = done;
}

// ────────────────────────────────────────────────────────────
//  MODAL — DETALLE DEL TURNO
// ────────────────────────────────────────────────────────────

function openApptDetail(apptId, appointments) {
  const appt = appointments.find(a => a.id === apptId);
  if (!appt) return;

  selectedApptId = apptId;

  const time = appt.appointment_time?.substring(0, 5) ?? '--:--';
  const date = formatDate(appt.appointment_date);
  const statusLabel = {
    pending:   'Pendiente',
    confirmed: 'Confirmado',
    completed: 'Completado',
    cancelled: 'Cancelado'
  }[appt.status] || appt.status;

  const canComplete = ['pending', 'confirmed'].includes(appt.status);
  const canCancel   = ['pending', 'confirmed'].includes(appt.status);

  dom.apptDetailBody.innerHTML = `
    <div class="appt-detail-header">
      <div class="appt-detail-name">${escapeHtml(appt.client_name)}</div>
      <div class="appt-detail-meta">
        <span class="status-badge ${appt.status}">${statusLabel}</span>
      </div>
    </div>

    <div class="detail-row">
      <span class="detail-icon" aria-hidden="true">✂️</span>
      <span class="detail-label">Servicio</span>
      <span class="detail-value">${escapeHtml(appt.service)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-icon" aria-hidden="true">📅</span>
      <span class="detail-label">Fecha</span>
      <span class="detail-value">${date}</span>
    </div>
    <div class="detail-row">
      <span class="detail-icon" aria-hidden="true">🕐</span>
      <span class="detail-label">Hora</span>
      <span class="detail-value">${time}</span>
    </div>
    <div class="detail-row">
      <span class="detail-icon" aria-hidden="true">📞</span>
      <span class="detail-label">Teléfono</span>
      <span class="detail-value">
        <a href="tel:${encodeURIComponent(appt.client_phone)}" class="phone-link">${escapeHtml(appt.client_phone)}</a>
      </span>
    </div>
    ${appt.notes ? `
    <div class="detail-row">
      <span class="detail-icon" aria-hidden="true">📝</span>
      <span class="detail-label">Notas</span>
      <span class="detail-value">${escapeHtml(appt.notes)}</span>
    </div>` : ''}

    <div class="appt-detail-actions" style="margin-top:20px;">
      ${canComplete ? `
        <button class="btn btn-success btn-full" id="btn-complete-appt" aria-label="Marcar como completado">
          ✓ Marcar como completado
        </button>
      ` : ''}
      ${canCancel ? `
        <button class="btn btn-danger btn-full" id="btn-cancel-appt" aria-label="Cancelar turno">
          ✕ Cancelar turno
        </button>
      ` : ''}
    </div>
  `;

  // Eventos de acciones
  $('btn-complete-appt')?.addEventListener('click', () => updateApptStatus(apptId, 'completed'));
  $('btn-cancel-appt')?.addEventListener('click',   () => updateApptStatus(apptId, 'cancelled'));

  dom.apptDetailModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeApptDetail() {
  dom.apptDetailModal.classList.remove('active');
  document.body.style.overflow = '';
  selectedApptId = null;
}

/** Actualiza el estado de un turno */
async function updateApptStatus(apptId, newStatus) {
  if (DEMO_MODE) {
    const all = getLocalAppointments();
    const idx = all.findIndex(a => a.id === apptId);
    if (idx >= 0) {
      all[idx].status = newStatus;
      saveLocalAppointments(all);
    }
  } else {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', apptId);
      if (error) throw error;
    } catch (err) {
      console.error('Error actualizando estado:', err);
      showToast('Error al actualizar el turno.', 'error');
      return;
    }
  }

  const statusMsg = newStatus === 'completed' ? 'Turno marcado como completado.' : 'Turno cancelado.';
  showToast(statusMsg, 'success');
  closeApptDetail();
  await loadDayData();
}

// ────────────────────────────────────────────────────────────
//  FAB — MENÚ FLOTANTE
// ────────────────────────────────────────────────────────────

let fabOpen = false;

function toggleFab() {
  fabOpen = !fabOpen;
  dom.fabContainer.classList.toggle('open', fabOpen);
  dom.fabMain.setAttribute('aria-expanded', String(fabOpen));
}

function closeFab() {
  fabOpen = false;
  dom.fabContainer.classList.remove('open');
  dom.fabMain.setAttribute('aria-expanded', 'false');
}

// ────────────────────────────────────────────────────────────
//  MODAL — AGREGAR TURNO MANUAL
// ────────────────────────────────────────────────────────────

function openAddApptModal() {
  closeFab();
  // Pre-rellenar con la fecha seleccionada en el dashboard
  dom.addDate.value = selectedDate;
  dom.addDate.min   = todayISO();

  // Cargar horarios según la fecha actual
  loadAddTimeSlots(selectedDate);

  dom.addApptModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  dom.addName.focus();
}

function closeAddApptModal() {
  dom.addApptModal.classList.remove('active');
  document.body.style.overflow = '';
  dom.addName.value  = '';
  dom.addPhone.value = '';
  dom.addNotes.value = '';
}

/** Llena el select de horarios del formulario de agregar turno */
async function loadAddTimeSlots(dateStr) {
  dom.addTimeSelect.innerHTML = '<option value="">Cargando...</option>';
  if (!dateStr) { dom.addTimeSelect.innerHTML = '<option value="">— Elegí primero la fecha —</option>'; return; }

  const allSlots = generateAllSlots(dateStr);
  let occupiedTimes = [];
  let blockedRanges = [];

  if (DEMO_MODE) {
    const all = getLocalAppointments();
    occupiedTimes = all
      .filter(a => a.appointment_date === dateStr && ['pending','confirmed'].includes(a.status))
      .map(a => a.appointment_time.substring(0,5));
    blockedRanges = getLocalBlockedSlots().filter(b => b.slot_date === dateStr);
  } else {
    try {
      const [apptRes, blockRes] = await Promise.all([
        supabase.from('appointments').select('appointment_time').eq('appointment_date', dateStr).in('status',['pending','confirmed']),
        supabase.from('blocked_slots').select('start_time, end_time').eq('slot_date', dateStr)
      ]);
      if (!apptRes.error) occupiedTimes = (apptRes.data||[]).map(a => a.appointment_time.substring(0,5));
      if (!blockRes.error) blockedRanges = blockRes.data||[];
    } catch {}
  }

  const isBlocked = t => blockedRanges.some(b => t >= b.start_time.substring(0,5) && t < b.end_time.substring(0,5));

  const available = allSlots.filter(t => !occupiedTimes.includes(t) && !isBlocked(t));

  if (available.length === 0) {
    dom.addTimeSelect.innerHTML = '<option value="">Sin horarios disponibles</option>';
    return;
  }

  dom.addTimeSelect.innerHTML = `<option value="">— Elegí un horario —</option>` +
    available.map(t => `<option value="${t}">${t}</option>`).join('');
}

/** Guarda el nuevo turno manual */
async function saveNewAppt() {
  const name    = dom.addName.value.trim();
  const phone   = dom.addPhone.value.trim();
  const service = dom.addService.value;
  const date    = dom.addDate.value;
  const time    = dom.addTimeSelect.value;
  const notes   = dom.addNotes.value.trim();

  if (!name || !phone || !service || !date || !time) {
    showToast('Completá todos los campos obligatorios.', 'error');
    return;
  }

  // Estado del botón
  dom.btnSaveAppt.disabled = true;
  $('btn-save-appt-text').textContent = 'Guardando...';
  $('btn-save-appt-spinner').style.display = 'inline-block';

  const apptData = {
    client_name:      name,
    client_phone:     phone,
    service:          service,
    appointment_date: date,
    appointment_time: time + ':00',
    status:           'confirmed',
    notes:            notes || null
  };

  let ok = false;

  if (DEMO_MODE) {
    const all = getLocalAppointments();
    all.push({ id: crypto.randomUUID(), ...apptData, created_at: new Date().toISOString() });
    saveLocalAppointments(all);
    ok = true;
  } else {
    try {
      const { error } = await supabase.from('appointments').insert([apptData]);
      if (error) throw error;
      ok = true;
    } catch (err) {
      console.error('Error guardando turno:', err);
      showToast('Error al guardar el turno.', 'error');
    }
  }

  dom.btnSaveAppt.disabled = false;
  $('btn-save-appt-text').textContent = 'Guardar turno';
  $('btn-save-appt-spinner').style.display = 'none';

  if (!ok) return;

  showToast('¡Turno agregado correctamente!', 'success');
  closeAddApptModal();
  selectedDate = date;
  renderDateLabel();
  await loadDayData();
}

// ────────────────────────────────────────────────────────────
//  MODAL — BLOQUEAR HORARIOS
// ────────────────────────────────────────────────────────────

function openBlockModal() {
  closeFab();
  dom.blockDate.value   = selectedDate;
  dom.blockDate.min     = todayISO();
  dom.blockStart.value  = '';
  dom.blockEnd.value    = '';
  dom.blockReason.value = '';
  dom.blockModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeBlockModal() {
  dom.blockModal.classList.remove('active');
  document.body.style.overflow = '';
}

async function saveBlock() {
  const date   = dom.blockDate.value;
  const start  = dom.blockStart.value;
  const end    = dom.blockEnd.value;
  const reason = dom.blockReason.value.trim();

  if (!date || !start || !end) {
    showToast('Completá fecha, hora de inicio y fin.', 'error');
    return;
  }
  if (start >= end) {
    showToast('La hora de fin debe ser después del inicio.', 'error');
    return;
  }

  dom.btnSaveBlock.disabled = true;
  $('btn-save-block-text').textContent = 'Guardando...';
  $('btn-save-block-spinner').style.display = 'inline-block';

  const blockData = {
    slot_date:  date,
    start_time: start + ':00',
    end_time:   end   + ':00',
    reason:     reason || null
  };

  let ok = false;

  if (DEMO_MODE) {
    const all = getLocalBlockedSlots();
    all.push({ id: crypto.randomUUID(), ...blockData });
    saveLocalBlockedSlots(all);
    ok = true;
  } else {
    try {
      const { error } = await supabase.from('blocked_slots').insert([blockData]);
      if (error) throw error;
      ok = true;
    } catch (err) {
      console.error('Error bloqueando horario:', err);
      showToast('Error al guardar el bloqueo.', 'error');
    }
  }

  dom.btnSaveBlock.disabled = false;
  $('btn-save-block-text').textContent = 'Bloquear horario';
  $('btn-save-block-spinner').style.display = 'none';

  if (!ok) return;

  showToast('Horario bloqueado correctamente.', 'success');
  closeBlockModal();
  if (date === selectedDate) await loadDayData();
}

// ────────────────────────────────────────────────────────────
//  SERVICIOS — llenar select
// ────────────────────────────────────────────────────────────

function populateServiceSelect() {
  dom.addService.innerHTML = CONFIG.services.map(s =>
    `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`
  ).join('');
}

// ────────────────────────────────────────────────────────────
//  REALTIME — Supabase
// ────────────────────────────────────────────────────────────

function subscribeRealtime() {
  if (DEMO_MODE || !supabase) return;

  realtimeChannel = supabase
    .channel('appointments-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
      loadDayData();
    })
    .subscribe();
}

// ────────────────────────────────────────────────────────────
//  EVENTOS GLOBALES
// ────────────────────────────────────────────────────────────

function bindAdminEvents() {
  // Topbar
  dom.btnDatePrev.addEventListener('click', () => changeDate(-1));
  dom.btnDateNext.addEventListener('click', () => changeDate(1));
  dom.btnToday.addEventListener('click', () => {
    selectedDate = todayISO();
    renderDateLabel();
    loadDayData();
  });
  dom.btnLogout.addEventListener('click', logout);

  // Modal detalle
  dom.btnCloseDetail.addEventListener('click', closeApptDetail);
  dom.apptDetailModal.addEventListener('click', e => {
    if (e.target === dom.apptDetailModal) closeApptDetail();
  });

  // Modal agregar
  dom.btnCloseAddAppt.addEventListener('click', closeAddApptModal);
  dom.addApptModal.addEventListener('click', e => {
    if (e.target === dom.addApptModal) closeAddApptModal();
  });
  dom.btnSaveAppt.addEventListener('click', saveNewAppt);

  // Cuando cambia la fecha en el formulario de agregar, recargar horarios
  dom.addDate.addEventListener('change', () => loadAddTimeSlots(dom.addDate.value));

  // Modal bloqueo
  dom.btnCloseBlock.addEventListener('click', closeBlockModal);
  dom.blockModal.addEventListener('click', e => {
    if (e.target === dom.blockModal) closeBlockModal();
  });
  dom.btnSaveBlock.addEventListener('click', saveBlock);

  // FAB
  dom.fabMain.addEventListener('click', toggleFab);
  dom.fabAdd.addEventListener('click', openAddApptModal);
  dom.fabBlock.addEventListener('click', openBlockModal);

  // Cerrar FAB al hacer clic afuera
  document.addEventListener('click', e => {
    if (fabOpen && !dom.fabContainer.contains(e.target)) closeFab();
  });

  // Escape cierra los modales
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (dom.apptDetailModal.classList.contains('active')) closeApptDetail();
      else if (dom.addApptModal.classList.contains('active')) closeAddApptModal();
      else if (dom.blockModal.classList.contains('active')) closeBlockModal();
      else if (fabOpen) closeFab();
    }
  });
}

// ────────────────────────────────────────────────────────────
//  GENERADOR DE SLOTS (mismo que en app.js)
// ────────────────────────────────────────────────────────────

function generateAllSlots(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek  = d.getDay();
  const isSaturday = dayOfWeek === 6;

  const hours = isSaturday
    ? CONFIG.workingHours.saturday
    : CONFIG.workingHours.weekdays;

  const slots = [];
  const [eh, em] = hours.end.split(':').map(Number);
  const endTotal  = eh * 60 + em;
  let [sh, sm]    = hours.start.split(':').map(Number);
  let current     = sh * 60 + sm;

  while (current + CONFIG.slotDuration <= endTotal) {
    const hh = String(Math.floor(current / 60)).padStart(2, '0');
    const mm  = String(current % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    current += CONFIG.slotDuration;
  }
  return slots;
}

// ────────────────────────────────────────────────────────────
//  TOASTS
// ────────────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<div class="toast-icon" aria-hidden="true"></div><span>${message}</span>`;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ────────────────────────────────────────────────────────────
//  MODO DEMO — localStorage
// ────────────────────────────────────────────────────────────

function getLocalAppointments() {
  try { return JSON.parse(localStorage.getItem('blade_appointments') || '[]'); } catch { return []; }
}
function saveLocalAppointments(data) {
  localStorage.setItem('blade_appointments', JSON.stringify(data));
}
function getLocalBlockedSlots() {
  try { return JSON.parse(localStorage.getItem('blade_blocked_slots') || '[]'); } catch { return []; }
}
function saveLocalBlockedSlots(data) {
  localStorage.setItem('blade_blocked_slots', JSON.stringify(data));
}

// ────────────────────────────────────────────────────────────
//  UTILIDADES
// ────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return formatDateISO(d);
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '–';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

/** Escapa caracteres HTML para prevenir XSS */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
