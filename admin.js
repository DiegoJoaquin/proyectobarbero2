/**
 * ============================================================
 *  BLADE & CO. — admin.js  (panel del barbero)
 * ============================================================
 */

// ── Helpers DOM ────────────────────────────────────────────
const el  = id  => document.getElementById(id);
const qs  = (s,c) => (c||document).querySelector(s);
const qsa = (s,c) => Array.from((c||document).querySelectorAll(s));

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
    console.warn('Supabase no disponible, modo demo:', e.message);
    DEMO_MODE = true;
  }
}

// ── Estado ─────────────────────────────────────────────────
let selectedDate   = todayISO();
let selectedApptId = null;
let realtimeChannel = null;
let currentAppointments = [];
let currentBlockedSlots  = [];

// ── Toast (sin depender de domRefs) ───────────────────────
function showToast(msg, type = 'info', ms = 3500) {
  const c = el('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.setAttribute('role','alert');
  t.innerHTML = `<div class="toast-icon" aria-hidden="true"></div><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); t.addEventListener('animationend',()=>t.remove(),{once:true}); }, ms);
}

// ══════════════════════════════════════════════════════════
//  ARRANQUE
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  try { initAdmin(); } catch(e) { console.error('Error iniciando admin:', e); }
});

function initAdmin() {
  // Nombre del negocio en el logo
  const logo = el('admin-login-logo');
  if (logo) logo.textContent = CONFIG.business.name;

  // Banner demo
  if (DEMO_MODE) {
    const banner = el('demo-banner');
    if (banner) { banner.classList.add('visible'); document.body.classList.add('demo-mode'); }
  }

  initPinKeypad();
  bindAdminEvents();
  populateServiceSelect();
}

// ── PIN ────────────────────────────────────────────────────
let pinBuffer = '';

function initPinKeypad() {
  document.querySelectorAll('.pin-key').forEach(key => {
    key.addEventListener('click', () => handlePinKey(key.dataset.key));
    // Soporte teclado para divs con role=button
    key.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlePinKey(key.dataset.key);
      }
    });
  });

  // Teclado físico
  document.addEventListener('keydown', e => {
    if (el('admin-dashboard') && el('admin-dashboard').style.display !== 'none') return;
    if (/^\d$/.test(e.key)) handlePinKey(e.key);
    if (e.key === 'Backspace') handlePinKey('del');
  });
}

function handlePinKey(key) {
  if (key === 'clear')          pinBuffer = '';
  else if (key === 'del')       pinBuffer = pinBuffer.slice(0,-1);
  else if (pinBuffer.length<4)  pinBuffer += key;
  updatePinDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 150);
}

function updatePinDots() {
  [1,2,3,4].forEach(i => {
    const dot = el(`dot-${i}`);
    if (!dot) return;
    dot.classList.toggle('filled', i <= pinBuffer.length);
    dot.classList.remove('error');
  });
}

function checkPin() {
  if (String(pinBuffer) === String(CONFIG.adminPin)) {
    sessionStorage.setItem('blade_admin_auth','1');
    showDashboard();
  } else {
    [1,2,3,4].forEach(i => { const d=el(`dot-${i}`); if(d) d.classList.add('error'); });
    pinBuffer = '';
    setTimeout(updatePinDots, 600);
    showToast('PIN incorrecto. Intentá de nuevo.','error');
  }
}

// ── Dashboard ──────────────────────────────────────────────
function showDashboard() {
  const ls  = el('login-screen');
  const db  = el('admin-dashboard');
  const fab = el('fab-container');
  if (ls)  ls.style.display  = 'none';
  if (db)  db.style.display  = 'block';
  if (fab) fab.style.display = 'flex';
  selectedDate = todayISO();
  renderDateLabel();
  loadDayData();
  subscribeRealtime();
}

function logout() {
  sessionStorage.removeItem('blade_admin_auth');
  pinBuffer = '';
  updatePinDots();
  const ls  = el('login-screen');
  const db  = el('admin-dashboard');
  const fab = el('fab-container');
  if (ls)  ls.style.display  = 'flex';
  if (db)  db.style.display  = 'none';
  if (fab) fab.style.display = 'none';
  if (_supabase && realtimeChannel) { _supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
}

// ── Navegación de fechas ───────────────────────────────────
function renderDateLabel() {
  const lbl   = el('current-date-label');
  const badge = el('today-badge');
  if (!lbl) return;
  const d = new Date(selectedDate+'T00:00:00');
  const s = d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  lbl.textContent = s.charAt(0).toUpperCase()+s.slice(1);
  const isToday = selectedDate === todayISO();
  if (badge) badge.style.display = isToday ? 'inline-flex' : 'none';
  // Botón "Ir a hoy" solo se muestra si no es hoy
  const todayBtn = el('btn-today');
  if (todayBtn) todayBtn.style.visibility = isToday ? 'hidden' : 'visible';
}

function changeDate(delta) {
  const d = new Date(selectedDate+'T00:00:00');
  d.setDate(d.getDate()+delta);
  selectedDate = formatDateISO(d);
  renderDateLabel();
  loadDayData();
}

// ── Carga de datos ─────────────────────────────────────────
async function loadDayData() {
  const loadEl    = el('timeline-loading');
  const contentEl = el('timeline-content');
  if (loadEl)    loadEl.style.display = 'block';
  if (contentEl) contentEl.innerHTML  = '';

  let appointments = [];
  let blockedSlots  = [];

  if (DEMO_MODE || !_supabase) {
    appointments = getLocalAppointments()
      .filter(a => a.appointment_date === selectedDate)
      .sort((a,b) => a.appointment_time.localeCompare(b.appointment_time));
    blockedSlots = getLocalBlockedSlots().filter(b => b.slot_date === selectedDate);
  } else {
    try {
      const [apptRes, blockRes] = await Promise.all([
        _supabase.from('appointments').select('*').eq('appointment_date', selectedDate).order('appointment_time',{ascending:true}),
        _supabase.from('blocked_slots').select('*').eq('slot_date', selectedDate)
      ]);
      if (apptRes.error) throw apptRes.error;
      appointments = apptRes.data || [];
      blockedSlots  = blockRes.data  || [];
    } catch (err) {
      console.error('Error Supabase, usando local:', err);
      appointments = getLocalAppointments()
        .filter(a => a.appointment_date === selectedDate)
        .sort((a,b) => a.appointment_time.localeCompare(b.appointment_time));
      blockedSlots = getLocalBlockedSlots().filter(b => b.slot_date === selectedDate);
    }
  }

  if (loadEl) loadEl.style.display = 'none';
  currentAppointments = appointments;
  currentBlockedSlots  = blockedSlots;
  renderAgenda(appointments, blockedSlots);
  updateStats(appointments);
}

// ── Agenda ─────────────────────────────────────────────────
function renderAgenda(appts, blockedSlots) {
  const contentEl = el('timeline-content');
  if (!contentEl) return;

  const allSlots = generateAllSlots(selectedDate);

  if (!allSlots.length) {
    contentEl.innerHTML = `<div class="timeline-empty"><span class="timeline-empty-icon">📭</span><p class="timeline-empty-text">Sin horarios configurados para este día.</p></div>`;
    return;
  }

  const now     = new Date();
  const nowStr  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const isToday = selectedDate === todayISO();

  const statusLabels = { pending:'Pendiente', confirmed:'Confirmado', completed:'Completado', cancelled:'Cancelado' };

  const isBlocked = t => (blockedSlots||[]).some(b => t >= b.start_time.substring(0,5) && t < b.end_time.substring(0,5));
  const getBlock  = t => (blockedSlots||[]).find(b => t >= b.start_time.substring(0,5) && t < b.end_time.substring(0,5));

  let html = '<div class="agenda-wrap">';
  html    += '<div class="agenda-line" aria-hidden="true"></div>';

  for (const time of allSlots) {
    const appt    = appts.find(a => a.appointment_time?.substring(0,5) === time);
    const blocked = isBlocked(time);
    const isPast  = isToday && time < nowStr;

    let dotCls = 'agenda-dot';
    if (appt)    dotCls += ' booked';
    else if (blocked) dotCls += ' blocked';
    if (isPast)  dotCls += ' past';

    html += `<div class="agenda-row">`;
    html += `<div class="agenda-time${isPast?' past':''}">${time}</div>`;
    html += `<div class="${dotCls}" aria-hidden="true"></div>`;
    html += '<div class="agenda-slot">';

    if (appt) {
      const label    = statusLabels[appt.status] || appt.status;
      const cardCls  = ['agenda-appt-card', isPast?'past':'', appt.status].filter(Boolean).join(' ');
      html += `
        <div class="${cardCls}" data-appt-id="${appt.id}"
          role="button" tabindex="0"
          aria-label="Turno de ${escHtml(appt.client_name)}, ${label}">
          <div>
            <div class="appt-name">${escHtml(appt.client_name)}</div>
            <div class="appt-service">${escHtml(appt.service)}</div>
          </div>
          <div class="status-badge ${appt.status}">${label}</div>
        </div>`;
    } else if (blocked) {
      const block = getBlock(time);
      html += `<div class="agenda-blocked"><span>🔒</span>${escHtml(block?.reason || 'Bloqueado')}</div>`;
    } else {
      html += `<div class="agenda-free" data-time="${time}" data-date="${selectedDate}"
        role="button" tabindex="0" aria-label="Libre a las ${time}, toca para agregar">
        <span class="plus-icon">+</span> Libre — toca para agregar
      </div>`;
    }

    html += '</div></div>';
  }

  html += '</div>';
  contentEl.innerHTML = html;

  // Eventos en tarjetas de citas
  qsa('.agenda-appt-card', contentEl).forEach(card => {
    const open = () => openApptDetail(card.dataset.apptId);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();open();} });
  });

  // Eventos en slots libres
  qsa('.agenda-free', contentEl).forEach(slot => {
    const open = () => openAddApptModalForSlot(slot.dataset.date, slot.dataset.time);
    slot.addEventListener('click', open);
    slot.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();open();} });
  });

  // Scroll suave al primer turno futuro si es hoy
  if (isToday) {
    const firstFuture = qsa('.agenda-row', contentEl).find(r => {
      const t = r.querySelector('.agenda-time');
      return t && t.textContent >= nowStr;
    });
    if (firstFuture) setTimeout(()=>firstFuture.scrollIntoView({behavior:'smooth',block:'center'}), 200);
  }
}

/** Abre el modal de nuevo turno pre-relleno con fecha y hora */
function openAddApptModalForSlot(date, time) {
  closeFab();
  const dateEl = el('add-date');
  if (dateEl) { dateEl.value = date; dateEl.min = todayISO(); }
  openModal('add-appt-modal');
  loadAddTimeSlots(date).then(() => {
    const sel = el('add-time-select');
    if (sel) sel.value = time;
  });
  el('add-name')?.focus();
}

function updateStats(appts) {
  const set = (id,v) => { const e=el(id); if(e) e.textContent=v; };
  set('stat-total',   appts.length);
  set('stat-pending', appts.filter(a=>['pending','confirmed'].includes(a.status)).length);
  set('stat-done',    appts.filter(a=>a.status==='completed').length);
}

// ── Modal detalle ──────────────────────────────────────────
function openApptDetail(apptId) {
  const appt = currentAppointments.find(a => a.id === apptId);
  if (!appt) return;
  selectedApptId = apptId;

  const time  = appt.appointment_time?.substring(0,5) ?? '--:--';
  const date  = formatDate(appt.appointment_date);
  const labels = { pending:'Pendiente', confirmed:'Confirmado', completed:'Completado', cancelled:'Cancelado' };
  const label  = labels[appt.status] || appt.status;
  const canAct = ['pending','confirmed'].includes(appt.status);

  const body = el('appt-detail-body');
  if (!body) return;

  body.innerHTML = `
    <div class="appt-detail-header">
      <div class="appt-detail-name">${escHtml(appt.client_name)}</div>
      <div class="appt-detail-meta"><span class="status-badge ${appt.status}">${label}</span></div>
    </div>
    <div class="detail-row"><span class="detail-icon">✂️</span><span class="detail-label">Servicio</span><span class="detail-value">${escHtml(appt.service)}</span></div>
    <div class="detail-row"><span class="detail-icon">📅</span><span class="detail-label">Fecha</span><span class="detail-value">${date}</span></div>
    <div class="detail-row"><span class="detail-icon">🕐</span><span class="detail-label">Hora</span><span class="detail-value">${time}</span></div>
    <div class="detail-row"><span class="detail-icon">📞</span><span class="detail-label">Teléfono</span>
      <span class="detail-value"><a href="tel:${encodeURIComponent(appt.client_phone)}" class="phone-link">${escHtml(appt.client_phone)}</a></span></div>
    ${appt.notes ? `<div class="detail-row"><span class="detail-icon">📝</span><span class="detail-label">Notas</span><span class="detail-value">${escHtml(appt.notes)}</span></div>` : ''}
    <div class="appt-detail-actions" style="margin-top:20px">
      ${canAct ? `<button class="btn btn-success btn-full" id="btn-complete-appt">✓ Marcar como completado</button>
                  <button class="btn btn-danger btn-full"  id="btn-cancel-appt">✕ Cancelar turno</button>` : ''}
    </div>`;

  const cmp = el('btn-complete-appt');
  const cnc = el('btn-cancel-appt');
  if (cmp) cmp.addEventListener('click', () => updateApptStatus(apptId,'completed'));
  if (cnc) cnc.addEventListener('click', () => updateApptStatus(apptId,'cancelled'));

  openModal('appt-detail-modal');
}

async function updateApptStatus(apptId, newStatus) {
  if (DEMO_MODE || !_supabase) {
    const all = getLocalAppointments();
    const idx = all.findIndex(a => a.id===apptId);
    if (idx>=0) { all[idx].status=newStatus; saveLocalAppointments(all); }
  } else {
    try {
      const { error } = await _supabase.from('appointments').update({status:newStatus}).eq('id',apptId);
      if (error) throw error;
    } catch(err) {
      console.error('Error actualizando, guardando local:', err);
      const all = getLocalAppointments();
      const idx = all.findIndex(a => a.id===apptId);
      if (idx>=0) { all[idx].status=newStatus; saveLocalAppointments(all); }
    }
  }
  showToast(newStatus==='completed'?'Turno marcado como completado.':'Turno cancelado.','success');
  closeModal('appt-detail-modal');
  await loadDayData();
}

// ── FAB ────────────────────────────────────────────────────
let fabOpen = false;

function toggleFab() {
  fabOpen = !fabOpen;
  const c = el('fab-container');
  const m = el('fab-main');
  if (c) c.classList.toggle('open', fabOpen);
  if (m) m.setAttribute('aria-expanded', String(fabOpen));
}

function closeFab() {
  fabOpen = false;
  const c = el('fab-container');
  const m = el('fab-main');
  if (c) c.classList.remove('open');
  if (m) m.setAttribute('aria-expanded','false');
}

// ── Modal agregar turno ────────────────────────────────────
function openAddApptModal() {
  closeFab();
  const dateEl = el('add-date');
  if (dateEl) { dateEl.value = selectedDate; dateEl.min = todayISO(); }
  loadAddTimeSlots(selectedDate);
  openModal('add-appt-modal');
  el('add-name')?.focus();
}

async function loadAddTimeSlots(dateStr) {
  const sel = el('add-time-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando...</option>';
  if (!dateStr) { sel.innerHTML='<option value="">— Elegí primero la fecha —</option>'; return; }

  const allSlots = generateAllSlots(dateStr);
  let occupiedTimes = [];
  let blockedRanges = [];

  if (DEMO_MODE || !_supabase) {
    const all = getLocalAppointments();
    occupiedTimes = all.filter(a=>a.appointment_date===dateStr&&['pending','confirmed'].includes(a.status)).map(a=>a.appointment_time.substring(0,5));
    blockedRanges = getLocalBlockedSlots().filter(b=>b.slot_date===dateStr);
  } else {
    try {
      const [ar,br] = await Promise.all([
        _supabase.from('appointments').select('appointment_time').eq('appointment_date',dateStr).in('status',['pending','confirmed']),
        _supabase.from('blocked_slots').select('start_time,end_time').eq('slot_date',dateStr)
      ]);
      if (!ar.error) occupiedTimes=(ar.data||[]).map(a=>a.appointment_time.substring(0,5));
      if (!br.error) blockedRanges=br.data||[];
    } catch {}
  }

  const isBlocked = t => blockedRanges.some(b=>t>=b.start_time.substring(0,5)&&t<b.end_time.substring(0,5));
  const available = allSlots.filter(t=>!occupiedTimes.includes(t)&&!isBlocked(t));

  if (!available.length) { sel.innerHTML='<option value="">Sin horarios disponibles</option>'; return; }
  sel.innerHTML = '<option value="">— Elegí un horario —</option>' + available.map(t=>`<option value="${t}">${t}</option>`).join('');
}

async function saveNewAppt() {
  const name    = el('add-name')?.value.trim()      || '';
  const phone   = el('add-phone')?.value.trim()     || '';
  const service = el('add-service')?.value          || '';
  const date    = el('add-date')?.value             || '';
  const time    = el('add-time-select')?.value      || '';
  const notes   = el('add-notes')?.value.trim()     || '';

  if (!name||!phone||!service||!date||!time) { showToast('Completá todos los campos obligatorios.','error'); return; }

  const btn = el('btn-save-appt');
  const txt = el('btn-save-appt-text');
  const spn = el('btn-save-appt-spinner');
  if (btn) btn.disabled=true; if(txt) txt.textContent='Guardando...'; if(spn) spn.style.display='inline-block';

  const apptData = {
    client_name: name, client_phone: phone, service,
    appointment_date: date, appointment_time: time+':00',
    status: 'confirmed', notes: notes||null
  };

  if (!DEMO_MODE && _supabase) {
    try {
      const { error } = await _supabase.from('appointments').insert([apptData]);
      if (error) throw error;
    } catch(err) {
      console.error('Guardando local como fallback:', err);
      const all = getLocalAppointments();
      all.push({ id:'local-'+Date.now(), ...apptData, created_at: new Date().toISOString() });
      saveLocalAppointments(all);
    }
  } else {
    const all = getLocalAppointments();
    all.push({ id:'local-'+Date.now(), ...apptData, created_at: new Date().toISOString() });
    saveLocalAppointments(all);
  }

  if (btn) btn.disabled=false; if(txt) txt.textContent='Guardar turno'; if(spn) spn.style.display='none';
  showToast('¡Turno agregado correctamente!','success');
  closeModal('add-appt-modal');
  selectedDate = date;
  renderDateLabel();
  await loadDayData();
}

// ── Modal bloquear horarios ────────────────────────────────
function openBlockModal() {
  closeFab();
  const d = el('block-date'); if(d) { d.value=selectedDate; d.min=todayISO(); }
  const s = el('block-start'); if(s) s.value='';
  const e2= el('block-end');   if(e2) e2.value='';
  const r = el('block-reason');if(r) r.value='';
  openModal('block-modal');
}

async function saveBlock() {
  const date   = el('block-date')?.value   || '';
  const start  = el('block-start')?.value  || '';
  const end    = el('block-end')?.value    || '';
  const reason = el('block-reason')?.value?.trim() || '';

  if (!date||!start||!end) { showToast('Completá fecha, inicio y fin.','error'); return; }
  if (start>=end) { showToast('La hora de fin debe ser después del inicio.','error'); return; }

  const btn=el('btn-save-block'),txt=el('btn-save-block-text'),spn=el('btn-save-block-spinner');
  if(btn) btn.disabled=true; if(txt) txt.textContent='Guardando...'; if(spn) spn.style.display='inline-block';

  const blockData = { slot_date:date, start_time:start+':00', end_time:end+':00', reason:reason||null };

  if (!DEMO_MODE && _supabase) {
    try {
      const { error } = await _supabase.from('blocked_slots').insert([blockData]);
      if (error) throw error;
    } catch(err) {
      console.error('Fallback local para bloqueo:', err);
      const all = getLocalBlockedSlots();
      all.push({ id:'local-'+Date.now(), ...blockData });
      saveLocalBlockedSlots(all);
    }
  } else {
    const all = getLocalBlockedSlots();
    all.push({ id:'local-'+Date.now(), ...blockData });
    saveLocalBlockedSlots(all);
  }

  if(btn) btn.disabled=false; if(txt) txt.textContent='Bloquear horario'; if(spn) spn.style.display='none';
  showToast('Horario bloqueado.','success');
  closeModal('block-modal');
  if (date===selectedDate) await loadDayData();
}

// ── Servicios ──────────────────────────────────────────────
function populateServiceSelect() {
  const sel = el('add-service');
  if (!sel) return;
  sel.innerHTML = CONFIG.services.map(s=>`<option value="${escHtml(s.name)}">${escHtml(s.name)}</option>`).join('');
}

// ── Realtime ───────────────────────────────────────────────
function subscribeRealtime() {
  if (DEMO_MODE || !_supabase) return;
  realtimeChannel = _supabase.channel('appt-changes')
    .on('postgres_changes',{event:'*',schema:'public',table:'appointments'},()=>loadDayData())
    .subscribe();
}

// ── Generador de slots ─────────────────────────────────────
function generateAllSlots(dateStr) {
  const dow = new Date(dateStr+'T00:00:00').getDay();
  const hrs = dow===6 ? CONFIG.workingHours.saturday : CONFIG.workingHours.weekdays;
  const [eh,em]=hrs.end.split(':').map(Number);
  const [sh,sm]=hrs.start.split(':').map(Number);
  const endMin=eh*60+em;
  const slots=[];
  let cur=sh*60+sm;
  while(cur+CONFIG.slotDuration<=endMin){
    slots.push(`${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`);
    cur+=CONFIG.slotDuration;
  }
  return slots;
}

// ── Modales genéricos ──────────────────────────────────────
function openModal(id) {
  const m = el(id); if(m) { m.classList.add('active'); document.body.style.overflow='hidden'; }
}
function closeModal(id) {
  const m = el(id); if(m) m.classList.remove('active');
  document.body.style.overflow='';
}

// ── Bind de eventos ────────────────────────────────────────
function bindAdminEvents() {
  const on = (id,ev,fn) => { const e=el(id); if(e) e.addEventListener(ev,fn); };

  // Topbar
  on('btn-date-prev','click', ()=>changeDate(-1));
  on('btn-date-next','click', ()=>changeDate(1));
  on('btn-today',    'click', ()=>{ selectedDate=todayISO(); renderDateLabel(); loadDayData(); });
  on('btn-logout',   'click', logout);

  // Modales
  on('btn-close-appt-detail','click', ()=>closeModal('appt-detail-modal'));
  on('btn-close-add-appt',   'click', ()=>closeModal('add-appt-modal'));
  on('btn-close-block',      'click', ()=>closeModal('block-modal'));
  on('btn-save-appt',        'click', saveNewAppt);
  on('btn-save-block',       'click', saveBlock);
  on('add-date',             'change', ()=>loadAddTimeSlots(el('add-date')?.value));

  // Cerrar modal al tocar overlay
  ['appt-detail-modal','add-appt-modal','block-modal'].forEach(id => {
    const m = el(id); if(m) m.addEventListener('click', e=>{ if(e.target===m) closeModal(id); });
  });

  // FAB
  on('fab-main',  'click', toggleFab);
  on('fab-add',   'click', openAddApptModal);
  on('fab-block', 'click', openBlockModal);
  document.addEventListener('click', e=>{ if(fabOpen && !el('fab-container')?.contains(e.target)) closeFab(); });

  // Escape
  document.addEventListener('keydown', e=>{
    if(e.key!=='Escape') return;
    if(el('appt-detail-modal')?.classList.contains('active')) closeModal('appt-detail-modal');
    else if(el('add-appt-modal')?.classList.contains('active')) closeModal('add-appt-modal');
    else if(el('block-modal')?.classList.contains('active')) closeModal('block-modal');
    else closeFab();
  });
}

// ── localStorage ───────────────────────────────────────────
function getLocalAppointments()    { try{return JSON.parse(localStorage.getItem('blade_appointments')||'[]');}catch{return[];} }
function saveLocalAppointments(d)  { try{localStorage.setItem('blade_appointments',JSON.stringify(d));}catch{} }
function getLocalBlockedSlots()    { try{return JSON.parse(localStorage.getItem('blade_blocked_slots')||'[]');}catch{return[];} }
function saveLocalBlockedSlots(d)  { try{localStorage.setItem('blade_blocked_slots',JSON.stringify(d));}catch{} }

// ── Utilidades ─────────────────────────────────────────────
function todayISO() {
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDate(dateStr) {
  if(!dateStr) return '–';
  return new Date(dateStr+'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
function escHtml(str) {
  if(!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
