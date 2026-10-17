/*
 * CEPRODENT · Aula de simulación clínica
 * Aplicación estática académica: datos ficticios, persistencia local y JSON import/export.
 * No es una historia clínica ni una herramienta para prescribir o dispensar en la vida real.
 */
'use strict';

const STORAGE_KEY = 'ceprodent_aula_simulacion_v1';
const volatileStorage = new Map();
function getSavedItem(key) { try { return localStorage.getItem(key); } catch (_) { return volatileStorage.get(key) ?? null; } }
function setSavedItem(key, value) { const text = String(value); try { localStorage.setItem(key, text); } catch (_) { volatileStorage.set(key, text); } }
function removeSavedItem(key) { try { localStorage.removeItem(key); } catch (_) {} volatileStorage.delete(key); }
const appState = {
  db: null,
  currentUser: null,
  view: 'landing',
  authMode: 'login',
  selectedModule: 'enfermeria',
  activeModule: 'enfermeria',
  page: 'dashboard',
  search: {},
  posSearch: '',
  cart: [],
  modalContext: {},
  menuOpen: false
};

const PAGE_META = {
  dashboard: ['Panel general', 'Resumen de actividad académica y accesos rápidos.'],
  patients: ['Pacientes simulados', 'Expedientes ficticios para practicar búsqueda, registro y documentación.'],
  serviceOrders: ['Órdenes de servicio', 'Crea y sigue órdenes de procedimientos y cuidados simulados.'],
  medicationOrders: ['Órdenes de medicamentos', 'Registra pautas ficticias y su horario de práctica.'],
  schedule: ['Agenda de administración', 'Registra el resultado de cada horario simulado y su justificación.'],
  evolutions: ['Notas de enfermería', 'Practica la estructura de notas y evoluciones del caso académico.'],
  vitals: ['Signos vitales', 'Practica la captura y consulta de mediciones ficticias; no incluye interpretación clínica.'],
  pos: ['Punto de venta', 'Simula una venta, controla cantidades y registra un comprobante académico.'],
  products: ['Productos e inventario', 'Consulta códigos, lotes, existencias y fechas de vencimiento.'],
  incoming: ['Compras y entradas', 'Registra entradas simuladas para actualizar las existencias.'],
  movements: ['Movimientos de inventario', 'Consulta entradas, salidas, ajustes y responsables.'],
  sales: ['Ventas registradas', 'Historial de comprobantes creados en el punto de venta.'],
  reports: ['Reportes académicos', 'Indicadores y listados del entorno local de práctica.'],
  users: ['Usuarios de práctica', 'Consulta y administra las cuentas locales de esta instalación.'],
  backup: ['Datos y respaldos', 'Exporta o restaura el conjunto de datos local en formato JSON.']
};

const NAV_NURSING = [
  { group: 'PRÁCTICA CLÍNICA', items: [
    ['dashboard', '▦', 'Panel general'], ['patients', '♙', 'Pacientes simulados'], ['serviceOrders', '▤', 'Órdenes de servicio'],
    ['medicationOrders', '✚', 'Órdenes de medicamentos'], ['schedule', '◷', 'Agenda de administración'], ['vitals', '⌁', 'Signos vitales'], ['evolutions', '≋', 'Notas de enfermería']
  ] },
  { group: 'SEGUIMIENTO', items: [['reports', '▥', 'Reportes académicos']] }
];
const NAV_PHARMACY = [
  { group: 'OPERACIÓN DE FARMACIA', items: [
    ['dashboard', '▦', 'Panel general'], ['pos', '▣', 'Punto de venta'], ['products', '▤', 'Productos e inventario'],
    ['incoming', '↓', 'Compras y entradas'], ['movements', '⇄', 'Movimientos'], ['sales', '▧', 'Ventas registradas']
  ] },
  { group: 'SEGUIMIENTO', items: [['reports', '▥', 'Reportes académicos']] }
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const clone = value => JSON.parse(JSON.stringify(value));
const isoNow = () => new Date().toISOString();
const localDate = (date = new Date()) => {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const randomId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const money = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
const formatDate = value => {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};
const formatDateTime = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
};
const formatCount = value => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(value || 0));
const initials = name => String(name || 'U').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
const roleLabel = role => ({ admin: 'Administrador académico', enfermeria: 'Enfermería', farmacia: 'Farmacia' }[role] || 'Usuario');
const moduleLabel = module => module === 'farmacia' ? 'Farmacia' : 'Enfermería';
const patientById = id => appState.db.patients.find(item => item.id === id);
const productById = id => appState.db.products.find(item => item.id === id);
const userById = id => appState.db.users.find(item => item.id === id);
const medName = order => productById(order.medicationId)?.name || 'Medicamento eliminado';
const patientName = id => patientById(id)?.name || 'Paciente no disponible';
const nextNumber = key => {
  const counters = appState.db.counters || (appState.db.counters = {});
  const value = Number(counters[key] || 1);
  counters[key] = value + 1;
  const prefixes = { serviceOrder: 'OS', medicationOrder: 'OM', sale: 'VT', patient: 'CE', movement: 'MOV', product: 'MED', evolution: 'EV' };
  return `${prefixes[key] || 'REG'}-${String(value).padStart(4, '0')}`;
};

async function hashPassword(password) {
  // SHA-256 cuando el navegador está en contexto seguro; el fallback solo permite demos locales.
  try {
    if (globalThis.crypto?.subtle) {
      const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(password)));
      return 'sha256:' + Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch (_) { /* fallback académico */ }
  let hash = 2166136261;
  const input = String(password);
  for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return 'local:' + (hash >>> 0).toString(16);
}

async function loadSeed() {
  try {
    const response = await fetch('./data/seed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo leer seed.json');
    return await response.json();
  } catch (_) {
    if (window.CEPRODENT_SEED) return clone(window.CEPRODENT_SEED);
    throw new Error('No fue posible cargar los datos iniciales. Revisa data/seed.json y data/seed-fallback.js.');
  }
}

async function createInitialDb() {
  const seed = await loadSeed();
  const demoUsers = await Promise.all(seed.demoUsers.map(async user => ({
    id: user.id, name: user.name, email: user.email.toLowerCase(), document: user.document,
    role: user.role, passwordHash: await hashPassword(user.password), active: user.active !== false,
    createdAt: isoNow(), isDemo: true
  })));
  const db = {
    version: Number(seed.version || 1), institution: seed.institution || { name: 'CEPRODENT', subtitle: 'Aula de simulación clínica' },
    users: demoUsers, patients: seed.patients || [], products: seed.products || [], serviceOrders: seed.serviceOrders || [],
    medicationOrders: seed.medicationOrders || [], administrations: seed.administrations || [], evolutions: seed.evolutions || [], vitals: seed.vitals || [],
    sales: seed.sales || [], movements: seed.movements || [], counters: seed.counters || {}, createdAt: isoNow(), lastSavedAt: isoNow()
  };
  const seenProducts = new Set(db.movements.map(movement => movement.productId));
  db.products.forEach(product => {
    if (!seenProducts.has(product.id)) {
      db.movements.push({ id: randomId('mov'), productId: product.id, type: 'Entrada', quantityDelta: Number(product.stock || 0), balanceAfter: Number(product.stock || 0), reference: 'Saldo inicial de práctica', note: 'Registro inicial ficticio.', userId: 'usr-admin', createdAt: '2026-10-15T09:00:00.000Z' });
    }
  });
  return db;
}

function normalizeDb(db) {
  const keys = ['users', 'patients', 'products', 'serviceOrders', 'medicationOrders', 'administrations', 'evolutions', 'vitals', 'sales', 'movements'];
  keys.forEach(key => { if (!Array.isArray(db[key])) db[key] = []; });
  if (!db.institution) db.institution = { name: 'CEPRODENT', subtitle: 'Aula de simulación clínica' };
  if (!db.counters) db.counters = {};
  db.products.forEach(product => { if (typeof product.active !== 'boolean') product.active = true; });
  return db;
}

async function boot() {
  try {
    const raw = getSavedItem(STORAGE_KEY);
    if (raw) {
      appState.db = normalizeDb(JSON.parse(raw));
    } else {
      appState.db = await createInitialDb();
      persistDb(false);
    }
    renderRoot();
  } catch (error) {
    $('#app').innerHTML = `<div class="empty-state" style="min-height:100vh"><div class="empty-icon">!</div><strong>No se pudo iniciar el simulador</strong><p>${escapeHtml(error.message || 'Error de inicialización')}</p><button class="btn" data-action="reload">Volver a intentar</button></div>`;
  }
}

function persistDb(showFeedback = false) {
  try {
    appState.db.lastSavedAt = isoNow();
    setSavedItem(STORAGE_KEY, JSON.stringify(appState.db));
    if (showFeedback) toast('Cambios guardados en este navegador.', 'success');
  } catch (error) {
    toast('No se pudo guardar. El almacenamiento local puede estar lleno o deshabilitado.', 'error');
  }
}

function toast(message, type = 'success') {
  const region = $('#toast-region');
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.innerHTML = `<span class="toast-symbol">${type === 'error' ? '!' : '✓'}</span><span>${escapeHtml(message)}</span>`;
  region.appendChild(node);
  window.setTimeout(() => node.remove(), 4200);
}

function renderRoot() {
  if (appState.view === 'workspace' && appState.currentUser) renderWorkspace();
  else if (appState.view === 'auth') renderAuth();
  else renderLanding();
}

function renderLanding() {
  const institution = appState.db.institution;
  $('#app').innerHTML = `
    <div class="landing-shell">
      <header class="landing-nav">
        <div class="brand-inline"><div class="brand-mark">C<span>+</span></div><div><div class="brand-name">${escapeHtml(institution.name || 'CEPRODENT')}</div><div class="brand-caption">Aula de simulación clínica</div></div></div>
        <div class="nav-actions"><button class="btn btn-secondary" data-action="auth-login" data-module="enfermeria">Iniciar sesión</button><button class="btn" data-action="auth-register" data-module="enfermeria">Crear cuenta <span aria-hidden="true">↗</span></button></div>
      </header>
      <main class="landing-main">
        <section class="hero-grid">
          <div>
            <div class="eyebrow">PLATAFORMA DE ENTRENAMIENTO ACADÉMICO</div>
            <h1 class="hero-title">Aprender el proceso.<br><span class="highlight">Dominar la práctica.</span></h1>
            <p class="hero-description">Un entorno de simulación para comprender los flujos básicos de enfermería y farmacia: registros, órdenes, administración de medicamentos, inventario, dispensación y seguimiento.</p>
            <div class="hero-note"><span class="note-icon">i</span><span><strong>Solo para enseñanza.</strong> Todos los pacientes, órdenes, usuarios y movimientos son ficticios. No utilizar para atención clínica real, prescripción ni dispensación.</span></div>
          </div>
          <div class="hero-visual" aria-hidden="true">
            <div class="hero-visual-backdrop"></div>
            <div class="hero-dashboard">
              <div class="mini-topline"><div><div class="mini-heading">Aula de simulación</div><div class="mini-sub">Panel académico · ${escapeHtml(institution.name || 'CEPRODENT')}</div></div><span class="badge success"><span class="mini-dot"></span>Entorno demo</span></div>
              <div class="mini-stat-grid">
                <div class="mini-stat"><div class="mini-stat-icon">✚</div><strong>02</strong><span>Módulos prácticos</span></div>
                <div class="mini-stat"><div class="mini-stat-icon">▤</div><strong>JSON</strong><span>Datos de ejemplo</span></div>
                <div class="mini-stat"><div class="mini-stat-icon">◷</div><strong>24/7</strong><span>Práctica local</span></div>
                <div class="mini-stat"><div class="mini-stat-icon">↔</div><strong>100%</strong><span>Datos ficticios</span></div>
              </div>
              <div class="mini-activity">
                <div class="mini-activity-row"><div class="mini-activity-label"><span class="mini-square">N</span><span>Órdenes de enfermería</span></div><span class="badge teal">Simulación</span></div>
                <div class="mini-activity-row"><div class="mini-activity-label"><span class="mini-square">F</span><span>Inventario y dispensación</span></div><span class="badge info">Práctica</span></div>
              </div>
            </div>
          </div>
        </section>
        <section class="module-section">
          <div class="section-title-row"><div><div class="eyebrow">ELIGE TU ÁREA</div><h2 class="section-title">¿Dónde quieres practicar?</h2><p class="section-subtitle">Entra al módulo correspondiente o inicia sesión con tu cuenta académica.</p></div><span class="badge">Versión académica 1.0</span></div>
          <div class="module-grid">
            <article class="module-card">
              <div class="module-card-head"><div class="module-symbol">✚</div><span class="badge teal">Cuidados y registros</span></div>
              <div class="module-kicker">MÓDULO 01</div><h3 class="module-title">Enfermería</h3>
              <p class="module-description">Practica la gestión de pacientes ficticios, órdenes de servicio, pautas de medicamentos, horarios de aplicación, notas de enfermería y reportes de seguimiento.</p>
              <div class="module-tags"><span class="tag">Pacientes simulados</span><span class="tag">Órdenes</span><span class="tag">Agenda</span><span class="tag">Evoluciones</span></div>
              <div class="module-footer"><span>Ideal para prácticas guiadas</span><button class="btn" data-action="auth-login" data-module="enfermeria">Entrar a enfermería <span>→</span></button></div>
            </article>
            <article class="module-card pharmacy">
              <div class="module-card-head"><div class="module-symbol">▣</div><span class="badge info">Inventario y ventas</span></div>
              <div class="module-kicker">MÓDULO 02</div><h3 class="module-title">Farmacia</h3>
              <p class="module-description">Aprende a registrar productos, controlar lotes y vencimientos, recibir mercancía, realizar ventas simuladas y consultar movimientos de inventario y caja.</p>
              <div class="module-tags"><span class="tag">Punto de venta</span><span class="tag">Lotes</span><span class="tag">Compras</span><span class="tag">Reportes</span></div>
              <div class="module-footer"><span>Operación de farmacia demo</span><button class="btn" data-action="auth-login" data-module="farmacia">Entrar a farmacia <span>→</span></button></div>
            </article>
          </div>
        </section>
      </main>
      <footer class="landing-bottom"><div class="landing-bottom-inner"><span>© ${new Date().getFullYear()} ${escapeHtml(institution.name || 'CEPRODENT')} · Entorno de formación académica.</span><span>Los cambios se guardan en el almacenamiento local del navegador, no en un servidor compartido.</span></div></footer>
    </div>`;
}

function renderAuth() {
  const isRegister = appState.authMode === 'register';
  const module = appState.selectedModule || 'enfermeria';
  const label = moduleLabel(module);
  const institution = appState.db.institution;
  $('#app').innerHTML = `
    <div class="auth-shell">
      <aside class="auth-aside">
        <div class="brand-inline"><div class="brand-mark">C<span>+</span></div><div><div class="brand-name">${escapeHtml(institution.name || 'CEPRODENT')}</div><div class="brand-caption">Aula de simulación clínica</div></div></div>
        <div class="auth-aside-content"><div class="eyebrow" style="color:#b7f5e2">ACCESO ACADÉMICO</div><h1>Aprendizaje aplicado, en un entorno seguro.</h1><p>Ingresa al módulo de ${label.toLowerCase()} para trabajar con casos inventados, procesos de ejemplo y registros de práctica.</p><div class="auth-feature"><span class="auth-feature-icon">✓</span><span>Datos de práctica editables y respaldables</span></div><div class="auth-feature"><span class="auth-feature-icon">✓</span><span>Roles diferenciados por módulo</span></div><div class="auth-feature"><span class="auth-feature-icon">✓</span><span>No requiere base de datos ni instalación</span></div></div>
        <div class="small" style="color:rgba(255,255,255,.62);position:relative;z-index:1">Uso educativo · No válido para atención de pacientes reales.</div>
      </aside>
      <main class="auth-main"><section class="auth-panel">
        <button class="btn btn-ghost auth-back" data-action="back-home">← Volver al inicio</button>
        <div class="eyebrow">MÓDULO DE ${escapeHtml(label.toUpperCase())}</div>
        <h2 class="auth-heading">${isRegister ? 'Crear cuenta académica' : 'Bienvenida al aula'}</h2>
        <p class="auth-intro">${isRegister ? 'Registra tu perfil para practicar con los datos locales de este navegador.' : 'Ingresa con tu cuenta o utiliza una de las cuentas demo incluidas.'}</p>
        <form class="auth-form" data-form="${isRegister ? 'register' : 'login'}">
          ${isRegister ? `<div class="field"><label for="reg-name">Nombre completo</label><input id="reg-name" class="input" name="name" maxlength="90" required placeholder="Nombre de estudiante"></div>
          <div class="field"><label for="reg-document">Código académico o documento ficticio</label><input id="reg-document" class="input" name="document" maxlength="35" required placeholder="Ej. EST-1024"><div class="hint">No ingreses documentos personales reales.</div></div>` : ''}
          <div class="field"><label for="auth-email">Correo electrónico</label><input id="auth-email" class="input" type="email" name="email" autocomplete="username" required placeholder="estudiante@ceprodent.edu.co"></div>
          <div class="field"><label for="auth-password">Contraseña</label><input id="auth-password" class="input" type="password" name="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" minlength="6" required placeholder="${isRegister ? 'Mínimo 6 caracteres' : 'Escribe tu contraseña'}"></div>
          ${isRegister ? `<div class="field"><label for="reg-role">Perfil de práctica</label><select id="reg-role" class="select" name="role" required><option value="enfermeria" ${module === 'enfermeria' ? 'selected' : ''}>Enfermería</option><option value="farmacia" ${module === 'farmacia' ? 'selected' : ''}>Farmacia</option></select><div class="hint">El registro público no permite crear administradores.</div></div>` : ''}
          <button class="btn btn-block" type="submit">${isRegister ? 'Crear cuenta y entrar' : 'Ingresar al módulo'} <span>→</span></button>
        </form>
        <div class="auth-helper"><strong>Importante:</strong> las cuentas se guardan solo en este navegador. Este acceso es una simulación educativa, no un sistema de autenticación adecuado para datos reales.</div>
        ${isRegister ? `<p class="small muted" style="margin:18px 0 0;text-align:center">¿Ya tienes una cuenta? <button class="panel-link" data-action="auth-login" data-module="${escapeHtml(module)}">Inicia sesión</button></p>` : `
          <div class="rule"></div><div class="small muted" style="font-weight:700">CUENTAS DE DEMOSTRACIÓN</div><div class="auth-demo-list">
            ${demoLoginRow('Administrador académico', 'admin@ceprodent.edu.co', 'Admin123!', 'admin', module)}
            ${demoLoginRow('Estudiante · Enfermería', 'enfermeria@ceprodent.edu.co', 'Enfermeria123!', 'enfermeria', module)}
            ${demoLoginRow('Estudiante · Farmacia', 'farmacia@ceprodent.edu.co', 'Farmacia123!', 'farmacia', module)}
          </div><p class="small muted" style="margin:16px 0 0;text-align:center">¿Primera vez aquí? <button class="panel-link" data-action="auth-register" data-module="${escapeHtml(module)}">Crear cuenta local</button></p>`}
      </section></main>
    </div>`;
}

