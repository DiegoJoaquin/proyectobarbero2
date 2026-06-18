/**
 * ============================================================
 *  BLADE & CO. — app.js  (lógica del cliente)
 * ============================================================
 */

// ── Helpers seguros para el DOM ────────────────────────────
const el = id => document.getElementById(id);
const qs = (sel, ctx) => (ctx || document).querySelector(sel);
const qsa = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

// ── Detección de Supabase ──────────────────────────────────
let DEMO_MODE = (
  !CONFIG ||
  CONFIG.supabase.url     === 'TU_SUPABASE_URL' ||
  CONFIG.supabase.anonKey === 'TU_SUPABASE_ANON_KEY'
);

let _supabase = null;
if (!DEMO_MODE) {
  try {
    if (typeof window.supabase === 'undefined') throw new Error('Supabase CDN no cargó');
    _supabase = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
  } catch (e) {
    console.warn('Supabase no disponible, usando modo demo:', e.message);
    DEMO_MODE = true;
  }
}

// ── Estado del wizard ──────────────────────────────────────
const booking = { service: null, date: null, time: null, name: '', phone: '', notes: '' };
let calendarMonth = new Date();
calendarMonth.setDate(1);

// ── Toast (sin depender de domRefs) ───────────────────────
function showToast(msg, type = 'info', ms = 3500) {
  const container = el('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.setAttribute('role', 'alert');
  t.innerHTML = `<div class="toast-icon" aria-hidden="true"></div><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('removing');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, ms);
}

// ══════════════════════════════════════════════════════════
//  ARRANQUE — todo dentro de DOMContentLoaded para evitar
//  problemas de timing en cualquier dispositivo/navegador
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  try {
    initApp();
  } catch (err) {
    console.error('Error iniciando la app:', err);
  }
});

function initApp() {
  // Banner de modo demo
  if (DEMO_MODE) {
    const banner = el('demo-banner');
    if (banner) { banner.classList.add('visible'); document.body.classList.add('demo-mode'); }
  }

  applyBusinessInfo();
  renderServicesPreview();
  renderServiceCards();
  initCalendar();
  bindEvents();
  registerServiceWorker();
}

// ── Info del negocio ───────────────────────────────────────
function applyBusinessInfo() {
  const b = CONFIG.business;
  const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
  set('business-name',      b.name);
  set('business-tagline',   b.tagline);
  set('business-address',   b.address);
  
  const ig = el('business-instagram');
  if (ig) {
    let igUrl = b.instagram;
    if (!igUrl.startsWith('http')) {
      igUrl = `https://www.instagram.com/${igUrl.replace('@', '')}/`;
    }
    const handle = '@' + igUrl.split('instagram.com/')[1].replace(/\//g, '');
    ig.textContent = handle;
    ig.href = igUrl;
  }

  const phone = el('business-phone');
  if (phone) { phone.textContent = b.phone; phone.href = `tel:${b.phone.replace(/\s/g, '')}`; }
  document.title = `${b.name} — Reservá tu turno`;
}

// ── Tarjetas de servicio (preview en el hero) ──────────────
function renderServicesPreview() {
  const grid = el('services-preview-grid');
  if (!grid) return;
  grid.innerHTML = CONFIG.services.map(s => `
    <div class="service-card animate-up" role="listitem" aria-label="${s.name}">
      <span class="service-icon" aria-hidden="true">${s.icon}</span>
      <div class="service-name">${s.name}</div>
      <div class="service-description">${s.description}</div>
      <div class="service-duration">
        ⏱ ${formatDuration(s.duration)}
        ${s.price ? `&nbsp;&nbsp;•&nbsp;&nbsp;💵 ${s.price}` : ''}
      </div>
    </div>
  `).join('');
  // Abrir modal al tocar una tarjeta de servicio
  qsa('.service-card', grid).forEach(c => c.addEventListener('click', openBookingModal));
}