function demoLoginRow(label, email, password, role, module) {
  return `<div class="demo-login-row"><div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(email)} · ${escapeHtml(password)}</span></div><button type="button" class="btn btn-secondary btn-small" data-action="demo-login" data-email="${escapeHtml(email)}" data-password="${escapeHtml(password)}" data-module="${escapeHtml(module)}" data-role="${escapeHtml(role)}">Usar</button></div>`;
}

function navGroupsForUser() {
  const user = appState.currentUser;
  const groups = appState.activeModule === 'farmacia' ? clone(NAV_PHARMACY) : clone(NAV_NURSING);
  if (user?.role === 'admin') groups.push({ group: 'ADMINISTRACIÓN ACADÉMICA', items: [['users', '♙', 'Usuarios de práctica'], ['backup', '⇧', 'Datos y respaldos']] });
  return groups;
}

function renderWorkspace() {
  const user = appState.currentUser;
  if (!user) { appState.view = 'landing'; renderLanding(); return; }
  const module = appState.activeModule;
  const pageMeta = PAGE_META[appState.page] || PAGE_META.dashboard;
  const moduleNav = navGroupsForUser();
  const visiblePage = pageAllowed(appState.page, user, module) ? appState.page : 'dashboard';
  if (visiblePage !== appState.page) appState.page = visiblePage;
  const navHtml = moduleNav.map(group => `<div class="sidebar-group-label">${escapeHtml(group.group)}</div><nav class="sidebar-nav">${group.items.map(([key, icon, title]) => {
    const count = key === 'serviceOrders' ? appState.db.serviceOrders.filter(item => item.status === 'Pendiente').length : key === 'schedule' ? getTodaySchedule().filter(item => !item.record).length : key === 'products' ? appState.db.products.filter(item => item.active !== false && Number(item.stock) <= Number(item.minStock || 0)).length : null;
    return `<button class="nav-item ${appState.page === key ? 'active' : ''}" data-action="navigate" data-page="${key}"><span class="nav-ico">${icon}</span><span>${escapeHtml(title)}</span>${count ? `<span class="nav-count">${count}</span>` : ''}</button>`;
  }).join('')}</nav>`).join('');
  const switcher = user.role === 'admin' ? `<div class="topbar-right module-switcher"><button class="btn ${module === 'enfermeria' ? '' : 'btn-secondary'} btn-small" data-action="switch-module" data-module="enfermeria">✚ Enfermería</button><button class="btn ${module === 'farmacia' ? '' : 'btn-secondary'} btn-small" data-action="switch-module" data-module="farmacia">▣ Farmacia</button></div>` : `<div class="topbar-right"><span class="badge ${module === 'farmacia' ? 'info' : 'teal'}">${module === 'farmacia' ? '▣' : '✚'} ${moduleLabel(module)}</span></div>`;
  $('#app').innerHTML = `
    <div class="app-shell">
      <aside class="sidebar ${appState.menuOpen ? 'open' : ''}" id="sidebar">
        <div class="sidebar-brand"><div class="brand-mark">C<span>+</span></div><div><div class="brand-name">${escapeHtml(appState.db.institution.name || 'CEPRODENT')}</div><div class="brand-caption">Aula de simulación</div></div></div>
        ${navHtml}
        <div class="sidebar-bottom"><div class="sidebar-warning"><strong>ⓘ ENTORNO ACADÉMICO</strong>Trabaja solo con los casos ficticios incluidos. No registrar información real de pacientes.</div><div class="sidebar-user"><div class="avatar">${escapeHtml(initials(user.name))}</div><div><div class="sidebar-user-name">${escapeHtml(user.name)}</div><div class="sidebar-user-role">${escapeHtml(roleLabel(user.role))}</div></div></div></div>
      </aside>
      <div class="main-column">
        <header class="topbar"><div class="topbar-left"><button class="btn btn-secondary btn-icon mobile-menu" data-action="toggle-menu" aria-label="Abrir menú">☰</button><div><h2 class="topbar-title">${escapeHtml(pageMeta[0])}</h2><div class="topbar-sub">${escapeHtml(pageMeta[1])}</div></div></div><div class="topbar-right">${switcher}<div class="date-pill">◷ ${new Intl.DateTimeFormat('es-CO', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }).format(new Date())}</div><div class="user-chip"><div class="avatar">${escapeHtml(initials(user.name))}</div><div class="user-chip-text"><div class="user-chip-name">${escapeHtml(user.name)}</div><div class="user-chip-role">${escapeHtml(roleLabel(user.role))}</div></div></div><button class="btn btn-secondary btn-small" data-action="logout">Salir</button></div></header>
        <main class="content-wrap">${renderPage(appState.page, module, user)}</main>
      </div>
    </div>
    ${appState.menuOpen ? `<button aria-label="Cerrar menú" data-action="close-menu" style="position:fixed;inset:0;z-index:4;border:0;background:rgba(10,28,37,.22)"></button>` : ''}`;
}

function pageAllowed(page, user, module) {
  if (user.role === 'admin') return true;
  const nursingPages = ['dashboard', 'patients', 'serviceOrders', 'medicationOrders', 'schedule', 'vitals', 'evolutions', 'reports'];
  const pharmacyPages = ['dashboard', 'pos', 'products', 'incoming', 'movements', 'sales', 'reports'];
  return module === 'farmacia' ? pharmacyPages.includes(page) : nursingPages.includes(page);
}

function renderPage(page, module, user) {
  if (page === 'dashboard') return user.role === 'admin' ? renderAdminDashboard(module) : module === 'farmacia' ? renderPharmacyDashboard() : renderNursingDashboard();
  const renderers = {
    patients: renderPatientsPage, serviceOrders: renderServiceOrdersPage, medicationOrders: renderMedicationOrdersPage,
    schedule: renderSchedulePage, evolutions: renderEvolutionsPage, vitals: renderVitalsPage, pos: renderPosPage, products: renderProductsPage,
    incoming: renderIncomingPage, movements: renderMovementsPage, sales: renderSalesPage, reports: renderReportsPage,
    users: renderUsersPage, backup: renderBackupPage
  };
  return renderers[page] ? renderers[page]() : renderNursingDashboard();
}

function pageHeader(eyebrow, title, description, actions = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="page-actions">${actions}</div></div>`;
}

function statCard(label, value, foot, icon, color = '') {
  return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${escapeHtml(label)}</span><span class="stat-icon ${color}">${icon}</span></div><div class="stat-value">${escapeHtml(value)}</div><div class="stat-foot">${escapeHtml(foot)}</div></article>`;
}

function quickAction(page, icon, title, description) {
  return `<button class="quick-action" data-action="navigate" data-page="${page}"><span class="quick-action-icon">${icon}</span><span><span class="quick-action-title">${escapeHtml(title)}</span><span class="quick-action-desc">${escapeHtml(description)}</span></span></button>`;
}

function badgeForStatus(status) {
  const normalized = String(status || '').toLowerCase();
  let kind = 'info';
  if (['completada', 'administrada', 'activa', 'recibida', 'pagada'].includes(normalized)) kind = 'success';
  else if (['pendiente', 'en curso', 'omitida', 'retenida'].includes(normalized)) kind = 'warning';
  else if (['cancelada', 'rechazada', 'vencido', 'inactiva'].includes(normalized)) kind = 'danger';
  return `<span class="badge ${kind}">${escapeHtml(status || 'Sin estado')}</span>`;
}

function renderAdminDashboard(module) {
  const users = appState.db.users.filter(user => user.active !== false).length;
  const pending = appState.db.serviceOrders.filter(order => order.status === 'Pendiente').length;
  const products = appState.db.products.filter(product => product.active !== false).length;
  const lowStock = appState.db.products.filter(product => product.active !== false && Number(product.stock) <= Number(product.minStock || 0)).length;
  return `${pageHeader('CENTRO ACADÉMICO', 'Panel de administración', 'Administra los datos locales y cambia de módulo para revisar los flujos de entrenamiento.', '<button class="btn btn-secondary" data-action="navigate" data-page="backup">⇧ Respaldos</button>')}
    <div class="callout warning" style="margin-bottom:19px"><span class="callout-icon">ⓘ</span><div><strong>Instalación local.</strong> Este administrador solo gestiona los datos del navegador actual. No crea cuentas centralizadas ni sincroniza actividad entre estudiantes o computadores.</div></div>
    <section class="stats-grid">${statCard('Cuentas activas', formatCount(users), 'Usuarios de esta instalación', '♙')}${statCard('Pacientes ficticios', formatCount(appState.db.patients.length), 'Expedientes de práctica', '✚', 'blue')}${statCard('Productos disponibles', formatCount(products), 'Catálogo de farmacia', '▤', 'amber')}${statCard('Productos en alerta', formatCount(lowStock), 'Existencias iguales o bajo mínimo', '!', lowStock ? 'red' : '')}</section>
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h3 class="panel-title">Acceso a los módulos</h3><div class="panel-description">Elige qué entorno quieres observar o practicar.</div></div></div><div class="quick-grid">${quickAction('patients', '♙', 'Pacientes simulados', 'Revisar expedientes ficticios')}${quickAction('serviceOrders', '▤', 'Órdenes de servicio', 'Consultar procedimientos')}${quickAction('schedule', '◷', 'Agenda de medicamentos', 'Ver el registro horario')}${quickAction('pos', '▣', 'Punto de venta', 'Probar el flujo de caja')}${quickAction('products', '▥', 'Inventario', 'Lotes y existencias')}${quickAction('reports', '▤', 'Reportes', 'Indicadores del simulador')}</div></section>
    <section><div class="panel"><div class="panel-header"><div><h3 class="panel-title">Respaldo local</h3><div class="panel-description">Conserva una copia antes de practicar cambios.</div></div></div><p class="muted small" style="line-height:1.7">La información queda en ${escapeHtml('localStorage')}. Exportar crea un archivo JSON que puedes importar después en este mismo simulador.</p><button class="btn btn-block" data-action="export-data">⇩ Exportar todos los datos</button><button class="btn btn-secondary btn-block" style="margin-top:8px" data-action="navigate" data-page="backup">Más opciones de respaldo</button></div><div class="panel"><h3 class="panel-title">Módulo actual: ${escapeHtml(moduleLabel(module))}</h3><p class="panel-description">Usa los botones superiores para cambiar entre Enfermería y Farmacia sin cerrar la sesión de administrador.</p></div></section></div>`;
}