// ── Tarjetas del wizard paso 1 ─────────────────────────────
function renderServiceCards() {
  const grid = el('service-cards-grid');
  if (!grid) return;
  grid.innerHTML = CONFIG.services.map(s => `
    <div class="service-card" data-service-id="${s.id}" role="option" aria-selected="false" tabindex="0"
      aria-label="${s.name}: ${s.description}, ${s.duration} minutos">
      <div class="service-check" aria-hidden="true">✓</div>
      <span class="service-icon" aria-hidden="true">${s.icon}</span>
      <div class="service-name">${s.name}</div>
      <div class="service-description">${s.description}</div>
      <div class="service-duration">
        ⏱ ${formatDuration(s.duration)}
        ${s.price ? `&nbsp;&nbsp;•&nbsp;&nbsp;💵 ${s.price}` : ''}
      </div>
    </div>
  `).join('');

  qsa('.service-card', grid).forEach(card => {
    const pick = () => {
      qsa('.service-card', grid).forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-selected','false'); });
      card.classList.add('selected');
      card.setAttribute('aria-selected','true');
      booking.service = CONFIG.services.find(s => s.id === card.dataset.serviceId);
      const btn = el('btn-step1-next');
      if (btn) btn.disabled = false;
    };
    card.addEventListener('click', pick);
    card.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); pick(); } });
  });
}

// ── Modal ──────────────────────────────────────────────────
function openBookingModal() {
  resetWizard();
  const modal = el('booking-modal');
  if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
}

function closeBookingModal() {
  const modal = el('booking-modal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

function resetWizard() {
  Object.assign(booking, { service: null, date: null, time: null, name: '', phone: '', notes: '' });
  showStep(1);

  const grid = el('service-cards-grid');
  if (grid) qsa('.service-card', grid).forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-selected','false'); });

  const s1n = el('btn-step1-next'); if (s1n) s1n.disabled = true;
  const s2n = el('btn-step2-next'); if (s2n) s2n.disabled = true;
  const nm  = el('input-name');    if (nm)  nm.value  = '';
  const ph  = el('input-phone');   if (ph)  ph.value  = '';
  const nt  = el('input-notes');   if (nt)  nt.value  = '';
  const ss  = el('slots-section'); if (ss)  ss.style.display = 'none';
  const sg  = el('slots-grid');    if (sg)  sg.innerHTML = '';

  calendarMonth = new Date();
  calendarMonth.setDate(1);
  renderCalendar();
}

// ── Wizard — pasos ─────────────────────────────────────────
function showStep(step) {
  ['step-1','step-2','step-3','step-success'].forEach(id => {
    const e = el(id); if (e) e.style.display = 'none';
  });

  [1,2,3].forEach(n => {
    const ind = el(`step-indicator-${n}`);
    if (!ind) return;
    ind.classList.remove('active','done');
    ind.setAttribute('aria-selected','false');
    if (n < step)        ind.classList.add('done');
    else if (n === step) { ind.classList.add('active'); ind.setAttribute('aria-selected','true'); }
  });

  const l1 = el('wline-1'); if (l1) l1.classList.toggle('done', step > 1);
  const l2 = el('wline-2'); if (l2) l2.classList.toggle('done', step > 2);

  const map = { 1: 'step-1', 2: 'step-2', 3: 'step-3', ok: 'step-success' };
  const target = el(map[step]);
  if (target) target.style.display = 'block';
  if (step === 3) populateSummary();
}

function populateSummary() {
  const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
  set('sum-service', booking.service?.name ?? '–');
  set('sum-date',    formatDate(booking.date));
  set('sum-time',    booking.time ?? '–');
}

// ── Calendario ─────────────────────────────────────────────
function initCalendar() {
  renderCalendar();
  const prev = el('cal-prev');
  const next = el('cal-next');
  if (prev) prev.addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth()-1); renderCalendar(); });
  if (next) next.addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth()+1); renderCalendar(); });
}

function renderCalendar() {
  const calDays = el('cal-days');
  const calLabel = el('cal-month-label');
  const calPrev  = el('cal-prev');
  if (!calDays) return;

  const today   = toLocalDate(new Date());
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + CONFIG.maxBookingDaysAhead);

  const year  = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  if (calLabel) {
    const mn = new Date(year,month,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
    calLabel.textContent = mn.charAt(0).toUpperCase() + mn.slice(1);
  }

  const firstDay    = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();

  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="calendar-day empty" aria-hidden="true"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const date   = new Date(year, month, d);
    const dstr   = formatDateISO(date);
    const dow    = date.getDay();
    const isToday    = dstr === formatDateISO(today);
    const isPast     = date < today;
    const isTooFar   = date > maxDate;
    const isWorkDay  = CONFIG.workingDays.includes(dow);
    const isDisabled = isPast || isTooFar || !isWorkDay;
    const isSelected = dstr === booking.date;
    const cls = ['calendar-day', isToday?'today':'', isDisabled?'disabled':'', isSelected?'selected':''].filter(Boolean).join(' ');
    html += `<div class="${cls}" data-date="${dstr}" role="gridcell"
      aria-label="${date.toLocaleDateString('es-AR',{day:'numeric',month:'long'})}"
      aria-disabled="${isDisabled}" ${!isDisabled?'tabindex="0"':''}>${d}</div>`;
  }

  calDays.innerHTML = html;

  qsa('.calendar-day:not(.disabled):not(.empty)', calDays).forEach(cell => {
    const fn = () => selectDate(cell.dataset.date);
    cell.addEventListener('click', fn);
    cell.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); fn(); } });
  });

  const now = new Date();
  if (calPrev) calPrev.disabled = (year < now.getFullYear()) || (year===now.getFullYear() && month<=now.getMonth());
}

async function selectDate(dateStr) {
  booking.date = dateStr;
  booking.time = null;
  const s2n = el('btn-step2-next'); if (s2n) s2n.disabled = true;

  qsa('.calendar-day', el('cal-days')).forEach(c => c.classList.toggle('selected', c.dataset.date===dateStr));

  const ss = el('slots-section');
  if (ss) ss.style.display = 'block';
  const dl = el('slots-date-label');
  if (dl) {
    const d = new Date(dateStr+'T00:00:00');
    dl.textContent = d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  }

  await loadSlots(dateStr);
}

// ── Slots ──────────────────────────────────────────────────
function generateAllSlots(dateStr) {
  const dow = new Date(dateStr+'T00:00:00').getDay();
  const hrs = dow===6 ? CONFIG.workingHours.saturday : CONFIG.workingHours.weekdays;
  const [eh,em] = hrs.end.split(':').map(Number);
  const endMin   = eh*60+em;
  const [sh,sm]  = hrs.start.split(':').map(Number);
  const slots = [];
  let cur = sh*60+sm;
  while (cur + CONFIG.slotDuration <= endMin) {
    slots.push(`${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`);
    cur += CONFIG.slotDuration;
  }
  return slots;
}

async function loadSlots(dateStr) {
  const loadEl = el('slots-loading');
  const gridEl = el('slots-grid');
  if (!gridEl) return;

  if (loadEl) loadEl.style.display = 'block';
  gridEl.innerHTML = '';

  const allSlots = generateAllSlots(dateStr);
  let occupiedTimes = [];
  let blockedRanges = [];

  if (DEMO_MODE || !_supabase) {
    const data = getLocalAppointments();
    occupiedTimes = data
      .filter(a => a.appointment_date===dateStr && ['pending','confirmed'].includes(a.status))
      .map(a => a.appointment_time.substring(0,5));
    blockedRanges = getLocalBlockedSlots().filter(b => b.slot_date===dateStr);
  } else {
    try {
      const [ar, br] = await Promise.all([
        _supabase.from('appointments').select('appointment_time').eq('appointment_date',dateStr).in('status',['pending','confirmed']),
        _supabase.from('blocked_slots').select('start_time,end_time').eq('slot_date',dateStr)
      ]);
      if (ar.error) throw ar.error;
      if (br.error) throw br.error;
      occupiedTimes = (ar.data||[]).map(a => a.appointment_time.substring(0,5));
      blockedRanges = br.data||[];
    } catch (err) {
      console.error('Error Supabase, usando datos locales:', err);
      // Fallback a local si Supabase falla
      const data = getLocalAppointments();
      occupiedTimes = data
        .filter(a => a.appointment_date===dateStr && ['pending','confirmed'].includes(a.status))
        .map(a => a.appointment_time.substring(0,5));
      blockedRanges = getLocalBlockedSlots().filter(b => b.slot_date===dateStr);
    }
  }

  if (loadEl) loadEl.style.display = 'none';

  const todayStr = formatDateISO(new Date());
  const now = new Date();
  const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  const isBlocked = t => blockedRanges.some(b => t >= b.start_time.substring(0,5) && t < b.end_time.substring(0,5));

  const availableSlots = allSlots.filter(time => {
    if (dateStr === todayStr && time <= currentHHMM) return false;
    if (occupiedTimes.includes(time) || isBlocked(time)) return false;
    return true;
  });

  if (!availableSlots.length) {
    gridEl.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;grid-column:1/-1">Sin horarios disponibles.</p>`;
    return;
  }

  gridEl.innerHTML = availableSlots.map(time => {
    const sel = time === booking.time;
    const cls = ['slot-chip', sel?'selected':''].filter(Boolean).join(' ');
    return `<button class="${cls}" data-time="${time}" role="option" aria-selected="${sel}" aria-label="${time}">${time}</button>`;
  }).join('');

  qsa('.slot-chip', gridEl).forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.slot-chip', gridEl).forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-selected','false'); });
      btn.classList.add('selected'); btn.setAttribute('aria-selected','true');
      booking.time = btn.dataset.time;
      const s2n = el('btn-step2-next'); if (s2n) s2n.disabled = false;
    });
  });
}