function renderNursingDashboard() {
  const activePatients = appState.db.patients.length;
  const pendingOrders = appState.db.serviceOrders.filter(order => order.status === 'Pendiente').length;
  const activeMedOrders = appState.db.medicationOrders.filter(order => order.status === 'Activa').length;
  const todaySchedule = getTodaySchedule();
  const outstanding = todaySchedule.filter(item => !item.record).length;
  const upcoming = todaySchedule.slice(0, 5);
  const recent = [...appState.db.serviceOrders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5);
  return `${pageHeader('MÓDULO DE ENFERMERÍA', 'Panel de práctica', 'Un espacio para documentar casos ficticios, organizar órdenes y revisar la agenda de atención simulada.', '<button class="btn" data-action="open-new-service-order">＋ Nueva orden de servicio</button>')}
    <div class="callout" style="margin-bottom:18px"><span class="callout-icon">ⓘ</span><div><strong>Recordatorio académico:</strong> las órdenes y pautas de medicamentos son datos de ejemplo. En el entorno real, todo medicamento debe responder a una indicación autorizada y a los protocolos institucionales.</div></div>
    <section class="stats-grid">${statCard('Pacientes simulados', formatCount(activePatients), 'Expedientes disponibles', '♙')}${statCard('Órdenes pendientes', formatCount(pendingOrders), 'Requieren seguimiento en la práctica', '▤', 'amber')}${statCard('Órdenes de medicamento', formatCount(activeMedOrders), 'Pautas ficticias activas', '✚', 'blue')}${statCard('Registros por revisar hoy', formatCount(outstanding), 'Horarios simulados sin registrar', '◷', outstanding ? 'red' : '')}</section>
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h3 class="panel-title">Órdenes de servicio recientes</h3><div class="panel-description">Actividad documentada dentro de este navegador.</div></div><button class="panel-link" data-action="navigate" data-page="serviceOrders">Ver todas →</button></div>${recent.length ? `<div class="table-wrap"><table class="compact-table"><thead><tr><th>Orden</th><th>Paciente</th><th>Servicio</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>${recent.map(order => `<tr><td><span class="table-primary">${escapeHtml(order.number)}</span></td><td>${escapeHtml(patientName(order.patientId))}</td><td>${escapeHtml(order.type)}</td><td>${badgeForStatus(order.status)}</td><td>${formatDate(order.serviceDate)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('Sin órdenes de servicio','Crea una orden para comenzar la práctica.','＋ Nueva orden','open-new-service-order')}</section>
    <section><div class="panel"><div class="panel-header"><div><h3 class="panel-title">Acciones rápidas</h3><div class="panel-description">Atajos para los flujos habituales.</div></div></div><div class="quick-grid">${quickAction('patients','♙','Nuevo paciente','Crear expediente ficticio')}${quickAction('serviceOrders','▤','Nueva orden','Registrar un servicio')}${quickAction('medicationOrders','✚','Orden de medicamento','Configurar pauta de práctica')}${quickAction('schedule','◷','Agenda diaria','Registrar administraciones')}${quickAction('vitals','⌁','Signos vitales','Practicar la captura de medidas')}</div></div><div class="panel"><div class="panel-header"><div><h3 class="panel-title">Agenda de hoy</h3><div class="panel-description">${formatDate(localDate())} · Horarios de ejemplo.</div></div><button class="panel-link" data-action="navigate" data-page="schedule">Abrir agenda →</button></div>${upcoming.length ? `<div class="schedule-list">${upcoming.map(item => `<div class="schedule-row"><div class="schedule-time">${escapeHtml(item.time)}</div><div><div class="schedule-name">${escapeHtml(medName(item.order))}</div><div class="schedule-meta">${escapeHtml(patientName(item.order.patientId))} · ${escapeHtml(item.order.dose)}</div></div>${item.record ? badgeForStatus(item.record.status) : '<span class="badge warning">Pendiente</span>'}</div>`).join('')}</div>` : `<p class="muted small">No hay horarios simulados para la fecha actual.</p>`}</div></section></div>`;
}

function renderPharmacyDashboard() {
  const products = appState.db.products.filter(product => product.active !== false);
  const low = products.filter(product => Number(product.stock) <= Number(product.minStock || 0));
  const nearExpiry = products.filter(product => daysUntil(product.expiry) !== null && daysUntil(product.expiry) >= 0 && daysUntil(product.expiry) <= 90);
  const stockValue = products.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.purchasePrice || 0), 0);
  const sales = [...appState.db.sales].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5);
  const totalSales = appState.db.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  return `${pageHeader('MÓDULO DE FARMACIA', 'Panel de farmacia', 'Practica el ciclo de productos: recepción, inventario, punto de venta, movimientos y reportes.', '<button class="btn" data-action="navigate" data-page="pos">＋ Nueva venta</button>')}
    <div class="callout" style="margin-bottom:18px"><span class="callout-icon">ⓘ</span><div><strong>Entorno de práctica.</strong> Los artículos y precios son ficticios. Las ventas generan comprobantes académicos, no facturas fiscales. La dispensación real de medicamentos exige controles y autorizaciones aplicables.</div></div>
    <section class="stats-grid">${statCard('Productos activos', formatCount(products.length), 'Referencias disponibles', '▤')}${statCard('Bajo mínimo', formatCount(low.length), 'Revisar reposición simulada', '!', low.length ? 'red' : '')}${statCard('Próximos a vencer', formatCount(nearExpiry.length), 'Dentro de los próximos 90 días', '◷', 'amber')}${statCard('Valor al costo', money(stockValue), 'Estimación del inventario demo', '＄', 'blue')}</section>
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h3 class="panel-title">Ventas recientes</h3><div class="panel-description">Comprobantes creados en la instalación local.</div></div><button class="panel-link" data-action="navigate" data-page="sales">Ver ventas →</button></div>${sales.length ? `<div class="table-wrap"><table class="compact-table"><thead><tr><th>Comprobante</th><th>Fecha</th><th>Productos</th><th>Total</th><th>Estado</th></tr></thead><tbody>${sales.map(sale => `<tr><td><span class="table-primary">${escapeHtml(sale.number)}</span></td><td>${formatDateTime(sale.createdAt)}</td><td>${formatCount(sale.items.reduce((sum,item) => sum + Number(item.quantity),0))}</td><td class="table-primary">${money(sale.total)}</td><td>${badgeForStatus(sale.status)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('Sin ventas todavía','Usa el punto de venta para registrar una operación demo.','Abrir punto de venta','navigate-pos')}</section>
    <section><div class="panel"><div class="panel-header"><div><h3 class="panel-title">Atajos de operación</h3><div class="panel-description">Tareas frecuentes de farmacia.</div></div></div><div class="quick-grid">${quickAction('pos','▣','Punto de venta','Agregar productos al carrito')}${quickAction('products','▤','Nuevo producto','Crear referencia ficticia')}${quickAction('incoming','↓','Registrar entrada','Actualizar existencias')}${quickAction('movements','⇄','Ver movimientos','Auditar cambios de stock')}</div></div><div class="panel"><div class="panel-header"><div><h3 class="panel-title">Alertas de inventario</h3><div class="panel-description">Productos al nivel mínimo o próximos a vencer.</div></div><button class="panel-link" data-action="navigate" data-page="products">Revisar →</button></div>${low.length || nearExpiry.length ? `<div class="schedule-list">${[...low.slice(0,3).map(product=>({product,kind:'stock'})),...nearExpiry.slice(0,3).map(product=>({product,kind:'expiry'}))].slice(0,5).map(item => `<div class="schedule-row"><div class="schedule-time" style="font-size:12px">${item.kind==='stock'?'Stock':'Vence'}</div><div><div class="schedule-name">${escapeHtml(item.product.name)}</div><div class="schedule-meta">${item.kind==='stock'?`${formatCount(item.product.stock)} unidades · mínimo ${formatCount(item.product.minStock)}`:`Lote ${escapeHtml(item.product.lot)} · ${formatDate(item.product.expiry)}`}</div></div>${item.kind==='stock'?'<span class="badge danger">Reposición</span>':'<span class="badge warning">Vencimiento</span>'}</div>`).join('')}</div>` : '<p class="muted small">No hay alertas de ejemplo.</p>'}</div></section></div>
    <div class="small muted" style="margin-top:15px">Ventas de demostración registradas: <strong>${money(totalSales)}</strong>.</div>`;
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T12:00:00`); if (Number.isNaN(target.getTime())) return null;
  const today = new Date(`${localDate()}T12:00:00`); return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function emptyState(title, text, buttonLabel = '', action = '') {
  return `<div class="empty-state"><div class="empty-icon">⌁</div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p>${buttonLabel ? `<button class="btn btn-secondary btn-small" style="margin-top:14px" data-action="${escapeHtml(action)}">${escapeHtml(buttonLabel)}</button>` : ''}</div>`;
}

function renderPatientsPage() {
  const query = (appState.search.patients || '').toLowerCase();
  const patients = [...appState.db.patients].filter(patient => [patient.name, patient.record, patient.document].some(value => String(value || '').toLowerCase().includes(query))).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return `${pageHeader('ENFERMERÍA · EXPEDIENTES', 'Pacientes simulados', 'Registros inventados para practicar la identificación, consulta del expediente y documentación de antecedentes.', '<button class="btn" data-action="open-new-patient">＋ Registrar paciente</button>')}
    <div class="callout warning" style="margin-bottom:18px"><span class="callout-icon">ⓘ</span><div><strong>Datos ficticios.</strong> Usa únicamente códigos y escenarios académicos. No registres nombres, documentos, teléfonos ni historias clínicas reales.</div></div>
    <section class="panel"><div class="toolbar"><div class="toolbar-left"><form data-form="filter" data-filter="patients" class="input-wrap"><span class="search-symbol">⌕</span><input name="q" class="input search-input" value="${escapeHtml(appState.search.patients || '')}" placeholder="Buscar nombre, código o ID..."></form><span class="badge">${formatCount(patients.length)} registros</span></div><div class="toolbar-right"><button class="btn btn-secondary btn-small" data-action="export-patients">Exportar lista CSV</button></div></div>
    ${patients.length ? `<div class="table-wrap"><table><thead><tr><th>Expediente</th><th>Paciente ficticio</th><th>Fecha de nacimiento</th><th>Alergias / alertas</th><th>Registro</th><th>Acciones</th></tr></thead><tbody>${patients.map(patient => `<tr><td><span class="table-primary">${escapeHtml(patient.record)}</span><div class="table-secondary">${escapeHtml(patient.document)}</div></td><td><span class="table-primary">${escapeHtml(patient.name)}</span><div class="table-secondary">${escapeHtml(patient.sex || 'Sin dato')}</div></td><td>${formatDate(patient.birthDate)}</td><td><span class="small">${escapeHtml(patient.allergies || 'Sin información')}</span></td><td>${formatDate(patient.createdAt)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-action="view-patient" data-id="${escapeHtml(patient.id)}">Ver expediente</button></div></td></tr>`).join('')}</tbody></table></div>` : emptyState('No hay coincidencias','Cambia la búsqueda o registra un expediente ficticio.','Registrar paciente','open-new-patient')}</section>`;
}

function renderServiceOrdersPage() {
  const query = (appState.search.serviceOrders || '').toLowerCase();
  const orders = [...appState.db.serviceOrders].filter(order => [order.number, order.title, order.type, patientName(order.patientId), order.status].some(value => String(value || '').toLowerCase().includes(query))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return `${pageHeader('ENFERMERÍA · GESTIÓN DE SERVICIOS', 'Órdenes de servicio', 'Crea solicitudes simuladas de cuidados o procedimientos y cambia su estado para practicar el seguimiento.', '<button class="btn" data-action="open-new-service-order">＋ Nueva orden</button>')}
    <section class="panel"><div class="toolbar"><div class="toolbar-left"><form data-form="filter" data-filter="serviceOrders" class="input-wrap"><span class="search-symbol">⌕</span><input name="q" class="input search-input" value="${escapeHtml(appState.search.serviceOrders || '')}" placeholder="Buscar orden, paciente o servicio..."></form><span class="badge">${formatCount(orders.length)} órdenes</span></div><div class="toolbar-right"><button class="btn btn-secondary btn-small" data-action="export-service-orders">Exportar CSV</button></div></div>
    ${orders.length ? `<div class="table-wrap"><table><thead><tr><th>N.º de orden</th><th>Paciente</th><th>Tipo / descripción</th><th>Prioridad</th><th>Fecha del servicio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${orders.map(order => `<tr><td><span class="table-primary">${escapeHtml(order.number)}</span><div class="table-secondary">Creada ${formatDate(order.createdAt)}</div></td><td>${escapeHtml(patientName(order.patientId))}</td><td><span class="table-primary">${escapeHtml(order.type)}</span><div class="table-secondary">${escapeHtml(order.title)}</div></td><td>${badgeForStatus(order.priority)}</td><td>${formatDate(order.serviceDate)}</td><td>${badgeForStatus(order.status)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-action="view-service-order" data-id="${escapeHtml(order.id)}">Detalle</button>${order.status !== 'Completada' && order.status !== 'Cancelada' ? `<button class="btn btn-secondary btn-small" data-action="advance-service-order" data-id="${escapeHtml(order.id)}">Avanzar</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>` : emptyState('Sin órdenes de servicio','Registra una orden de práctica para aprender su ciclo de vida.','Nueva orden','open-new-service-order')}</section>`;
}

function renderMedicationOrdersPage() {
  const query = (appState.search.medicationOrders || '').toLowerCase();
  const orders = [...appState.db.medicationOrders].filter(order => [order.number, patientName(order.patientId), medName(order), order.dose, order.route, order.status].some(value => String(value || '').toLowerCase().includes(query))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return `${pageHeader('ENFERMERÍA · TRATAMIENTOS DE PRÁCTICA', 'Órdenes de medicamentos', 'Registra una pauta ficticia y configura los horarios que aparecerán en la agenda de administración.', '<button class="btn" data-action="open-new-med-order">＋ Nueva orden de medicamento</button>')}
    <div class="callout warning" style="margin-bottom:18px"><span class="callout-icon">!</span><div><strong>No es una herramienta para prescribir.</strong> Los campos de dosis, vía y frecuencia se utilizan para comprender el registro electrónico. No generar ni copiar pautas para pacientes reales; la prescripción y administración requieren verificación profesional y protocolos vigentes.</div></div>
    <section class="panel"><div class="toolbar"><div class="toolbar-left"><form data-form="filter" data-filter="medicationOrders" class="input-wrap"><span class="search-symbol">⌕</span><input name="q" class="input search-input" value="${escapeHtml(appState.search.medicationOrders || '')}" placeholder="Buscar medicamento, paciente o número..."></form><span class="badge">${formatCount(orders.length)} órdenes</span></div><div class="toolbar-right"><button class="btn btn-secondary btn-small" data-action="navigate" data-page="schedule">Ver agenda de hoy</button></div></div>
    ${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Orden</th><th>Paciente</th><th>Medicamento de práctica</th><th>Dosis / vía</th><th>Horario</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${orders.map(order => `<tr><td><span class="table-primary">${escapeHtml(order.number)}</span></td><td>${escapeHtml(patientName(order.patientId))}</td><td><span class="table-primary">${escapeHtml(medName(order))}</span><div class="table-secondary">${escapeHtml(order.frequency)}</div></td><td>${escapeHtml(order.dose)}<div class="table-secondary">${escapeHtml(order.route)}</div></td><td>${order.times.map(escapeHtml).join(' · ')}</td><td>${formatDate(order.startDate)} – ${formatDate(order.endDate)}</td><td>${badgeForStatus(order.status)}</td><td><div class="table-actions">${order.status === 'Activa' ? `<button class="btn btn-secondary btn-small" data-action="deactivate-med-order" data-id="${escapeHtml(order.id)}">Finalizar</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>` : emptyState('Sin órdenes de medicamentos','Crea una pauta de entrenamiento para aprender a programar horarios.','Nueva orden','open-new-med-order')}</section>`;
}

function getTodaySchedule() {
  const today = localDate();
  const items = [];
  appState.db.medicationOrders.filter(order => order.status === 'Activa' && String(order.startDate || '1900-01-01') <= today && String(order.endDate || '2999-12-31') >= today).forEach(order => {
    (order.times || []).forEach(time => {
      const scheduledAt = `${today}T${time}`;
      const record = appState.db.administrations.find(item => item.medicationOrderId === order.id && item.scheduledAt === scheduledAt);
      items.push({ order, time, scheduledAt, record, patient: patientById(order.patientId) });
    });
  });
  return items.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
}

function renderSchedulePage() {
  const filter = appState.scheduleFilter || 'Todos';
  let schedule = getTodaySchedule();
  if (filter === 'Pendientes') schedule = schedule.filter(item => !item.record);
  else if (filter === 'Registrados') schedule = schedule.filter(item => item.record);
  const pendingCount = getTodaySchedule().filter(item => !item.record).length;
  const recordedCount = getTodaySchedule().filter(item => item.record).length;
  return `${pageHeader('ENFERMERÍA · ADMINISTRACIÓN', 'Agenda de administración', 'Revisa cada horario programado y documenta si se realizó, se omitió, fue rechazada o se retuvo en el caso simulado.', '<button class="btn btn-secondary" data-action="navigate" data-page="medicationOrders">Ver órdenes</button>')}
    <div class="callout warning" style="margin-bottom:18px"><span class="callout-icon">!</span><div><strong>Simulación, no recomendación clínica.</strong> Una hora programada en esta aplicación no indica que un medicamento deba administrarse a una persona. En la práctica real se requiere validar la orden vigente, la identidad, las alergias, la dosis, la vía, la hora y las condiciones del paciente conforme al protocolo institucional.</div></div>
    <section class="stats-grid">${statCard('Horarios de hoy', formatCount(getTodaySchedule().length), formatDate(localDate()), '◷')}${statCard('Pendientes de registro', formatCount(pendingCount), 'Aún no tienen resultado documentado', '!', pendingCount ? 'amber' : '')}${statCard('Registros completados', formatCount(recordedCount), 'Incluye todos los estados documentados', '✓', 'blue')}${statCard('Órdenes activas', formatCount(appState.db.medicationOrders.filter(order=>order.status==='Activa').length), 'Pautas académicas vigentes', '✚')}</section>
    <section class="panel"><div class="toolbar"><div><h3 class="panel-title">Agenda · ${formatDate(localDate())}</h3><div class="panel-description">Los horarios se generan a partir de las órdenes activas.</div></div><div class="toolbar-right"><select class="select" style="width:160px" id="schedule-filter"><option ${filter==='Todos'?'selected':''}>Todos</option><option ${filter==='Pendientes'?'selected':''}>Pendientes</option><option ${filter==='Registrados'?'selected':''}>Registrados</option></select></div></div>
    ${schedule.length ? `<div class="schedule-list">${schedule.map(item=>`<div class="schedule-row"><div class="schedule-time">${escapeHtml(item.time)}</div><div><div class="schedule-name">${escapeHtml(medName(item.order))}</div><div class="schedule-meta">${escapeHtml(patientName(item.order.patientId))} · ${escapeHtml(item.order.dose)} · ${escapeHtml(item.order.route)}<br>Orden ${escapeHtml(item.order.number)} · ${escapeHtml(item.order.frequency)}</div>${item.record ? `<div class="table-secondary" style="margin-top:7px">Registrado: ${formatDateTime(item.record.recordedAt)}${item.record.note ? ' · ' + escapeHtml(item.record.note) : ''}</div>` : ''}</div><div>${item.record ? `${badgeForStatus(item.record.status)} <button class="btn btn-secondary btn-small" style="margin-top:6px" data-action="view-administration" data-id="${escapeHtml(item.record.id)}">Detalle</button>` : `<span class="badge warning">Pendiente</span><button class="btn btn-small" style="margin-top:6px" data-action="log-administration" data-med-order-id="${escapeHtml(item.order.id)}" data-scheduled-at="${escapeHtml(item.scheduledAt)}">Registrar resultado</button>`}</div></div>`).join('')}</div>` : emptyState('Sin registros en este filtro', 'Prueba otro filtro o crea una orden de medicamento activa para la agenda.', 'Ver órdenes de medicamentos', 'navigate-medicationOrders')}</section>`;
}

function renderVitalsPage() {
  const query = (appState.search.vitals || '').toLowerCase();
  const records = [...appState.db.vitals].filter(item => [patientName(item.patientId), item.note, userById(item.recordedBy)?.name].some(value => String(value || '').toLowerCase().includes(query))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return `${pageHeader('ENFERMERÍA · OBSERVACIONES', 'Signos vitales', 'Practica la captura de mediciones ficticias y su asociación con el expediente adecuado, sin interpretación ni alertas clínicas automáticas.', '<button class="btn" data-action="open-new-vitals">＋ Registrar medidas</button>')}
    <div class="callout warning" style="margin-bottom:18px"><span class="callout-icon">ⓘ</span><div><strong>Solo captura académica.</strong> Los valores de esta página son datos de práctica. No calcula diagnósticos, no determina valores normales y no reemplaza la valoración profesional ni el protocolo institucional.</div></div>
    <section class="panel"><div class="toolbar"><div class="toolbar-left"><form data-form="filter" data-filter="vitals" class="input-wrap"><span class="search-symbol">⌕</span><input name="q" class="input search-input" value="${escapeHtml(appState.search.vitals || '')}" placeholder="Buscar paciente, nota o responsable..."></form><span class="badge">${formatCount(records.length)} registros</span></div><div class="toolbar-right"><button class="btn btn-secondary btn-small" data-action="export-vitals">Exportar CSV</button></div></div>
    ${records.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha y hora</th><th>Paciente simulado</th><th>Temperatura</th><th>Frecuencia cardíaca</th><th>Respiración</th><th>Presión arterial</th><th>SpO₂</th><th></th></tr></thead><tbody>${records.map(item=>`<tr><td>${formatDateTime(item.createdAt)}</td><td><span class="table-primary">${escapeHtml(patientName(item.patientId))}</span></td><td>${escapeHtml(item.temperature)} °C</td><td>${escapeHtml(item.pulse)} lpm</td><td>${escapeHtml(item.respiration)} rpm</td><td>${escapeHtml(item.systolicBP)}/${escapeHtml(item.diastolicBP)} mmHg</td><td>${escapeHtml(item.spo2)} %</td><td><button class="btn btn-secondary btn-small" data-action="view-vitals" data-id="${escapeHtml(item.id)}">Detalle</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('Sin registros de signos vitales','Registra las mediciones del caso ficticio para practicar su documentación.','Registrar medidas','open-new-vitals')}</section>`;
}

function renderEvolutionsPage() {
  const query = (appState.search.evolutions || '').toLowerCase();
  const evolutions = [...appState.db.evolutions].filter(item => [item.type, item.note, patientName(item.patientId)].some(value => String(value || '').toLowerCase().includes(query))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return `${pageHeader('ENFERMERÍA · DOCUMENTACIÓN', 'Notas de enfermería', 'Practica la escritura clara, objetiva y cronológica de notas relacionadas con un caso inventado.', '<button class="btn" data-action="open-new-evolution">＋ Añadir nota</button>')}
    <div class="callout" style="margin-bottom:18px"><span class="callout-icon">✎</span><div><strong>Consejo de práctica:</strong> separa observaciones, acciones y respuesta del caso simulado. Evita diagnósticos o indicaciones no respaldados por el escenario docente.</div></div>
    <section class="panel"><div class="toolbar"><div class="toolbar-left"><form data-form="filter" data-filter="evolutions" class="input-wrap"><span class="search-symbol">⌕</span><input name="q" class="input search-input" value="${escapeHtml(appState.search.evolutions || '')}" placeholder="Buscar nota o paciente..."></form><span class="badge">${formatCount(evolutions.length)} notas</span></div></div>
    ${evolutions.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha y hora</th><th>Paciente</th><th>Tipo de nota</th><th>Contenido</th><th>Registrado por</th><th></th></tr></thead><tbody>${evolutions.map(item=>`<tr><td>${formatDateTime(item.createdAt)}</td><td>${escapeHtml(patientName(item.patientId))}</td><td><span class="table-primary">${escapeHtml(item.type)}</span></td><td style="min-width:260px;max-width:440px">${escapeHtml(item.note)}</td><td>${escapeHtml(userById(item.createdBy)?.name || 'Usuario local')}</td><td><button class="btn btn-secondary btn-small" data-action="view-evolution" data-id="${escapeHtml(item.id)}">Detalle</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('Todavía no hay notas','Añade una nota ficticia para practicar documentación.','Añadir nota','open-new-evolution')}</section>`;
}

function renderProductsPage() {
  const query = (appState.search.products || '').toLowerCase();
  const products = [...appState.db.products].filter(product => product.active !== false && [product.code, product.name, product.category, product.lot, product.supplier].some(value=>String(value||'').toLowerCase().includes(query))).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return `${pageHeader('FARMACIA · CATÁLOGO', 'Productos e inventario', 'Administra referencias ficticias, precios de entrenamiento, lotes, vencimientos y niveles mínimos.', '<button class="btn" data-action="open-new-product">＋ Nuevo producto</button>')}
    <div class="callout" style="margin-bottom:18px"><span class="callout-icon">▤</span><div><strong>Control académico de stock.</strong> Los lotes y fechas pertenecen a un catálogo ficticio. Este inventario no debe utilizarse para tomar decisiones de almacenamiento, calidad o dispensación real.</div></div>
    <section class="stats-grid">${statCard('Referencias activas', formatCount(appState.db.products.filter(p=>p.active!==false).length), 'Productos registrados', '▤')}${statCard('Bajo mínimo', formatCount(appState.db.products.filter(p=>p.active!==false && Number(p.stock)<=Number(p.minStock||0)).length), 'Existencias en alerta', '!', 'red')}${statCard('Lotes vencidos', formatCount(appState.db.products.filter(p=>p.active!==false && daysUntil(p.expiry)!==null && daysUntil(p.expiry)<0).length), 'No deben venderse en el simulador', '◷', 'amber')}${statCard('Lotes por vencer', formatCount(appState.db.products.filter(p=>p.active!==false && daysUntil(p.expiry)!==null && daysUntil(p.expiry)>=0 && daysUntil(p.expiry)<=90).length), 'Próximos 90 días', '◷', 'blue')}</section>
    <section class="panel"><div class="toolbar"><div class="toolbar-left"><form data-form="filter" data-filter="products" class="input-wrap"><span class="search-symbol">⌕</span><input name="q" class="input search-input" value="${escapeHtml(appState.search.products || '')}" placeholder="Buscar por código, nombre o lote..."></form><span class="badge">${formatCount(products.length)} productos</span></div><div class="toolbar-right"><button class="btn btn-secondary btn-small" data-action="export-products">Exportar CSV</button><button class="btn btn-secondary btn-small" data-action="navigate" data-page="incoming">Registrar entrada</button></div></div>
    ${products.length ? `<div class="table-wrap"><table><thead><tr><th>Código / producto</th><th>Categoría / presentación</th><th>Lote / vencimiento</th><th>Stock</th><th>Precio venta</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${products.map(product=>`<tr><td><span class="table-primary">${escapeHtml(product.name)}</span><div class="table-secondary">${escapeHtml(product.code)}</div></td><td>${escapeHtml(product.category)}<div class="table-secondary">${escapeHtml(product.presentation)}</div></td><td>${escapeHtml(product.lot)}<div class="table-secondary">Vence: ${formatDate(product.expiry)}</div></td><td><span class="table-primary">${formatCount(product.stock)}</span><div class="table-secondary">Mínimo: ${formatCount(product.minStock)}</div></td><td class="table-primary">${money(product.salePrice)}</td><td>${product.expiry && daysUntil(product.expiry)<0 ? '<span class="badge danger">Vencido</span>' : Number(product.stock)<=Number(product.minStock||0) ? '<span class="badge warning">Stock bajo</span>' : '<span class="badge success">Disponible</span>'}</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-action="edit-product" data-id="${escapeHtml(product.id)}">Editar</button><button class="btn btn-secondary btn-small" data-action="add-stock-for-product" data-id="${escapeHtml(product.id)}">+ Stock</button></div></td></tr>`).join('')}</tbody></table></div>` : emptyState('No hay productos con esa búsqueda','Prueba otro término o registra un artículo de práctica.','Nuevo producto','open-new-product')}</section>`;
}

function renderPosProducts() {
  const query = String(appState.posSearch || '').toLowerCase();
  const products = appState.db.products.filter(product => product.active !== false && Number(product.stock) > 0 && [product.code, product.name, product.category].some(value=>String(value||'').toLowerCase().includes(query))).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const root = $('#pos-products');
  if (!root) return;
  root.innerHTML = products.length ? products.map(product=>{
    const expired = daysUntil(product.expiry) !== null && daysUntil(product.expiry) < 0;
    const qtyInCart = appState.cart.find(item=>item.productId===product.id)?.quantity || 0;
    return `<article class="product-tile"><div class="product-tile-top"><span class="product-code">${escapeHtml(product.code)}</span>${expired?'<span class="badge danger">Vencido</span>':Number(product.stock)<=Number(product.minStock||0)?'<span class="badge warning">Stock bajo</span>':'<span class="badge success">Disponible</span>'}</div><div class="product-tile-name">${escapeHtml(product.name)}</div><div class="product-tile-meta">${escapeHtml(product.presentation)} · Stock ${formatCount(product.stock)}</div><div class="product-tile-bottom"><div><div class="product-price">${money(product.salePrice)}</div><div class="product-tile-meta">${qtyInCart?`${qtyInCart} en carrito`:escapeHtml(product.category)}</div></div><button class="btn btn-small" data-action="add-to-cart" data-id="${escapeHtml(product.id)}" ${expired||Number(product.stock)<=qtyInCart?'disabled':''}>＋ Agregar</button></div></article>`;
  }).join('') : emptyState('No hay coincidencias','Busca otro producto o revisa el inventario disponible.');
}

function renderCart() {
  const root = $('#pos-cart');
  if (!root) return;
  const items = appState.cart.map(item=>({...item, product:productById(item.productId)})).filter(item=>item.product);
  const subtotal = items.reduce((sum,item)=>sum + item.quantity*Number(item.product.salePrice||0),0);
  root.innerHTML = `${items.length ? `<div>${items.map(item=>`<div class="cart-line"><div><div class="cart-line-name">${escapeHtml(item.product.name)}</div><div class="cart-line-sub">${money(item.product.salePrice)} · Disponible: ${formatCount(item.product.stock)}</div><div class="quantity-control" style="margin-top:8px"><button class="qty-btn" data-action="cart-dec" data-id="${escapeHtml(item.product.id)}" aria-label="Restar">−</button><strong style="font-size:11px">${item.quantity}</strong><button class="qty-btn" data-action="cart-inc" data-id="${escapeHtml(item.product.id)}" aria-label="Sumar" ${item.quantity>=Number(item.product.stock)?'disabled':''}>＋</button><button class="panel-link" style="color:var(--red);margin-left:5px" data-action="cart-remove" data-id="${escapeHtml(item.product.id)}">Quitar</button></div></div><strong style="font-size:11px">${money(item.quantity*Number(item.product.salePrice||0))}</strong></div>`).join('')}</div><div style="padding-top:8px"><div class="cart-total-row"><span>Subtotal</span><span>${money(subtotal)}</span></div><div class="cart-total-row"><span>Descuento</span><span>${money(0)}</span></div><div class="cart-total-row final"><span>Total simulado</span><strong>${money(subtotal)}</strong></div><button class="btn btn-block" style="margin-top:12px" data-action="open-checkout">Finalizar venta →</button><button class="btn btn-secondary btn-block" style="margin-top:7px" data-action="clear-cart">Vaciar carrito</button></div>` : `<div class="empty-state" style="padding:28px 10px"><div class="empty-icon">▣</div><strong>Carrito vacío</strong><p>Busca productos y pulsa “Agregar” para comenzar.</p></div>`}`;
}

function renderPosPage() {
  return `${pageHeader('FARMACIA · CAJA', 'Punto de venta', 'Busca artículos ficticios, ajusta cantidades y genera un comprobante de venta académica.', '<button class="btn btn-secondary" data-action="navigate" data-page="sales">Ver ventas registradas</button>')}
    <div class="callout warning" style="margin-bottom:18px"><span class="callout-icon">ⓘ</span><div><strong>Comprobante no fiscal.</strong> Esta caja es una simulación educativa. No procesa pagos reales, no se conecta a una pasarela y no emite factura electrónica.</div></div>
    <div class="pos-layout"><section class="panel"><div class="panel-header"><div><h3 class="panel-title">Catálogo de práctica</h3><div class="panel-description">Los productos vencidos no se pueden agregar al carrito.</div></div><span class="badge">${appState.db.products.filter(p=>p.active!==false).length} referencias</span></div><div class="input-wrap pos-search"><span class="search-symbol">⌕</span><input id="posSearch" class="input search-input" style="width:100%" value="${escapeHtml(appState.posSearch)}" placeholder="Buscar nombre, código o categoría..."></div><div class="product-grid" id="pos-products">${renderPosProductsInitial()}</div></section><section class="panel"><div class="panel-header"><div><h3 class="panel-title">Venta actual</h3><div class="panel-description">${escapeHtml(appState.currentUser.name)} · Datos no sincronizados</div></div><span class="badge teal">Demo</span></div><div id="pos-cart">${renderCartInitial()}</div></section></div>`;
}

function renderPosProductsInitial() {
  const query = String(appState.posSearch || '').toLowerCase();
  const products = appState.db.products.filter(product=>product.active!==false && Number(product.stock)>0 && [product.code,product.name,product.category].some(value=>String(value||'').toLowerCase().includes(query))).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  if (!products.length) return emptyState('No hay coincidencias','Busca otro producto o revisa el inventario disponible.');
  return products.map(product=>{
    const expired = daysUntil(product.expiry)!==null && daysUntil(product.expiry)<0;
    const qty = appState.cart.find(item=>item.productId===product.id)?.quantity||0;
    return `<article class="product-tile"><div class="product-tile-top"><span class="product-code">${escapeHtml(product.code)}</span>${expired?'<span class="badge danger">Vencido</span>':Number(product.stock)<=Number(product.minStock||0)?'<span class="badge warning">Stock bajo</span>':'<span class="badge success">Disponible</span>'}</div><div class="product-tile-name">${escapeHtml(product.name)}</div><div class="product-tile-meta">${escapeHtml(product.presentation)} · Stock ${formatCount(product.stock)}</div><div class="product-tile-bottom"><div><div class="product-price">${money(product.salePrice)}</div><div class="product-tile-meta">${qty?`${qty} en carrito`:escapeHtml(product.category)}</div></div><button class="btn btn-small" data-action="add-to-cart" data-id="${escapeHtml(product.id)}" ${expired||Number(product.stock)<=qty?'disabled':''}>＋ Agregar</button></div></article>`;
  }).join('');
}

function renderCartInitial() {
  const items = appState.cart.map(item=>({...item,product:productById(item.productId)})).filter(item=>item.product);
  const subtotal = items.reduce((sum,item)=>sum+item.quantity*Number(item.product.salePrice||0),0);
  if (!items.length) return `<div class="empty-state" style="padding:28px 10px"><div class="empty-icon">▣</div><strong>Carrito vacío</strong><p>Busca productos y pulsa “Agregar” para comenzar.</p></div>`;
  return `<div>${items.map(item=>`<div class="cart-line"><div><div class="cart-line-name">${escapeHtml(item.product.name)}</div><div class="cart-line-sub">${money(item.product.salePrice)} · Disponible: ${formatCount(item.product.stock)}</div><div class="quantity-control" style="margin-top:8px"><button class="qty-btn" data-action="cart-dec" data-id="${escapeHtml(item.product.id)}">−</button><strong style="font-size:11px">${item.quantity}</strong><button class="qty-btn" data-action="cart-inc" data-id="${escapeHtml(item.product.id)}" ${item.quantity>=Number(item.product.stock)?'disabled':''}>＋</button><button class="panel-link" style="color:var(--red);margin-left:5px" data-action="cart-remove" data-id="${escapeHtml(item.product.id)}">Quitar</button></div></div><strong style="font-size:11px">${money(item.quantity*Number(item.product.salePrice||0))}</strong></div>`).join('')}</div><div style="padding-top:8px"><div class="cart-total-row"><span>Subtotal</span><span>${money(subtotal)}</span></div><div class="cart-total-row"><span>Descuento</span><span>${money(0)}</span></div><div class="cart-total-row final"><span>Total simulado</span><strong>${money(subtotal)}</strong></div><button class="btn btn-block" style="margin-top:12px" data-action="open-checkout">Finalizar venta →</button><button class="btn btn-secondary btn-block" style="margin-top:7px" data-action="clear-cart">Vaciar carrito</button></div>`;
}

function renderIncomingPage() {
  const entries = [...appState.db.movements].filter(movement => movement.type === 'Entrada' || movement.type === 'Compra').sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,40);
  return `${pageHeader('FARMACIA · RECEPCIÓN', 'Compras y entradas', 'Registra la recepción ficticia de mercancía y aprende cómo una entrada afecta las existencias y su historial.', '<button class="btn" data-action="open-incoming">＋ Registrar entrada</button>')}
    <div class="callout" style="margin-bottom:18px"><span class="callout-icon">↓</span><div><strong>Flujo sugerido:</strong> identifica el producto, revisa lote y vencimiento del caso, registra cantidad recibida y costo de referencia, y valida el saldo actualizado.</div></div>
    <section class="stats-grid">${statCard('Entradas registradas', formatCount(entries.length), 'Movimientos de tipo entrada o compra', '↓')}${statCard('Proveedores de ejemplo', formatCount(new Set(appState.db.products.map(p=>p.supplier).filter(Boolean)).size), 'Nombres ficticios en el catálogo', '♙', 'blue')}${statCard('Productos activos', formatCount(appState.db.products.filter(p=>p.active!==false).length), 'Disponibles para recibir stock', '▤')}${statCard('Compras registradas', formatCount(appState.db.movements.filter(m=>m.type==='Compra').length), 'Entradas rotuladas como compra', '＄', 'amber')}</section>
    <section class="panel"><div class="panel-header"><div><h3 class="panel-title">Historial de entradas</h3><div class="panel-description">Últimos 40 registros del navegador.</div></div><button class="btn btn-secondary btn-small" data-action="navigate" data-page="movements">Ver todos los movimientos</button></div>${entries.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Saldo después</th><th>Referencia / proveedor</th><th>Responsable</th></tr></thead><tbody>${entries.map(movement=>`<tr><td>${formatDateTime(movement.createdAt)}</td><td>${escapeHtml(productById(movement.productId)?.name||'Producto no disponible')}</td><td>${badgeForStatus(movement.type)}</td><td class="table-primary">+${formatCount(movement.quantityDelta)}</td><td>${formatCount(movement.balanceAfter)}</td><td>${escapeHtml(movement.reference||'—')}<div class="table-secondary">${escapeHtml(movement.note||'')}</div></td><td>${escapeHtml(userById(movement.userId)?.name||'Usuario local')}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No hay entradas','Registra una entrada de práctica para actualizar el inventario.','Registrar entrada','open-incoming')}</section>`;
}

function renderMovementsPage() {
  const query = (appState.search.movements || '').toLowerCase();
  const movements = [...appState.db.movements].filter(movement=>[movement.type,movement.reference,movement.note,productById(movement.productId)?.name,userById(movement.userId)?.name].some(value=>String(value||'').toLowerCase().includes(query))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return `${pageHeader('FARMACIA · TRAZABILIDAD', 'Movimientos de inventario', 'Cada entrada, venta o ajuste crea un registro con el producto, la variación, el saldo resultante y el usuario local.', '<button class="btn" data-action="open-incoming">＋ Registrar entrada</button>')}
    <section class="panel"><div class="toolbar"><div class="toolbar-left"><form data-form="filter" data-filter="movements" class="input-wrap"><span class="search-symbol">⌕</span><input name="q" class="input search-input" value="${escapeHtml(appState.search.movements || '')}" placeholder="Buscar producto, tipo o referencia..."></form><span class="badge">${formatCount(movements.length)} movimientos</span></div><div class="toolbar-right"><button class="btn btn-secondary btn-small" data-action="export-movements">Exportar CSV</button></div></div>
    ${movements.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha y hora</th><th>Producto</th><th>Movimiento</th><th>Variación</th><th>Saldo posterior</th><th>Referencia</th><th>Responsable</th></tr></thead><tbody>${movements.map(movement=>`<tr><td>${formatDateTime(movement.createdAt)}</td><td><span class="table-primary">${escapeHtml(productById(movement.productId)?.name||'Producto no disponible')}</span><div class="table-secondary">${escapeHtml(productById(movement.productId)?.code||'')}</div></td><td>${badgeForStatus(movement.type)}</td><td class="table-primary" style="color:${Number(movement.quantityDelta)<0?'var(--red)':'var(--green)'}">${Number(movement.quantityDelta)>0?'+':''}${formatCount(movement.quantityDelta)}</td><td>${formatCount(movement.balanceAfter)}</td><td>${escapeHtml(movement.reference||'—')}<div class="table-secondary">${escapeHtml(movement.note||'')}</div></td><td>${escapeHtml(userById(movement.userId)?.name||'Usuario local')}</td></tr>`).join('')}</tbody></table></div>` : emptyState('Sin movimientos coincidentes','Prueba con otro término de búsqueda.')}</section>`;
}

function renderSalesPage() {
  const query = (appState.search.sales || '').toLowerCase();
  const sales = [...appState.db.sales].filter(sale=>[sale.number,sale.paymentMethod,userById(sale.cashierId)?.name,...sale.items.map(item=>item.name)].some(value=>String(value||'').toLowerCase().includes(query))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const total = sales.reduce((sum,sale)=>sum+Number(sale.total||0),0);
  return `${pageHeader('FARMACIA · COMPROBANTES', 'Ventas registradas', 'Consulta ventas simuladas, los artículos que incluyen y los comprobantes que pueden imprimirse con fines académicos.', '<button class="btn" data-action="navigate" data-page="pos">＋ Nueva venta</button>')}
    <section class="stats-grid">${statCard('Ventas visibles', formatCount(sales.length), 'Según el filtro actual', '▧')}${statCard('Total de ventas visibles', money(total), 'Montos de demostración', '＄', 'blue')}${statCard('Unidades vendidas', formatCount(sales.reduce((sum,sale)=>sum+sale.items.reduce((a,item)=>a+Number(item.quantity||0),0),0)), 'Suma de cantidades de productos', '▤')}${statCard('Medios de pago', formatCount(new Set(sales.map(sale=>sale.paymentMethod)).size), 'Opciones ficticias', '↔', 'amber')}</section>
    <section class="panel"><div class="toolbar"><div class="toolbar-left"><form data-form="filter" data-filter="sales" class="input-wrap"><span class="search-symbol">⌕</span><input name="q" class="input search-input" value="${escapeHtml(appState.search.sales || '')}" placeholder="Buscar comprobante o artículo..."></form><span class="badge">${formatCount(sales.length)} ventas</span></div><div class="toolbar-right"><button class="btn btn-secondary btn-small" data-action="export-sales">Exportar CSV</button></div></div>
    ${sales.length ? `<div class="table-wrap"><table><thead><tr><th>Comprobante</th><th>Fecha y hora</th><th>Artículos / unidades</th><th>Medio de pago</th><th>Total</th><th>Responsable</th><th></th></tr></thead><tbody>${sales.map(sale=>`<tr><td><span class="table-primary">${escapeHtml(sale.number)}</span><div class="table-secondary">${badgeForStatus(sale.status)}</div></td><td>${formatDateTime(sale.createdAt)}</td><td>${formatCount(sale.items.length)} referencias<div class="table-secondary">${formatCount(sale.items.reduce((sum,item)=>sum+Number(item.quantity),0))} unidades</div></td><td>${escapeHtml(sale.paymentMethod)}</td><td class="table-primary">${money(sale.total)}</td><td>${escapeHtml(userById(sale.cashierId)?.name||'Usuario local')}</td><td><button class="btn btn-secondary btn-small" data-action="view-sale" data-id="${escapeHtml(sale.id)}">Comprobante</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('Sin ventas registradas','Abre el punto de venta para practicar una operación demo.','Ir al punto de venta','navigate-pos')}</section>`;
}

function renderReportsPage() {
  return appState.activeModule === 'farmacia' ? renderPharmacyReports() : renderNursingReports();
}

function renderNursingReports() {
  const orders = appState.db.serviceOrders;
  const administrations = appState.db.administrations;
  const byStatus = ['Pendiente','En curso','Completada','Cancelada'].map(status=>({status,count:orders.filter(item=>item.status===status).length}));
  const adminCounts = ['Administrada','Omitida','Rechazada','Retenida'].map(status=>({status,count:administrations.filter(item=>item.status===status).length}));
  return `${pageHeader('ENFERMERÍA · INDICADORES', 'Reportes de enfermería', 'Resumen de la actividad documentada en esta instalación local. No representa indicadores de pacientes reales.', '<button class="btn btn-secondary" data-action="export-nursing-report">Exportar resumen CSV</button>')}
    <section class="stats-grid">${statCard('Expedientes creados', formatCount(appState.db.patients.length), 'Pacientes de práctica', '♙')}${statCard('Órdenes de servicio', formatCount(orders.length), 'Todos los estados', '▤', 'blue')}${statCard('Órdenes de medicamento', formatCount(appState.db.medicationOrders.length), 'Pautas de práctica creadas', '✚', 'amber')}${statCard('Administraciones registradas', formatCount(administrations.length), 'Eventos de simulación documentados', '◷')}${statCard('Registros de signos', formatCount(appState.db.vitals.length), 'Mediciones ficticias ingresadas', '⌁', 'blue')}</section>
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h3 class="panel-title">Órdenes por estado</h3><div class="panel-description">Conteo actual del navegador.</div></div></div><div class="table-wrap"><table><thead><tr><th>Estado</th><th>Cantidad</th><th>Proporción</th></tr></thead><tbody>${byStatus.map(item=>`<tr><td>${badgeForStatus(item.status)}</td><td class="table-primary">${formatCount(item.count)}</td><td>${orders.length?Math.round(item.count/orders.length*100):0}%</td></tr>`).join('')}</tbody></table></div></section><section class="panel"><div class="panel-header"><div><h3 class="panel-title">Administración por resultado</h3><div class="panel-description">No equivale a una medida de calidad clínica.</div></div></div><div class="table-wrap"><table><thead><tr><th>Resultado</th><th>Registros</th></tr></thead><tbody>${adminCounts.map(item=>`<tr><td>${badgeForStatus(item.status)}</td><td class="table-primary">${formatCount(item.count)}</td></tr>`).join('')}</tbody></table></div></section></div>
    <div class="callout warning" style="margin-top:17px"><span class="callout-icon">ⓘ</span><div><strong>Interpretación:</strong> los contadores describen acciones del simulador local. No deben emplearse en informes clínicos, institucionales o de investigación.</div></div>`;
}

function renderPharmacyReports() {
  const products = appState.db.products.filter(product=>product.active!==false);
  const low = products.filter(product=>Number(product.stock)<=Number(product.minStock||0));
  const expired = products.filter(product=>daysUntil(product.expiry)!==null && daysUntil(product.expiry)<0);
  const near = products.filter(product=>daysUntil(product.expiry)!==null && daysUntil(product.expiry)>=0 && daysUntil(product.expiry)<=90);
  const salesTotal = appState.db.sales.reduce((sum,sale)=>sum+Number(sale.total||0),0);
  const costValue = products.reduce((sum,p)=>sum+Number(p.stock||0)*Number(p.purchasePrice||0),0);
  return `${pageHeader('FARMACIA · INDICADORES', 'Reportes de farmacia', 'Indicadores de demostración para existencias, vencimientos y transacciones locales.', '<button class="btn btn-secondary" data-action="export-pharmacy-report">Exportar resumen CSV</button>')}
    <section class="stats-grid">${statCard('Referencias activas', formatCount(products.length), 'Catálogo actual', '▤')}${statCard('Bajo mínimo', formatCount(low.length), 'Necesitan revisión académica', '!', low.length?'red':'')}${statCard('Productos vencidos', formatCount(expired.length), 'No vendibles en el simulador', '◷', expired.length?'red':'')}${statCard('Ventas acumuladas', money(salesTotal), 'Operaciones de demostración', '＄', 'blue')}</section>
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h3 class="panel-title">Alertas por producto</h3><div class="panel-description">Revisa existencias y fechas del catálogo ficticio.</div></div><button class="panel-link" data-action="navigate" data-page="products">Abrir inventario →</button></div><div class="table-wrap"><table><thead><tr><th>Producto</th><th>Stock</th><th>Vencimiento</th><th>Alerta</th></tr></thead><tbody>${products.filter(p=>low.includes(p)||expired.includes(p)||near.includes(p)).map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${formatCount(p.stock)}</td><td>${formatDate(p.expiry)}</td><td>${expired.includes(p)?'<span class="badge danger">Vencido</span>':low.includes(p)?'<span class="badge warning">Stock bajo</span>':'<span class="badge info">Por vencer</span>'}</td></tr>`).join('')||'<tr><td colspan="4">Sin alertas en el catálogo actual.</td></tr>'}</tbody></table></div></section><section class="panel"><div class="panel-header"><div><h3 class="panel-title">Valor del inventario</h3><div class="panel-description">Estimación basada en el costo ingresado.</div></div></div><div class="stat-value" style="margin:16px 0">${money(costValue)}</div><div class="callout"><span class="callout-icon">i</span><div>Este cálculo no contempla impuestos, mermas, ajustes contables ni costos reales. Solo ilustra cómo un sistema resume el stock registrado.</div></div><hr class="rule"><div class="cart-total-row"><span>Entradas registradas</span><strong>${formatCount(appState.db.movements.filter(m=>m.quantityDelta>0).length)}</strong></div><div class="cart-total-row"><span>Salidas registradas</span><strong>${formatCount(appState.db.movements.filter(m=>m.quantityDelta<0).length)}</strong></div></section></div>`;
}

function renderUsersPage() {
  const users = [...appState.db.users].sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return `${pageHeader('ADMINISTRACIÓN ACADÉMICA · CUENTAS LOCALES', 'Usuarios de práctica', 'Las cuentas se almacenan en este navegador. No tienen acceso global ni son una autenticación segura para datos sensibles.', '<button class="btn" data-action="open-new-user">＋ Crear usuario</button>')}
    <div class="callout warning" style="margin-bottom:18px"><span class="callout-icon">!</span><div><strong>Limitación importante:</strong> un usuario con acceso físico al navegador puede modificar los datos locales. Los roles sirven para enseñar los flujos de una aplicación, no para proteger información clínica.</div></div>
    <section class="panel"><div class="toolbar"><div><h3 class="panel-title">Cuentas registradas</h3><div class="panel-description">${formatCount(users.length)} cuentas en esta instalación.</div></div><button class="btn btn-secondary btn-small" data-action="export-users">Exportar cuentas CSV</button></div>
    <div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Código académico</th><th>Rol</th><th>Origen</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${users.map(user=>`<tr><td><div style="display:flex;align-items:center;gap:9px"><span class="avatar" style="width:30px;height:30px">${escapeHtml(initials(user.name))}</span><span class="table-primary">${escapeHtml(user.name)}</span></div></td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.document||'—')}</td><td>${badgeForStatus(roleLabel(user.role))}</td><td>${user.isDemo?'<span class="badge info">Demostración</span>':'<span class="badge">Registro local</span>'}</td><td>${user.active!==false?'<span class="badge success">Activo</span>':'<span class="badge danger">Inactivo</span>'}</td><td>${user.id===appState.currentUser.id?'<span class="small muted">Sesión actual</span>':`<button class="btn btn-secondary btn-small" data-action="toggle-user" data-id="${escapeHtml(user.id)}">${user.active===false?'Activar':'Desactivar'}</button>`}</td></tr>`).join('')}</tbody></table></div></section>
    <p class="small muted" style="margin-top:14px">Para que las estudiantes accedan a los mismos usuarios o compartan actividad entre computadores sería necesario un backend; GitHub Pages y localStorage no proporcionan sincronización de datos.</p>`;
}

function renderBackupPage() {
  return `${pageHeader('ADMINISTRACIÓN · DATOS LOCALES', 'Datos y respaldos', 'Exporta la base de datos académica local, impórtala en otra sesión o restaura los datos iniciales de entrenamiento.', '<button class="btn" data-action="export-data">⇩ Descargar respaldo JSON</button>')}
    <div class="callout warning" style="margin-bottom:18px"><span class="callout-icon">ⓘ</span><div><strong>Antes de compartir un respaldo:</strong> el JSON puede incluir cuentas locales y registros creados durante la práctica. Aunque los datos iniciales son ficticios, revisa su contenido antes de distribuirlo. No uses esta función para exportar datos reales de salud.</div></div>
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h3 class="panel-title">Exportar datos</h3><div class="panel-description">Crea una copia de las tablas del simulador en un único JSON.</div></div><span class="stat-icon">⇩</span></div><div class="stats-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin:14px 0 18px">${statCard('Usuarios', formatCount(appState.db.users.length), 'Cuentas de este navegador', '♙')}${statCard('Pacientes', formatCount(appState.db.patients.length), 'Expedientes ficticios', '✚')}${statCard('Productos', formatCount(appState.db.products.length), 'Referencias de farmacia', '▤')}${statCard('Movimientos', formatCount(appState.db.movements.length), 'Eventos de inventario', '⇄')}</div><button class="btn btn-block" data-action="export-data">Descargar JSON completo</button><p class="small muted" style="line-height:1.65;margin-bottom:0">El respaldo incluye los hash de contraseñas locales para conservar las cuentas en la restauración. No es un mecanismo de cifrado.</p></section>
    <section class="panel"><div class="panel-header"><div><h3 class="panel-title">Importar respaldo</h3><div class="panel-description">Reemplaza los datos actuales por un archivo JSON exportado desde esta app.</div></div><span class="stat-icon blue">⇧</span></div><p class="muted small" style="line-height:1.7">Selecciona un archivo <code>.json</code> exportado previamente. Se comprobará que incluya las colecciones principales antes de reemplazar los datos actuales.</p><input id="backup-file" class="hidden" type="file" accept="application/json,.json"><button class="btn btn-secondary btn-block" data-action="import-data">Seleccionar archivo JSON</button><p class="small muted" style="line-height:1.65">La importación modifica el almacenamiento local de esta instalación. Descarga un respaldo antes de continuar.</p><hr class="rule"><h3 class="panel-title">Restaurar datos de demostración</h3><p class="muted small" style="line-height:1.7">Borra los cambios locales y vuelve a generar los pacientes, productos y cuentas demo incluidos en el proyecto.</p><button class="btn btn-danger btn-block" data-action="reset-data">Restaurar datos iniciales</button></section></div>
    <section class="panel" style="margin-top:17px"><div class="panel-header"><div><h3 class="panel-title">Estado del almacenamiento</h3><div class="panel-description">Información de esta instalación local.</div></div><span class="badge success">Activo en el navegador</span></div><div class="table-wrap"><table><tbody><tr><th>Modo de almacenamiento</th><td>localStorage del navegador</td></tr><tr><th>Último guardado</th><td>${formatDateTime(appState.db.lastSavedAt)}</td></tr><tr><th>Instalación</th><td>CEPRODENT · Aula académica</td></tr><tr><th>Sincronización</th><td><span class="badge warning">No disponible</span> Los datos no se comparten entre usuarios ni dispositivos.</td></tr></tbody></table></div></section>`;
}

function patientSelectOptions(selected = '') {
  return appState.db.patients.map(patient=>`<option value="${escapeHtml(patient.id)}" ${patient.id===selected?'selected':''}>${escapeHtml(patient.record)} · ${escapeHtml(patient.name)}</option>`).join('');
}
function productSelectOptions(selected = '', onlyMedicines = false) {
  return appState.db.products.filter(product=>product.active!==false && (!onlyMedicines || String(product.category).toLowerCase().includes('medicamento'))).map(product=>`<option value="${escapeHtml(product.id)}" ${product.id===selected?'selected':''}>${escapeHtml(product.code)} · ${escapeHtml(product.name)}</option>`).join('');
}
function field(name, label, value = '', options = {}) {
  const { type='text', placeholder='', required=false, hint='', min='', max='', step='', readonly=false, cls='', maxlength='', autocomplete='' } = options;
  const control = type === 'textarea'
    ? `<textarea class="textarea" name="${escapeHtml(name)}" ${required?'required':''} placeholder="${escapeHtml(placeholder)}" ${maxlength?`maxlength="${maxlength}"`:''}>${escapeHtml(value)}</textarea>`
    : `<input class="input" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${required?'required':''} placeholder="${escapeHtml(placeholder)}" ${min!==''?`min="${escapeHtml(min)}"`:''} ${max!==''?`max="${escapeHtml(max)}"`:''} ${step!==''?`step="${escapeHtml(step)}"`:''} ${readonly?'readonly':''} ${maxlength?`maxlength="${maxlength}"`:''} ${autocomplete?`autocomplete="${escapeHtml(autocomplete)}"`:''}>`;
  return `<div class="field ${cls}"><label>${escapeHtml(label)}${required?' *':''}</label>${control}${hint?`<div class="hint">${escapeHtml(hint)}</div>`:''}</div>`;
}
function selectField(name, label, options, selected = '', extra = {}) {
  const { required=true, hint='', cls='' } = extra;
  return `<div class="field ${cls}"><label>${escapeHtml(label)}${required?' *':''}</label><select class="select" name="${escapeHtml(name)}" ${required?'required':''}>${options.map(option=>`<option value="${escapeHtml(option.value)}" ${String(option.value)===String(selected)?'selected':''}>${escapeHtml(option.label)}</option>`).join('')}</select>${hint?`<div class="hint">${escapeHtml(hint)}</div>`:''}</div>`;
}
function modalActions(cancelLabel = 'Cancelar', submitLabel = 'Guardar registro') {
  return `<div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">${escapeHtml(cancelLabel)}</button><button type="submit" class="btn">${escapeHtml(submitLabel)} →</button></div>`;
}
function showModal(title, description, body, wide = false) {
  const existing = $('#modal-layer'); if (existing) existing.remove();
  const layer = document.createElement('div'); layer.id = 'modal-layer'; layer.className = 'modal-layer';
  layer.innerHTML = `<section class="modal-card ${wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><header class="modal-header"><div><h2 class="modal-title">${escapeHtml(title)}</h2>${description?`<div class="modal-description">${escapeHtml(description)}</div>`:''}</div><button class="modal-close" data-action="close-modal" type="button" aria-label="Cerrar">×</button></header><div class="modal-body">${body}</div></section>`;
  document.body.appendChild(layer);
  const focusable = $('input:not([type=hidden]),select,textarea,button', layer);
  if (focusable) focusable.focus();
}
function closeModal() { $('#modal-layer')?.remove(); appState.modalContext = {}; }

function openPatientForm() {
  const body = `<form data-form="patient-form"><div class="form-grid">
    ${field('name','Nombre para el caso simulado','',{required:true,placeholder:'Paciente de práctica 05',maxlength:90})}
    ${field('document','Documento ficticio','',{required:true,placeholder:'SIM-1005',maxlength:35})}
    ${field('birthDate','Fecha de nacimiento','',{type:'date',required:true,max:localDate()})}
    ${selectField('sex','Sexo en el caso',[{value:'Femenino',label:'Femenino'},{value:'Masculino',label:'Masculino'},{value:'No especificado',label:'No especificado'}],'No especificado')}
    ${field('phone','Teléfono demostrativo','0000000000',{required:true,placeholder:'0000000000',maxlength:20,hint:'Usa un valor ficticio, nunca un teléfono real.'})}
    ${field('allergies','Alergias / alertas del escenario','',{required:true,placeholder:'No evaluado en el caso simulado',maxlength:180})}
    ${field('notes','Notas del expediente','',{type:'textarea',placeholder:'Contexto del ejercicio, antecedentes ficticios o información pendiente...',cls:'full',maxlength:1200})}
  </div>${modalActions('Cancelar','Crear expediente')}</form>`;
  showModal('Registrar paciente simulado','Crea un expediente ficticio que podrá asociarse con órdenes y notas de práctica.',body);
}

function openServiceOrderForm(selectedPatientId = '') {
  if (!appState.db.patients.length) { toast('Registra primero un paciente ficticio.', 'error'); return; }
  const today = localDate();
  const body = `<form data-form="service-order-form"><div class="form-grid">
    ${selectField('patientId','Paciente del caso',appState.db.patients.map(patient=>({value:patient.id,label:`${patient.record} · ${patient.name}`})),selectedPatientId || appState.db.patients[0]?.id)}
    ${selectField('type','Tipo de servicio',[{value:'Control de signos vitales',label:'Control de signos vitales'},{value:'Curación',label:'Curación'},{value:'Procedimiento',label:'Procedimiento'},{value:'Educación al paciente',label:'Educación al paciente'},{value:'Toma de muestra simulada',label:'Toma de muestra simulada'},{value:'Plan de cuidados',label:'Plan de cuidados'},{value:'Seguimiento',label:'Seguimiento'}],'Control de signos vitales')}
    ${field('title','Nombre o descripción breve','',{required:true,placeholder:'Ej. Valoración inicial del caso',maxlength:120,cls:'full'})}
    ${selectField('priority','Prioridad académica',[{value:'Normal',label:'Normal'},{value:'Media',label:'Media'},{value:'Alta',label:'Alta'}],'Normal')}
    ${field('serviceDate','Fecha programada',today,{type:'date',required:true})}
    ${field('notes','Notas para la práctica','',{type:'textarea',placeholder:'Detalles necesarios para completar el ejercicio...',cls:'full',maxlength:1000})}
  </div><div class="callout warning" style="margin-top:15px"><span class="callout-icon">ⓘ</span><div>Esta orden es únicamente académica; no constituye una orden asistencial ni autoriza procedimientos reales.</div></div>${modalActions('Cancelar','Crear orden')}</form>`;
  showModal('Nueva orden de servicio','Registra una actividad de enfermería dentro de un escenario ficticio.',body);
}

function openMedicationOrderForm() {
  if (!appState.db.patients.length) { toast('Registra primero un paciente ficticio.', 'error'); return; }
  const medicines = appState.db.products.filter(product=>product.active!==false && String(product.category).toLowerCase().includes('medicamento'));
  if (!medicines.length) { toast('No hay productos de la categoría Medicamentos para asociar. Crea uno en farmacia primero.', 'error'); return; }
  const body = `<form data-form="med-order-form"><div class="form-grid">
    ${selectField('patientId','Paciente del caso',appState.db.patients.map(patient=>({value:patient.id,label:`${patient.record} · ${patient.name}`})),appState.db.patients[0]?.id)}
    ${selectField('medicationId','Medicamento del catálogo',medicines.map(product=>({value:product.id,label:`${product.code} · ${product.name}`})),medicines[0]?.id)}
    ${field('dose','Dosis según el caso docente','',{required:true,placeholder:'Según indicación ficticia del ejercicio',maxlength:100})}
    ${selectField('route','Vía / forma de administración',[{value:'Oral (simulación)',label:'Oral (simulación)'},{value:'Tópica / demostración',label:'Tópica / demostración'},{value:'Inhalatoria (simulación)',label:'Inhalatoria (simulación)'},{value:'Oftálmica (simulación)',label:'Oftálmica (simulación)'},{value:'Otra (solo ejercicio)',label:'Otra (solo ejercicio)'}],'Oral (simulación)')}
    ${field('frequency','Frecuencia descriptiva','Según escenario de práctica',{required:true,placeholder:'Ej. Según ejercicio docente',maxlength:100})}
    ${field('times','Horarios del día','08:00, 16:00',{required:true,placeholder:'08:00, 16:00, 22:00',hint:'Escribe horas en formato HH:MM separadas por coma. Ejemplo solo de interfaz, no pauta clínica.',cls:'full'})}
    ${field('startDate','Fecha inicial',localDate(),{type:'date',required:true})}
    ${field('endDate','Fecha final',localDate(),{type:'date',required:true})}
    ${field('notes','Notas del escenario','Orden académica sin validez clínica. Verificar el caso con el docente.',{type:'textarea',cls:'full',maxlength:1000})}
  </div><div class="callout warning" style="margin-top:15px"><span class="callout-icon">!</span><div><strong>No uses datos reales.</strong> Este formulario enseña a capturar campos electrónicos. No calcula dosis ni valida una prescripción médica.</div></div>${modalActions('Cancelar','Guardar orden ficticia')}</form>`;
  showModal('Nueva orden de medicamento','Define una pauta de demostración para aprender cómo se genera una agenda.',body, true);
}

function openVitalForm() {
  if (!appState.db.patients.length) { toast('Registra primero un paciente ficticio.', 'error'); return; }
  const body = `<form data-form="vital-form"><div class="form-grid">
    ${selectField('patientId','Paciente del caso',appState.db.patients.map(patient=>({value:patient.id,label:`${patient.record} · ${patient.name}`})),appState.db.patients[0]?.id)}
    ${field('temperature','Temperatura (°C)','36.5',{type:'number',required:true,min:1,max:100,step:0.1})}
    ${field('pulse','Frecuencia cardíaca (lpm)','72',{type:'number',required:true,min:1,max:500,step:1})}
    ${field('respiration','Frecuencia respiratoria (rpm)','16',{type:'number',required:true,min:1,max:200,step:1})}
    ${field('systolicBP','Presión sistólica (mmHg)','120',{type:'number',required:true,min:1,max:500,step:1})}
    ${field('diastolicBP','Presión diastólica (mmHg)','80',{type:'number',required:true,min:1,max:500,step:1})}
    ${field('spo2','Saturación de oxígeno (%)','98',{type:'number',required:true,min:1,max:100,step:1})}
    ${field('note','Nota del escenario','Mediciones de demostración para práctica de captura.',{type:'textarea',cls:'full',maxlength:600})}
  </div><div class="callout warning" style="margin-top:14px"><span class="callout-icon">ⓘ</span><div>Los límites de entrada son validaciones técnicas del formulario; no definen rangos normales ni sustituyen una evaluación clínica.</div></div>${modalActions('Cancelar','Guardar mediciones')}</form>`;
  showModal('Registrar signos vitales simulados','Introduce las medidas del escenario inventado y vincúlalas con su expediente.',body,true);
}

function openEvolutionForm() {
  if (!appState.db.patients.length) { toast('Registra primero un paciente ficticio.', 'error'); return; }
  const body = `<form data-form="evolution-form"><div class="form-grid">${selectField('patientId','Paciente del caso',appState.db.patients.map(patient=>({value:patient.id,label:`${patient.record} · ${patient.name}`})),appState.db.patients[0]?.id)}${selectField('type','Tipo de nota',[{value:'Valoración de práctica',label:'Valoración de práctica'},{value:'Evolución simulada',label:'Evolución simulada'},{value:'Procedimiento realizado',label:'Procedimiento realizado'},{value:'Educación registrada',label:'Educación registrada'},{value:'Observación de turno',label:'Observación de turno'}],'Evolución simulada')}${field('note','Nota de enfermería','',{type:'textarea',required:true,placeholder:'Describe únicamente los datos del escenario ficticio: observación, acción y respuesta...',cls:'full',maxlength:2000})}</div>${modalActions('Cancelar','Guardar nota')}</form>`;
  showModal('Añadir nota de enfermería','Documenta un evento del caso simulado con redacción clara y cronológica.',body,true);
}

function openProductForm(productId = '') {
  const product = productId ? productById(productId) : null;
  const nextCode = `MED-${String(appState.db.counters.product || 13).padStart(4, '0')}`;
  appState.modalContext.productId = productId || '';
  const body = `<form data-form="product-form"><input type="hidden" name="id" value="${escapeHtml(product?.id || '')}"><div class="form-grid">
    ${field('code','Código de producto',product?.code || nextCode,{required:true,placeholder:'MED-0013',maxlength:35})}
    ${field('name','Nombre del producto',product?.name || '',{required:true,placeholder:'Nombre descriptivo del producto ficticio',maxlength:130})}
    ${selectField('category','Categoría',[{value:'Medicamentos',label:'Medicamentos'},{value:'Material de curación',label:'Material de curación'},{value:'Elementos de protección',label:'Elementos de protección'},{value:'Antisépticos',label:'Antisépticos'},{value:'Dispositivos',label:'Dispositivos'},{value:'Insumos',label:'Insumos'},{value:'Otra',label:'Otra'}],product?.category || 'Medicamentos')}
    ${field('presentation','Presentación',product?.presentation || '',{required:true,placeholder:'Ej. Caja de práctica / unidad',maxlength:100})}
    ${field('lot','Número de lote ficticio',product?.lot || `LOTE-DEMO-${String(Date.now()).slice(-4)}`,{required:true,placeholder:'LOTE-DEMO-001',maxlength:50})}
    ${field('expiry','Fecha de vencimiento',product?.expiry || '',{type:'date',required:true})}
    ${field('minStock','Existencia mínima',product?.minStock ?? 5,{type:'number',required:true,min:0,step:1})}
    ${field('purchasePrice','Costo unitario de referencia',product?.purchasePrice ?? 0,{type:'number',required:true,min:0,step:1,hint:'Valor ficticio en COP.'})}
    ${field('salePrice','Precio de venta demo',product?.salePrice ?? 0,{type:'number',required:true,min:0,step:1,hint:'No es un precio comercial real.'})}
    ${field('supplier','Proveedor ficticio',product?.supplier || 'Proveedor de práctica Demo',{required:true,placeholder:'Proveedor simulado',maxlength:120})}
    ${product ? `<div class="field"><label>Existencia actual</label><div class="input" style="background:#f6faf9">${formatCount(product.stock)} unidades</div><div class="hint">Usa “Registrar entrada” para modificar stock y mantener un movimiento de auditoría.</div></div>` : field('stock','Stock inicial',0,{type:'number',required:true,min:0,step:1,hint:'Se generará un movimiento inicial de inventario.'})}
  </div>${modalActions('Cancelar',product?'Guardar cambios':'Crear producto')}</form>`;
  showModal(product ? 'Editar producto' : 'Crear producto', 'Gestiona referencias ficticias, presentación, lote y precios de entrenamiento.', body, true);
}

function openIncomingModal(productId = '') {
  const products = appState.db.products.filter(product => product.active !== false);
  if (!products.length) { toast('Primero registra un producto.', 'error'); return; }
  const currentProduct = productById(productId) || products[0];
  const body = `<form data-form="incoming-form"><div class="form-grid">
    ${selectField('productId','Producto recibido',products.map(product=>({value:product.id,label:`${product.code} · ${product.name}`})),currentProduct.id)}
    ${selectField('type','Tipo de movimiento',[{value:'Entrada',label:'Entrada general'},{value:'Compra',label:'Compra a proveedor'}],'Compra')}
    ${field('quantity','Cantidad recibida',1,{type:'number',required:true,min:1,step:1,hint:'Unidades de inventario simuladas.'})}
    ${field('unitCost','Costo unitario de referencia',currentProduct.purchasePrice || 0,{type:'number',required:true,min:0,step:1})}
    ${field('supplier','Proveedor ficticio',currentProduct.supplier || 'Proveedor de práctica Demo',{required:true,maxlength:120})}
    ${field('reference','Número de documento demo','COMP-DEMO-001',{required:true,placeholder:'COMP-DEMO-001',maxlength:60})}
    ${field('lot','Nuevo lote (opcional)','',{placeholder:currentProduct.lot || 'LOTE-DEMO-001',maxlength:50,hint:'Déjalo en blanco para conservar el lote actual.'})}
    ${field('expiry','Nueva fecha de vencimiento (opcional)','',{type:'date',hint:'Déjala vacía para conservar la fecha actual.'})}
    ${field('note','Observación','Recepción ficticia para práctica de inventario.',{type:'textarea',cls:'full',maxlength:500})}
  </div>${modalActions('Cancelar','Registrar entrada')}</form>`;
  showModal('Registrar entrada de inventario', 'Actualiza las existencias y crea un registro auditable en movimientos.', body, true);
}

function openCheckoutModal() {
  const items = appState.cart.map(item=>({...item,product:productById(item.productId)})).filter(item=>item.product);
  if (!items.length) { toast('Agrega al menos un producto al carrito.', 'error'); return; }
  const subtotal = items.reduce((sum,item)=>sum+item.quantity*Number(item.product.salePrice||0),0);
  const body = `<form data-form="checkout-form"><div class="receipt-paper" style="margin-bottom:18px"><h3>CEPRODENT · FARMACIA DEMO</h3><div class="receipt-center">PREVISUALIZACIÓN DE COMPROBANTE<br>Este documento no tiene validez fiscal.</div><hr class="rule">${items.map(item=>`<div class="receipt-line"><span>${item.quantity} × ${escapeHtml(item.product.name)}</span><strong>${money(item.quantity*Number(item.product.salePrice||0))}</strong></div>`).join('')}<hr class="rule"><div class="receipt-line"><strong>TOTAL</strong><strong>${money(subtotal)}</strong></div></div>
    ${selectField('paymentMethod','Medio de pago simulado',[{value:'Efectivo simulado',label:'Efectivo simulado'},{value:'Tarjeta simulada',label:'Tarjeta simulada'},{value:'Transferencia demo',label:'Transferencia demo'},{value:'Pago académico',label:'Pago académico'}],'Efectivo simulado')}
    <div class="callout warning" style="margin-top:14px"><span class="callout-icon">ⓘ</span><div>Al confirmar se descontará la cantidad del inventario local y se registrará una venta y sus movimientos. No se procesa dinero real.</div></div>${modalActions('Volver al carrito','Confirmar venta')}</form>`;
  showModal('Finalizar venta simulada','Verifica los artículos y registra la transacción local.', body);
}

function openAdministrationModal(medOrderId, scheduledAt) {
  const order = appState.db.medicationOrders.find(item=>item.id===medOrderId);
  if (!order) { toast('No se encontró la orden de medicamento.', 'error'); return; }
  const body = `<form data-form="administration-form"><input type="hidden" name="medicationOrderId" value="${escapeHtml(medOrderId)}"><input type="hidden" name="scheduledAt" value="${escapeHtml(scheduledAt)}"><div class="callout warning" style="margin-bottom:16px"><span class="callout-icon">!</span><div><strong>Solo ejercicio de documentación.</strong> Seleccionar “Administrada” registra el resultado ficticio de un caso docente. No es una orden de administración real.</div></div>
    <div class="form-grid"><div class="field"><label>Paciente simulado</label><div class="input" style="background:#f6faf9">${escapeHtml(patientName(order.patientId))}</div></div><div class="field"><label>Medicamento</label><div class="input" style="background:#f6faf9">${escapeHtml(medName(order))}</div></div><div class="field"><label>Horario</label><div class="input" style="background:#f6faf9">${formatDate(scheduledAt.slice(0,10))} · ${escapeHtml(scheduledAt.slice(11))}</div></div><div class="field"><label>Dosis consignada en el caso</label><div class="input" style="background:#f6faf9">${escapeHtml(order.dose)}</div></div>
    ${selectField('status','Resultado de la simulación',[{value:'Administrada',label:'Administrada (simulado)'},{value:'Omitida',label:'Omitida'},{value:'Rechazada',label:'Rechazada'},{value:'Retenida',label:'Retenida según escenario'}],'Administrada')}
    ${field('note','Observación / justificación','',{type:'textarea',placeholder:'Documenta el contexto ficticio; obligatorio si no se registra como administrada.',cls:'full',maxlength:1000})}</div>${modalActions('Cancelar','Guardar registro')}</form>`;
  showModal('Registrar resultado de administración', 'Documenta un resultado vinculado al horario y a la orden seleccionada.', body, true);
}

function openNewUserModal() {
  const body = `<form data-form="user-form"><div class="form-grid">${field('name','Nombre completo','',{required:true,placeholder:'Nombre de estudiante',maxlength:90})}${field('email','Correo electrónico','',{type:'email',required:true,placeholder:'estudiante@ceprodent.edu.co',maxlength:120})}${field('document','Código académico ficticio','',{required:true,placeholder:'EST-1001',maxlength:35})}${selectField('role','Rol asignado',[{value:'enfermeria',label:'Enfermería'},{value:'farmacia',label:'Farmacia'}],'enfermeria')}${field('password','Contraseña inicial','',{type:'password',required:true,min:6,placeholder:'Mínimo 6 caracteres',autocomplete:'new-password',cls:'full'})}</div><div class="callout warning" style="margin-top:14px"><span class="callout-icon">ⓘ</span><div>Esta cuenta solo existirá en el almacenamiento local de este navegador. Para acceder desde otro equipo necesitarías un backend y autenticación centralizada.</div></div>${modalActions('Cancelar','Crear usuario local')}</form>`;
  showModal('Crear usuario de práctica','Los administradores no pueden crearse desde el registro público; aquí solo se asignan roles de Enfermería o Farmacia.',body);
}

function showPatientDetails(id) {
  const patient = patientById(id); if (!patient) return;
  const serviceOrders = appState.db.serviceOrders.filter(item=>item.patientId===id).length;
  const meds = appState.db.medicationOrders.filter(item=>item.patientId===id).length;
  const evolutions = appState.db.evolutions.filter(item=>item.patientId===id).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const body = `<div class="stats-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:16px">${statCard('Órdenes',formatCount(serviceOrders),'Servicios', '▤')}${statCard('Pautas',formatCount(meds),'Medicamentos demo','✚','blue')}${statCard('Notas',formatCount(evolutions.length),'Evoluciones','≋','amber')}</div><div class="table-wrap"><table><tbody><tr><th>Expediente</th><td>${escapeHtml(patient.record)}</td><th>Código</th><td>${escapeHtml(patient.document)}</td></tr><tr><th>Nombre del caso</th><td colspan="3">${escapeHtml(patient.name)}</td></tr><tr><th>Nacimiento</th><td>${formatDate(patient.birthDate)}</td><th>Sexo</th><td>${escapeHtml(patient.sex||'—')}</td></tr><tr><th>Alergias / alertas</th><td colspan="3">${escapeHtml(patient.allergies||'Sin información')}</td></tr><tr><th>Notas</th><td colspan="3">${escapeHtml(patient.notes||'—')}</td></tr></tbody></table></div><div class="form-actions"><button class="btn btn-secondary" data-action="close-modal">Cerrar</button><button class="btn" data-action="open-new-service-order" data-patient-id="${escapeHtml(patient.id)}">＋ Crear orden</button></div>`;
  showModal('Expediente de práctica', 'Ficha de consulta del caso ficticio.', body, true);
}

function showServiceOrderDetails(id) {
  const order = appState.db.serviceOrders.find(item=>item.id===id); if (!order) return;
  const body = `<div class="table-wrap"><table><tbody><tr><th>Número</th><td>${escapeHtml(order.number)}</td><th>Estado</th><td>${badgeForStatus(order.status)}</td></tr><tr><th>Paciente</th><td colspan="3">${escapeHtml(patientName(order.patientId))}</td></tr><tr><th>Servicio</th><td>${escapeHtml(order.type)}</td><th>Prioridad</th><td>${escapeHtml(order.priority)}</td></tr><tr><th>Descripción</th><td colspan="3">${escapeHtml(order.title)}</td></tr><tr><th>Fecha programada</th><td>${formatDate(order.serviceDate)}</td><th>Fecha de creación</th><td>${formatDateTime(order.createdAt)}</td></tr><tr><th>Notas</th><td colspan="3">${escapeHtml(order.notes||'Sin notas')}</td></tr><tr><th>Creada por</th><td colspan="3">${escapeHtml(userById(order.createdBy)?.name||'Usuario local')}</td></tr></tbody></table></div><div class="form-actions"><button class="btn btn-secondary" data-action="close-modal">Cerrar</button>${order.status!=='Completada'&&order.status!=='Cancelada'?`<button class="btn" data-action="advance-service-order" data-id="${escapeHtml(order.id)}">Avanzar estado</button>`:''}</div>`;
  showModal(`Orden ${order.number}`, 'Detalle de la orden de servicio académica.', body, true);
}

function showAdministrationDetails(id) {
  const record = appState.db.administrations.find(item=>item.id===id); if (!record) return;
  const order = appState.db.medicationOrders.find(item=>item.id===record.medicationOrderId);
  const body = `<div class="table-wrap"><table><tbody><tr><th>Paciente</th><td>${escapeHtml(patientName(order?.patientId))}</td><th>Resultado</th><td>${badgeForStatus(record.status)}</td></tr><tr><th>Medicamento</th><td colspan="3">${escapeHtml(order?medName(order):'Orden ya no disponible')}</td></tr><tr><th>Horario programado</th><td>${formatDateTime(record.scheduledAt)}</td><th>Registrado</th><td>${formatDateTime(record.recordedAt)}</td></tr><tr><th>Observación</th><td colspan="3">${escapeHtml(record.note||'Sin observaciones')}</td></tr><tr><th>Responsable</th><td colspan="3">${escapeHtml(userById(record.performedBy)?.name||'Usuario local')}</td></tr></tbody></table></div><div class="form-actions"><button class="btn btn-secondary" data-action="close-modal">Cerrar</button></div>`;
  showModal('Detalle del registro de administración', 'Registro de simulación guardado en este navegador.', body, true);
}

function receiptMarkup(sale) {
  const cashier = userById(sale.cashierId)?.name || 'Usuario local';
  return `<div class="receipt-paper"><h3>${escapeHtml(appState.db.institution.name||'CEPRODENT')}</h3><div class="receipt-center">FARMACIA · COMPROBANTE ACADÉMICO<br>No. ${escapeHtml(sale.number)}<br>${formatDateTime(sale.createdAt)}<br>Responsable: ${escapeHtml(cashier)}<br><strong>NO ES FACTURA FISCAL</strong></div><hr class="rule">${sale.items.map(item=>`<div class="receipt-line"><span>${formatCount(item.quantity)} × ${escapeHtml(item.name)}<br><small>${money(item.unitPrice)} c/u</small></span><strong>${money(item.total)}</strong></div>`).join('')}<hr class="rule"><div class="receipt-line"><span>Subtotal</span><strong>${money(sale.subtotal)}</strong></div><div class="receipt-line"><span>Descuento</span><strong>${money(sale.discount||0)}</strong></div><div class="receipt-line" style="font-size:14px"><strong>TOTAL</strong><strong>${money(sale.total)}</strong></div><hr class="rule"><div class="receipt-center">Pago: ${escapeHtml(sale.paymentMethod)}<br>Gracias por participar en la práctica.<br>Datos completamente ficticios.</div></div>`;
}
function showSaleReceipt(id) {
  const sale = appState.db.sales.find(item=>item.id===id); if (!sale) return;
  const body = `${receiptMarkup(sale)}<div class="form-actions"><button class="btn btn-secondary" data-action="close-modal">Cerrar</button><button class="btn" data-action="print-receipt">Imprimir comprobante demo</button></div>`;
  showModal(`Comprobante ${sale.number}`, 'Recibo de práctica, sin validez fiscal.', body);
}

function showVitalDetails(id) {
  const item = appState.db.vitals.find(row=>row.id===id); if (!item) return;
  const body = `<div class="table-wrap"><table><tbody><tr><th>Paciente</th><td>${escapeHtml(patientName(item.patientId))}</td><th>Fecha de registro</th><td>${formatDateTime(item.createdAt)}</td></tr><tr><th>Temperatura</th><td>${escapeHtml(item.temperature)} °C</td><th>Frecuencia cardíaca</th><td>${escapeHtml(item.pulse)} lpm</td></tr><tr><th>Frecuencia respiratoria</th><td>${escapeHtml(item.respiration)} rpm</td><th>Presión arterial</th><td>${escapeHtml(item.systolicBP)}/${escapeHtml(item.diastolicBP)} mmHg</td></tr><tr><th>SpO₂</th><td>${escapeHtml(item.spo2)} %</td><th>Responsable</th><td>${escapeHtml(userById(item.recordedBy)?.name||'Usuario local')}</td></tr><tr><th>Nota del escenario</th><td colspan="3">${escapeHtml(item.note||'—')}</td></tr></tbody></table></div><div class="callout warning" style="margin-top:14px"><span class="callout-icon">ⓘ</span><div>El sistema solo conserva los valores consignados en la simulación; no los clasifica ni emite interpretación médica.</div></div><div class="form-actions"><button class="btn btn-secondary" data-action="close-modal">Cerrar</button></div>`;
  showModal('Detalle de signos vitales', 'Registro de entrenamiento sin interpretación clínica.', body, true);
}

function showEvolutionDetails(id) {
  const item = appState.db.evolutions.find(row=>row.id===id); if (!item) return;
  showModal('Nota de enfermería', 'Detalle de una nota académica.', `<div class="table-wrap"><table><tbody><tr><th>Paciente</th><td>${escapeHtml(patientName(item.patientId))}</td><th>Fecha</th><td>${formatDateTime(item.createdAt)}</td></tr><tr><th>Tipo</th><td colspan="3">${escapeHtml(item.type)}</td></tr><tr><th>Nota</th><td colspan="3" style="white-space:pre-wrap">${escapeHtml(item.note)}</td></tr><tr><th>Responsable</th><td colspan="3">${escapeHtml(userById(item.createdBy)?.name||'Usuario local')}</td></tr></tbody></table></div><div class="form-actions"><button class="btn btn-secondary" data-action="close-modal">Cerrar</button></div>`, true);
}

function enterWorkspace(user, preferredModule) {
  appState.currentUser = user;
  appState.view = 'workspace';
  appState.activeModule = user.role === 'farmacia' ? 'farmacia' : user.role === 'enfermeria' ? 'enfermeria' : (preferredModule || 'enfermeria');
  appState.page = 'dashboard'; appState.menuOpen = false; appState.search = {}; appState.cart = [];
  renderWorkspace();
}

async function attemptLogin(email, password, preferredModule) {
  const user = appState.db.users.find(item=>String(item.email).toLowerCase()===String(email).trim().toLowerCase());
  if (!user || user.active === false) { toast('No encontramos una cuenta activa con ese correo.', 'error'); return; }
  let passHash;
  if (String(user.passwordHash || '').startsWith('local:')) passHash = localPasswordHash(password);
  else passHash = await hashPassword(password);
  if (passHash !== user.passwordHash) { toast('La contraseña no coincide. Revisa los datos e inténtalo de nuevo.', 'error'); return; }
  if (user.role !== 'admin' && preferredModule && user.role !== preferredModule) {
    toast(`Esta cuenta tiene rol ${roleLabel(user.role)}. Selecciona ese módulo para continuar.`, 'error');
    return;
  }
  appState.selectedModule = preferredModule || (user.role==='farmacia'?'farmacia':'enfermeria');
  enterWorkspace(user, appState.selectedModule);
  toast(`Sesión iniciada: ${roleLabel(user.role)}.`, 'success');
}

function localPasswordHash(password) {
  let hash = 2166136261;
  const input = String(password);
  for (let i=0; i<input.length; i+=1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return 'local:' + (hash >>> 0).toString(16);
}

async function submitAuthForm(form) {
  const fd = new FormData(form);
  if (form.dataset.form === 'login') {
    await attemptLogin(fd.get('email'), fd.get('password'), appState.selectedModule);
    return;
  }
  const name = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const documentCode = String(fd.get('document') || '').trim();
  const password = String(fd.get('password') || '');
  const role = String(fd.get('role') || appState.selectedModule);
  if (name.length < 3 || documentCode.length < 3) { toast('Completa el nombre y un código académico ficticio válido.', 'error'); return; }
  if (!['enfermeria','farmacia'].includes(role)) { toast('Selecciona un rol de práctica permitido.', 'error'); return; }
  if (password.length < 6) { toast('La contraseña debe contener al menos 6 caracteres.', 'error'); return; }
  if (appState.db.users.some(user=>user.email.toLowerCase()===email)) { toast('Ya existe una cuenta con ese correo en este navegador.', 'error'); return; }
  if (appState.db.users.some(user=>String(user.document||'').toLowerCase()===documentCode.toLowerCase())) { toast('Ese código académico ya está registrado localmente.', 'error'); return; }
  const user = { id:randomId('usr'), name, email, document:documentCode, role, passwordHash:await hashPassword(password), active:true, createdAt:isoNow(), isDemo:false };
  appState.db.users.push(user); persistDb(); appState.selectedModule = role; enterWorkspace(user,role); toast('Cuenta local creada. Recuerda que no se sincroniza con otros equipos.','success');
}

function downloadFile(filename, content, mimeType = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type:mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportDatabase() {
  const payload = { app:'CEPRODENT Aula de simulación clínica', formatVersion:1, exportedAt:isoNow(), note:'Datos educativos. Todos los casos de ejemplo son ficticios. Contiene cuentas locales y hash de contraseñas.', data:clone(appState.db) };
  downloadFile(`ceprodent-respaldo-${localDate()}.json`, JSON.stringify(payload,null,2));
  toast('Respaldo JSON descargado. Guárdalo en un lugar seguro.','success');
}
function csvEscape(value) { return `"${String(value ?? '').replace(/"/g,'""')}"`; }
function exportCsv(filename, headers, rows) {
  const content = '\uFEFF' + [headers, ...rows].map(row=>row.map(csvEscape).join(';')).join('\r\n');
  downloadFile(filename,content,'text/csv;charset=utf-8');
  toast('Archivo CSV preparado para descargar.','success');
}
function exportPatientsCsv() {
  exportCsv(`ceprodent-pacientes-${localDate()}.csv`, ['Expediente','Paciente ficticio','Código','Nacimiento','Sexo','Alergias o alertas','Notas'], appState.db.patients.map(p=>[p.record,p.name,p.document,p.birthDate,p.sex,p.allergies,p.notes]));
}
function exportVitalsCsv() {
  exportCsv(`ceprodent-signos-vitales-${localDate()}.csv`, ['Fecha','Paciente simulado','Temperatura °C','Pulso lpm','Respiración rpm','Presión sistólica','Presión diastólica','SpO2 %','Nota','Responsable'], appState.db.vitals.map(item=>[item.createdAt,patientName(item.patientId),item.temperature,item.pulse,item.respiration,item.systolicBP,item.diastolicBP,item.spo2,item.note,userById(item.recordedBy)?.name]));
}
function exportServiceOrdersCsv() {
  exportCsv(`ceprodent-ordenes-servicio-${localDate()}.csv`, ['Número','Paciente','Tipo','Descripción','Prioridad','Fecha servicio','Estado','Notas','Fecha creación'], appState.db.serviceOrders.map(o=>[o.number,patientName(o.patientId),o.type,o.title,o.priority,o.serviceDate,o.status,o.notes,o.createdAt]));
}
function exportProductsCsv() {
  exportCsv(`ceprodent-productos-${localDate()}.csv`, ['Código','Nombre','Categoría','Presentación','Lote','Vencimiento','Stock','Stock mínimo','Costo','Precio venta','Proveedor'], appState.db.products.map(p=>[p.code,p.name,p.category,p.presentation,p.lot,p.expiry,p.stock,p.minStock,p.purchasePrice,p.salePrice,p.supplier]));
}
function exportMovementsCsv() {
  exportCsv(`ceprodent-movimientos-${localDate()}.csv`, ['Fecha','Producto','Tipo','Variación','Saldo después','Referencia','Nota','Responsable'], appState.db.movements.map(m=>[m.createdAt,productById(m.productId)?.name,m.type,m.quantityDelta,m.balanceAfter,m.reference,m.note,userById(m.userId)?.name]));
}
function exportSalesCsv() {
  exportCsv(`ceprodent-ventas-${localDate()}.csv`, ['Comprobante','Fecha','Artículos','Unidades','Subtotal','Descuento','Total','Medio de pago','Responsable'], appState.db.sales.map(s=>[s.number,s.createdAt,s.items.map(i=>i.name).join(' | '),s.items.reduce((sum,i)=>sum+Number(i.quantity),0),s.subtotal,s.discount,s.total,s.paymentMethod,userById(s.cashierId)?.name]));
}
function exportUsersCsv() {
  exportCsv(`ceprodent-usuarios-locales-${localDate()}.csv`, ['Nombre','Correo','Código académico','Rol','Activo','Origen'], appState.db.users.map(u=>[u.name,u.email,u.document,roleLabel(u.role),u.active!==false?'Sí':'No',u.isDemo?'Demo':'Local']));
}
function exportNursingReportCsv() {
  exportCsv(`ceprodent-reporte-enfermeria-${localDate()}.csv`, ['Indicador','Cantidad'], [['Pacientes simulados',appState.db.patients.length],['Órdenes de servicio',appState.db.serviceOrders.length],['Órdenes de medicamento',appState.db.medicationOrders.length],['Administraciones registradas',appState.db.administrations.length],...['Pendiente','En curso','Completada','Cancelada'].map(status=>[`Órdenes: ${status}`,appState.db.serviceOrders.filter(item=>item.status===status).length]),...['Administrada','Omitida','Rechazada','Retenida'].map(status=>[`Administraciones: ${status}`,appState.db.administrations.filter(item=>item.status===status).length])]);
}
function exportPharmacyReportCsv() {
  const products = appState.db.products.filter(p=>p.active!==false);
  exportCsv(`ceprodent-reporte-farmacia-${localDate()}.csv`, ['Indicador','Cantidad o valor'], [['Productos activos',products.length],['Productos bajo mínimo',products.filter(p=>Number(p.stock)<=Number(p.minStock||0)).length],['Productos vencidos',products.filter(p=>daysUntil(p.expiry)!==null && daysUntil(p.expiry)<0).length],['Productos por vencer (90 días)',products.filter(p=>daysUntil(p.expiry)!==null && daysUntil(p.expiry)>=0 && daysUntil(p.expiry)<=90).length],['Ventas acumuladas COP',appState.db.sales.reduce((sum,s)=>sum+Number(s.total||0),0)],['Valor inventario a costo COP',products.reduce((sum,p)=>sum+Number(p.stock||0)*Number(p.purchasePrice||0),0)]]);
}

async function importDatabaseFile(file) {
  if (!file) return;
  try {
    const content = await file.text();
    const parsed = JSON.parse(content);
    const incoming = parsed.data || parsed;
    const required = ['users','patients','products','serviceOrders','medicationOrders','administrations','evolutions','vitals','sales','movements'];
    if (!incoming || typeof incoming !== 'object' || required.some(key=>!Array.isArray(incoming[key]))) throw new Error('El archivo no contiene las colecciones necesarias del simulador.');
    if (incoming.users.some(user=>!user.id || !user.email || !user.role || !user.passwordHash)) throw new Error('Hay cuentas incompletas o sin hash de contraseña; utiliza un respaldo exportado desde esta aplicación.');
    const nextDb = normalizeDb(clone(incoming));
    setSavedItem(STORAGE_KEY, JSON.stringify(nextDb));
    appState.db = nextDb;
    const current = appState.currentUser ? nextDb.users.find(user=>user.id===appState.currentUser.id && user.active!==false) : null;
    appState.currentUser = current || null;
    if (!current) appState.view = 'landing';
    else { appState.view='workspace'; if (current.role==='farmacia') appState.activeModule='farmacia'; else if (current.role==='enfermeria') appState.activeModule='enfermeria'; }
    persistDb(); closeModal(); renderRoot(); toast('Respaldo importado correctamente en este navegador.','success');
  } catch (error) {
    toast(error.message || 'No se pudo importar el archivo JSON.','error');
  } finally {
    const input = $('#backup-file'); if (input) input.value='';
  }
}

function createMovement({ productId, type, quantityDelta, balanceAfter, reference, note }) {
  appState.db.movements.push({ id:randomId('mov'), productId, type, quantityDelta:Number(quantityDelta), balanceAfter:Number(balanceAfter), reference:reference||'', note:note||'', userId:appState.currentUser?.id || 'usr-admin', createdAt:isoNow() });
}

async function handleFormSubmit(form) {
  const formType = form.dataset.form;
  const fd = new FormData(form);
  if (formType === 'filter') {
    appState.search[form.dataset.filter] = String(fd.get('q')||'').trim(); renderWorkspace(); return;
  }
  if (formType === 'login' || formType === 'register') { await submitAuthForm(form); return; }
  if (formType === 'patient-form') {
    const name=String(fd.get('name')||'').trim(), documentCode=String(fd.get('document')||'').trim();
    if (appState.db.patients.some(p=>String(p.document).toLowerCase()===documentCode.toLowerCase())) { toast('Ya existe un expediente con ese documento ficticio.','error'); return; }
    const record=nextNumber('patient');
    appState.db.patients.push({ id:randomId('pac'), record, name, document:documentCode, birthDate:fd.get('birthDate'), sex:fd.get('sex'), phone:fd.get('phone'), allergies:String(fd.get('allergies')||'').trim(), notes:String(fd.get('notes')||'').trim(), createdAt:isoNow() });
    persistDb(); closeModal(); renderWorkspace(); toast(`Expediente ${record} creado.`); return;
  }
  if (formType === 'service-order-form') {
    const order={id:randomId('ord'),number:nextNumber('serviceOrder'),patientId:fd.get('patientId'),type:fd.get('type'),title:String(fd.get('title')||'').trim(),priority:fd.get('priority'),status:'Pendiente',serviceDate:fd.get('serviceDate'),notes:String(fd.get('notes')||'').trim(),createdBy:appState.currentUser.id,createdAt:isoNow()};
    appState.db.serviceOrders.push(order); persistDb(); closeModal(); appState.page='serviceOrders'; renderWorkspace(); toast(`Orden ${order.number} creada.`); return;
  }
  if (formType === 'med-order-form') {
    const timesRaw=String(fd.get('times')||'');
    const times=[...new Set(timesRaw.split(/[\s,;]+/).map(item=>item.trim()).filter(Boolean))].sort();
    if (!times.length || times.some(time=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) { toast('Escribe horarios válidos en formato HH:MM, separados por coma.', 'error'); return; }
    if (String(fd.get('startDate'))>String(fd.get('endDate'))) { toast('La fecha final debe ser igual o posterior a la fecha inicial.', 'error'); return; }
    const product=productById(fd.get('medicationId'));
    if (!product || !String(product.category).toLowerCase().includes('medicamento')) { toast('Selecciona un medicamento ficticio del catálogo.', 'error'); return; }
    const order={id:randomId('medord'),number:nextNumber('medicationOrder'),patientId:fd.get('patientId'),medicationId:fd.get('medicationId'),dose:String(fd.get('dose')||'').trim(),route:fd.get('route'),frequency:String(fd.get('frequency')||'').trim(),times,startDate:fd.get('startDate'),endDate:fd.get('endDate'),status:'Activa',notes:String(fd.get('notes')||'').trim(),createdBy:appState.currentUser.id,createdAt:isoNow()};
    appState.db.medicationOrders.push(order); persistDb(); closeModal(); appState.page='medicationOrders'; renderWorkspace(); toast(`Orden ${order.number} guardada en el simulador.`); return;
  }
  if (formType === 'vital-form') {
    const values = ['temperature','pulse','respiration','systolicBP','diastolicBP','spo2'].map(key=>Number(fd.get(key)));
    if (values.some(value=>!Number.isFinite(value) || value<=0)) { toast('Completa todas las medidas con valores numéricos mayores que cero.', 'error'); return; }
    const item={id:randomId('vital'),patientId:fd.get('patientId'),temperature:values[0],pulse:values[1],respiration:values[2],systolicBP:values[3],diastolicBP:values[4],spo2:values[5],note:String(fd.get('note')||'').trim(),recordedBy:appState.currentUser.id,createdAt:isoNow()};
    appState.db.vitals.push(item); persistDb(); closeModal(); appState.page='vitals'; renderWorkspace(); toast('Registro de medidas simulado guardado.'); return;
  }
  if (formType === 'evolution-form') {
    const item={id:randomId('evo'),patientId:fd.get('patientId'),type:fd.get('type'),note:String(fd.get('note')||'').trim(),createdBy:appState.currentUser.id,createdAt:isoNow()};
    appState.db.evolutions.push(item); persistDb(); closeModal(); appState.page='evolutions'; renderWorkspace(); toast('Nota académica registrada.'); return;
  }
  if (formType === 'product-form') {
    const id=String(fd.get('id')||''); const existing=id?productById(id):null;
    const code=String(fd.get('code')||'').trim();
    if (appState.db.products.some(p=>p.id!==id && String(p.code).toLowerCase()===code.toLowerCase())) { toast('Ya existe un producto con ese código.', 'error'); return; }
    const quantity=existing?Number(existing.stock||0):Math.max(0,Number(fd.get('stock')||0));
    const productData={code,name:String(fd.get('name')||'').trim(),category:fd.get('category'),presentation:String(fd.get('presentation')||'').trim(),lot:String(fd.get('lot')||'').trim(),expiry:fd.get('expiry'),stock:quantity,minStock:Math.max(0,Number(fd.get('minStock')||0)),purchasePrice:Math.max(0,Number(fd.get('purchasePrice')||0)),salePrice:Math.max(0,Number(fd.get('salePrice')||0)),supplier:String(fd.get('supplier')||'').trim(),active:true};
    if (existing) Object.assign(existing,productData);
    else {
      const product={id:randomId('prd'),...productData}; appState.db.products.push(product); appState.db.counters.product=(Number(appState.db.counters.product||1)+1);
      if (quantity>0) createMovement({productId:product.id,type:'Entrada',quantityDelta:quantity,balanceAfter:quantity,reference:`Inventario inicial · ${product.code}`,note:'Saldo inicial de práctica.',});
    }
    persistDb(); closeModal(); appState.page='products'; renderWorkspace(); toast(existing?'Producto actualizado.':'Producto creado.'); return;
  }
  if (formType === 'incoming-form') {
    const product=productById(fd.get('productId')); const quantity=Math.floor(Number(fd.get('quantity')||0));
    if (!product || quantity<=0 || !Number.isFinite(quantity)) { toast('Selecciona un producto y una cantidad válida.', 'error'); return; }
    product.stock=Number(product.stock||0)+quantity;
    const cost=Number(fd.get('unitCost')||0); if (cost>=0) product.purchasePrice=cost;
    if (String(fd.get('supplier')||'').trim()) product.supplier=String(fd.get('supplier')).trim();
    if (String(fd.get('lot')||'').trim()) product.lot=String(fd.get('lot')).trim();
    if (String(fd.get('expiry')||'').trim()) product.expiry=fd.get('expiry');
    const type=fd.get('type');
    createMovement({productId:product.id,type,quantityDelta:quantity,balanceAfter:product.stock,reference:String(fd.get('reference')||'').trim(),note:String(fd.get('note')||'').trim()});
    persistDb(); closeModal(); appState.page='incoming'; renderWorkspace(); toast(`Entrada registrada. Nuevo stock: ${product.stock}.`); return;
  }
  if (formType === 'checkout-form') {
    const cartItems=appState.cart.map(item=>({...item,product:productById(item.productId)}));
    if (!cartItems.length || cartItems.some(item=>!item.product || Number(item.quantity)>Number(item.product.stock) || (daysUntil(item.product.expiry)!==null && daysUntil(item.product.expiry)<0))) { toast('El carrito tiene productos sin stock suficiente o vencidos. Revisa la venta.', 'error'); return; }
    const items=cartItems.map(item=>({productId:item.product.id,name:item.product.name,code:item.product.code,quantity:Number(item.quantity),unitPrice:Number(item.product.salePrice||0),total:Number(item.quantity)*Number(item.product.salePrice||0)}));
    const subtotal=items.reduce((sum,item)=>sum+item.total,0);
    const sale={id:randomId('sal'),number:nextNumber('sale'),items,subtotal,discount:0,total:subtotal,paymentMethod:fd.get('paymentMethod'),status:'Completada',cashierId:appState.currentUser.id,createdAt:isoNow()};
    items.forEach(item=>{const product=productById(item.productId); product.stock=Number(product.stock)-item.quantity; createMovement({productId:product.id,type:'Salida por venta',quantityDelta:-item.quantity,balanceAfter:product.stock,reference:sale.number,note:`Venta académica · ${item.quantity} unidad(es)`});});
    appState.db.sales.push(sale); appState.cart=[]; persistDb(); closeModal(); appState.page='sales'; renderWorkspace(); showSaleReceipt(sale.id); toast(`Venta ${sale.number} registrada localmente.`); return;
  }
  if (formType === 'administration-form') {
    const medOrderId=String(fd.get('medicationOrderId')||''); const scheduledAt=String(fd.get('scheduledAt')||'');
    if (appState.db.administrations.some(item=>item.medicationOrderId===medOrderId && item.scheduledAt===scheduledAt)) { toast('Este horario ya tiene un resultado registrado.', 'error'); return; }
    const status=fd.get('status'); const note=String(fd.get('note')||'').trim();
    if (status!=='Administrada' && note.length<3) { toast('Documenta la justificación del estado seleccionado.', 'error'); return; }
    appState.db.administrations.push({id:randomId('adm'),medicationOrderId:medOrderId,scheduledAt,status,note,performedBy:appState.currentUser.id,recordedAt:isoNow()});
    persistDb(); closeModal(); appState.page='schedule'; renderWorkspace(); toast('Resultado del horario registrado en la simulación.'); return;
  }
  if (formType === 'user-form') {
    const name=String(fd.get('name')||'').trim(); const email=String(fd.get('email')||'').trim().toLowerCase(); const documentCode=String(fd.get('document')||'').trim(); const password=String(fd.get('password')||''); const role=String(fd.get('role')||'');
    if (!['enfermeria','farmacia'].includes(role)) { toast('Selecciona un rol permitido.', 'error'); return; }
    if (appState.db.users.some(user=>user.email.toLowerCase()===email)) { toast('Ese correo ya existe en esta instalación.', 'error'); return; }
    if (appState.db.users.some(user=>String(user.document||'').toLowerCase()===documentCode.toLowerCase())) { toast('Ese código académico ya existe.', 'error'); return; }
    if (password.length<6) { toast('La contraseña debe tener al menos 6 caracteres.', 'error'); return; }
    appState.db.users.push({id:randomId('usr'),name,email,document:documentCode,role,passwordHash:await hashPassword(password),active:true,createdAt:isoNow(),isDemo:false});
    persistDb(); closeModal(); appState.page='users'; renderWorkspace(); toast('Usuario local creado.'); return;
  }
}

function navigateTo(page) {
  const user=appState.currentUser;
  if (!user) return;
  if (user.role==='admin') {
    if (['pos','products','incoming','movements','sales'].includes(page)) appState.activeModule='farmacia';
    else if (['patients','serviceOrders','medicationOrders','schedule','vitals','evolutions'].includes(page)) appState.activeModule='enfermeria';
  }
  if (!pageAllowed(page,user,appState.activeModule)) { toast('Tu rol no tiene acceso a esa sección.', 'error'); return; }
  appState.page=page; appState.menuOpen=false; renderWorkspace();
}

function advanceServiceOrder(id) {
  const order=appState.db.serviceOrders.find(item=>item.id===id); if (!order) return;
  const next = { 'Pendiente':'En curso', 'En curso':'Completada' }[order.status];
  if (!next) return;
  order.status=next; order.updatedAt=isoNow(); persistDb(); closeModal(); renderWorkspace(); toast(`La orden ${order.number} ahora está: ${next}.`);
}

function onAppClick(event) {
  const actionNode=event.target.closest('[data-action]');
  if (!actionNode) {
    if (event.target.id==='modal-layer') closeModal();
    return;
  }
  const action=actionNode.dataset.action;
  const id=actionNode.dataset.id;
  if (action==='auth-login' || action==='auth-register') {
    appState.selectedModule=actionNode.dataset.module || 'enfermeria'; appState.authMode=action==='auth-register'?'register':'login'; appState.view='auth'; renderAuth(); return;
  }
  if (action==='back-home') { appState.view='landing'; renderLanding(); return; }
  if (action==='demo-login') {
    const role=actionNode.dataset.role; const module=role==='farmacia'?'farmacia':role==='enfermeria'?'enfermeria':(actionNode.dataset.module||appState.selectedModule);
    appState.selectedModule=module; attemptLogin(actionNode.dataset.email,actionNode.dataset.password,module); return;
  }
  if (action==='navigate') { navigateTo(actionNode.dataset.page); return; }
  if (action.startsWith('navigate-')) { navigateTo(action.slice('navigate-'.length)); return; }
  if (action==='switch-module') {
    if (appState.currentUser?.role!=='admin') { toast('Solo el administrador académico puede cambiar entre módulos.', 'error'); return; }
    appState.activeModule=actionNode.dataset.module; appState.page='dashboard'; appState.menuOpen=false; renderWorkspace(); return;
  }
  if (action==='logout') { appState.currentUser=null; appState.view='landing'; appState.cart=[]; appState.menuOpen=false; closeModal(); renderLanding(); return; }
  if (action==='toggle-menu') { appState.menuOpen=!appState.menuOpen; renderWorkspace(); return; }
  if (action==='close-menu') { appState.menuOpen=false; renderWorkspace(); return; }
  if (action==='close-modal') { closeModal(); return; }
  if (action==='reload') { location.reload(); return; }
  if (action==='open-new-patient') { openPatientForm(); return; }
  if (action==='open-new-service-order') { openServiceOrderForm(actionNode.dataset.patientId||''); return; }
  if (action==='open-new-med-order') { openMedicationOrderForm(); return; }
  if (action==='open-new-evolution') { openEvolutionForm(); return; }
  if (action==='open-new-vitals') { openVitalForm(); return; }
  if (action==='open-new-product') { openProductForm(); return; }
  if (action==='edit-product') { openProductForm(id); return; }
  if (action==='open-incoming') { openIncomingModal(); return; }
  if (action==='add-stock-for-product') { openIncomingModal(id); return; }
  if (action==='open-checkout') { openCheckoutModal(); return; }
  if (action==='open-new-user') { if (appState.currentUser?.role==='admin') openNewUserModal(); else toast('Solo el administrador puede crear usuarios desde este panel.','error'); return; }
  if (action==='view-patient') { showPatientDetails(id); return; }
  if (action==='view-service-order') { showServiceOrderDetails(id); return; }
  if (action==='advance-service-order') { advanceServiceOrder(id); return; }
  if (action==='deactivate-med-order') {
    const order=appState.db.medicationOrders.find(item=>item.id===id); if (order) { order.status='Finalizada'; order.closedAt=isoNow(); persistDb(); renderWorkspace(); toast(`La orden ${order.number} quedó finalizada.`); } return;
  }
  if (action==='log-administration') { openAdministrationModal(actionNode.dataset.medOrderId,actionNode.dataset.scheduledAt); return; }
  if (action==='view-administration') { showAdministrationDetails(id); return; }
  if (action==='view-evolution') { showEvolutionDetails(id); return; }
  if (action==='view-vitals') { showVitalDetails(id); return; }
  if (action==='view-sale') { showSaleReceipt(id); return; }
  if (action==='print-receipt') { window.print(); return; }
  if (action==='add-to-cart') {
    const product=productById(id); if (!product) return;
    if (daysUntil(product.expiry)!==null && daysUntil(product.expiry)<0) { toast('No se pueden vender productos vencidos, incluso en el simulador.', 'error'); return; }
    const cartItem=appState.cart.find(item=>item.productId===id);
    if (Number(product.stock)<=Number(cartItem?.quantity||0)) { toast('No hay existencias suficientes para esa cantidad.', 'error'); return; }
    if (cartItem) cartItem.quantity+=1; else appState.cart.push({productId:id,quantity:1});
    renderPosProducts(); renderCart(); return;
  }
  if (action==='cart-inc' || action==='cart-dec' || action==='cart-remove') {
    const item=appState.cart.find(row=>row.productId===id); const product=productById(id);
    if (action==='cart-remove') appState.cart=appState.cart.filter(row=>row.productId!==id);
    else if (item && action==='cart-inc' && product && item.quantity<Number(product.stock)) item.quantity+=1;
    else if (item && action==='cart-dec') { item.quantity-=1; if (item.quantity<=0) appState.cart=appState.cart.filter(row=>row.productId!==id); }
    renderPosProducts(); renderCart(); return;
  }
  if (action==='clear-cart') { appState.cart=[]; renderPosProducts(); renderCart(); return; }
  if (action==='export-data') { exportDatabase(); return; }
  if (action==='import-data') { $('#backup-file')?.click(); return; }
  if (action==='reset-data') {
    const confirmed=window.confirm('Esto eliminará todos los cambios y cuentas locales de este navegador y restaurará los datos demo iniciales. ¿Continuar?');
    if (confirmed) { removeSavedItem(STORAGE_KEY); location.reload(); }
    return;
  }
  if (action==='export-patients') { exportPatientsCsv(); return; }
  if (action==='export-vitals') { exportVitalsCsv(); return; }
  if (action==='export-service-orders') { exportServiceOrdersCsv(); return; }
  if (action==='export-products') { exportProductsCsv(); return; }
  if (action==='export-movements') { exportMovementsCsv(); return; }
  if (action==='export-sales') { exportSalesCsv(); return; }
  if (action==='export-users') { exportUsersCsv(); return; }
  if (action==='export-nursing-report') { exportNursingReportCsv(); return; }
  if (action==='export-pharmacy-report') { exportPharmacyReportCsv(); return; }
  if (action==='toggle-user') {
    if (appState.currentUser?.role!=='admin') { toast('Acción exclusiva del administrador.','error'); return; }
    const user=appState.db.users.find(item=>item.id===id); if (!user) return;
    if (user.id===appState.currentUser.id) { toast('No puedes desactivar la cuenta que está usando esta sesión.','error'); return; }
    user.active=user.active===false; persistDb(); renderWorkspace(); toast(`Cuenta ${user.active?'activada':'desactivada'}.`); return;
  }
}

document.addEventListener('click', onAppClick);
document.addEventListener('submit', event => {
  const form=event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  handleFormSubmit(form).catch(error=>{ console.error(error); toast('No se pudo completar la operación. Revisa los campos e inténtalo de nuevo.','error'); });
});
document.addEventListener('input', event => {
  if (event.target.id==='posSearch') {
    appState.posSearch=event.target.value;
    renderPosProducts();
  }
});
document.addEventListener('change', event => {
  if (event.target.id==='schedule-filter') { appState.scheduleFilter=event.target.value; renderWorkspace(); }
  if (event.target.id==='backup-file' && event.target.files?.[0]) importDatabaseFile(event.target.files[0]);
});
document.addEventListener('keydown', event => {
  if (event.key==='Escape' && $('#modal-layer')) closeModal();
  else if (event.key==='Escape' && appState.menuOpen) { appState.menuOpen=false; renderWorkspace(); }
});

boot();