// ── Confirmar reserva ──────────────────────────────────────
async function confirmBooking() {
  const nm  = el('input-name');
  const ph  = el('input-phone');
  const nt  = el('input-notes');
  const name  = nm?.value.trim()  || '';
  const phone = ph?.value.trim()  || '';
  if (!name)  { showToast('Por favor ingresá tu nombre.',    'error'); nm?.focus(); return; }
  if (!phone) { showToast('Por favor ingresá tu teléfono.', 'error'); ph?.focus(); return; }

  booking.name  = name;
  booking.phone = phone;
  booking.notes = nt?.value.trim() || '';

  const btnCfm  = el('btn-confirm');
  const btnTxt  = el('btn-confirm-text');
  const btnSpn  = el('btn-confirm-spinner');
  if (btnCfm) btnCfm.disabled = true;
  if (btnTxt) btnTxt.textContent = 'Guardando...';
  if (btnSpn) btnSpn.style.display = 'inline-block';

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

  if (DEMO_MODE || !_supabase) {
    const all = getLocalAppointments();
    all.push({ id: 'local-' + Date.now(), ...apptData, created_at: new Date().toISOString() });
    saveLocalAppointments(all);
    success = true;
  } else {
    try {
      const { error } = await _supabase.from('appointments').insert([apptData]);
      if (error) throw error;
      success = true;
    } catch (err) {
      console.error('Error guardando en Supabase, guardando local:', err);
      // Fallback: guardar localmente
      const all = getLocalAppointments();
      all.push({ id: 'local-' + Date.now(), ...apptData, created_at: new Date().toISOString() });
      saveLocalAppointments(all);
      success = true;
    }
  }

  if (btnCfm) btnCfm.disabled = false;
  if (btnTxt) btnTxt.textContent = 'Confirmar';
  if (btnSpn) btnSpn.style.display = 'none';

  if (!success) return;

  const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
  set('booking-code-value', code);
  set('success-service',    booking.service.name);
  set('success-date',       formatDate(booking.date));
  set('success-time',       booking.time);

  showStep('ok');
  showToast('¡Turno reservado con éxito!', 'success');
}

// ── Bind de eventos ────────────────────────────────────────
function bindEvents() {
  const on = (id, ev, fn) => { const e = el(id); if (e) e.addEventListener(ev, fn); };

  on('btn-open-booking',  'click', openBookingModal);
  on('btn-close-booking', 'click', closeBookingModal);
  on('btn-done',          'click', closeBookingModal);
  on('btn-step1-next',    'click', () => showStep(2));
  on('btn-step2-back',    'click', () => showStep(1));
  on('btn-step2-next',    'click', () => showStep(3));
  on('btn-step3-back',    'click', () => showStep(2));
  on('btn-confirm',       'click', confirmBooking);

  const modal = el('booking-modal');
  if (modal) modal.addEventListener('click', e => { if (e.target===modal) closeBookingModal(); });

  document.addEventListener('keydown', e => {
    if (e.key==='Escape') {
      const m = el('booking-modal');
      if (m && m.classList.contains('active')) closeBookingModal();
    }
  });
}

// ── localStorage ───────────────────────────────────────────
function getLocalAppointments()    { try { return JSON.parse(localStorage.getItem('blade_appointments')||'[]'); } catch { return []; } }
function saveLocalAppointments(d)  { try { localStorage.setItem('blade_appointments', JSON.stringify(d)); } catch {} }
function getLocalBlockedSlots()    { try { return JSON.parse(localStorage.getItem('blade_blocked_slots')||'[]'); } catch { return []; } }

// ── Utilidades ─────────────────────────────────────────────
function generateBookingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const p1 = ['Z','H','R','B','C','D','F','G','K','M','N','P','T','W'][Math.floor(Math.random()*14)];
  const p2 = ['H','R','C'][Math.floor(Math.random()*3)];
  const s  = Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  return `${p1}${p2}-${s}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '–';
  return new Date(dateStr+'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

function formatDuration(m) {
  if (m === 60) return '1 hora';
  if (m === 90) return '1 h 30 min';
  return m + ' min';
}

function formatDateISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function toLocalDate(d) { const r=new Date(d); r.setHours(0,0,0,0); return r; }

// ── Service Worker ─────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}
