/** CEPRODENT 2.0 - Panel del administrador */
APP.admin = { docentes: [], estudiantes: [], programas: [] };

async function loadAdminDashboard() {
    await Promise.all([loadAdminStats(), loadAdminTopProgramas()]);
}

async function loadAdminStats() {
    const { data, error } = await db.from('v_dashboard_administrador').select('*').single();
    if (error) { console.error(error); return; }
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value ?? 0; };
    set('statDocentesActivos', data.docentes_activos); set('statDocentesInactivos', data.docentes_inactivos);
    set('statEstudiantesActivos', data.estudiantes_activos); set('statEstudiantesInactivos', data.estudiantes_inactivos);
    set('statProgramas', data.programas_activos);
}

async function loadAdminTopProgramas() {
    const box = document.getElementById('adminTopProgramas');
    const { data, error } = await db.from('v_top_programas').select('*');
    if (error) { box.innerHTML = '<p class="text-muted">No fue posible cargar las estadísticas.</p>'; return; }
    box.innerHTML = data?.length ? data.map((p, i) => `<div class="student-item"><div><div class="s-name">#${i + 1} ${escapeHTML(p.nombre)}</div><div class="s-email">${p.total_estudiantes} estudiante(s)</div></div><i class="fa-solid fa-trophy"></i></div>`).join('') : '<p class="text-muted">Aún no hay programas con estudiantes.</p>';
}

function showAdminModule(name) {
    ['adminDashboardPanel','adminDocentesPanel','adminEstudiantesPanel','adminProgramasPanel'].forEach(id => document.getElementById(id).classList.add('hidden'));
    const map = { docentes:'adminDocentesPanel', estudiantes:'adminEstudiantesPanel', programas:'adminProgramasPanel' };
    if (!map[name]) { document.getElementById('adminDashboardPanel').classList.remove('hidden'); loadAdminDashboard(); return; }
    document.getElementById(map[name]).classList.remove('hidden');
    if (name === 'docentes') loadAdminUsersList('docente');
    if (name === 'estudiantes') { loadAdminProgramasSelect(); loadAdminUsersList('estudiante'); }
    if (name === 'programas') loadAdminProgramasList();
}

async function loadAdminUsersList(rol) {
    const id = rol === 'docente' ? 'adminDocentesList' : 'adminEstudiantesList'; const box = document.getElementById(id);
    box.innerHTML = '<div class="loading-inline"><i class="fa-solid fa-spinner"></i> Cargando...</div>';
    let query = db.from('usuarios').select('id,nombres,apellidos,email,activo,created_at').eq('rol', rol).order('created_at',{ascending:false});
    const { data, error } = await query;
    if (error) { box.innerHTML=''; showToast(friendlyError(error),'error'); return; }
    APP.admin[rol === 'docente' ? 'docentes' : 'estudiantes'] = data || [];
    renderAdminUsersList(id, data || [], rol);
}

function renderAdminUsersList(id, users, rol) {
    const box=document.getElementById(id); if (!users.length) { box.innerHTML='<p class="text-muted">Aún no hay registros.</p>'; return; }
    box.innerHTML=users.map(u=>`<div class="student-item"><div><div class="s-name">${escapeHTML(u.nombres)} ${escapeHTML(u.apellidos)} ${u.activo ? '' : '<span class="status-inactive">Inactivo</span>'}</div><div class="s-email">${escapeHTML(u.email)}</div></div><div class="admin-actions"><button class="btn-icon" title="Editar" onclick="adminEditUser('${u.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-icon" title="${u.activo?'Desactivar':'Activar'}" onclick="adminToggleUser('${u.id}',${!u.activo})"><i class="fa-solid ${u.activo?'fa-user-slash':'fa-user-check'}"></i></button><button class="btn-icon danger" title="Eliminar" onclick="adminDeleteUser('${u.id}','${rol}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');
}

async function createAdminUser(event, rol) {
    event.preventDefault(); const prefix=rol==='docente'?'docente':'estudiante'; const btn=document.getElementById(rol==='docente'?'btnCrearDocente':'btnCrearEstudiante');
    const payload={rol,nombres:document.getElementById(prefix+'Nombres').value.trim(),apellidos:document.getElementById(prefix+'Apellidos').value.trim(),email:document.getElementById(prefix+'Email').value.trim(),password:document.getElementById(prefix+'Password').value};
    if (rol==='estudiante') payload.programa_id=document.getElementById('estudiantePrograma').value;
    setButtonLoading(btn,true,'Creando...');
    try { const {data,error}=await db.functions.invoke('create-user',{body:payload}); if(error) throw error; if(data?.error) throw new Error(data.error); showToast(`${rol==='docente'?'Docente':'Estudiante'} creado correctamente.`,'success'); event.target.reset(); await loadAdminUsersList(rol); await loadAdminStats(); }
    catch(error){ showToast(friendlyError(error),'error',6000); } finally { setButtonLoading(btn,false); }
}

async function loadAdminProgramasSelect() {
    const select=document.getElementById('estudiantePrograma'); const {data,error}=await db.from('programas').select('id,nombre').eq('activo',true).order('nombre');
    if(error){ select.innerHTML='<option value="">No se pudieron cargar programas</option>'; return; }
    select.innerHTML='<option value="">— Seleccione un programa —</option>'+(data||[]).map(p=>`<option value="${p.id}">${escapeHTML(p.nombre)}</option>`).join('');
}

async function loadAdminProgramasList(){ const box=document.getElementById('adminProgramasList'); const {data,error}=await db.from('programas').select('id,nombre,activo').order('nombre'); if(error){showToast(friendlyError(error),'error');return;} APP.admin.programas=data||[]; box.innerHTML=(data||[]).length?(data||[]).map(p=>`<div class="student-item"><div><div class="s-name">${escapeHTML(p.nombre)} ${p.activo?'':'<span class="status-inactive">Inactivo</span>'}</div></div><div class="admin-actions"><button class="btn-icon" onclick="adminEditPrograma('${p.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-icon" onclick="adminTogglePrograma('${p.id}',${!p.activo})"><i class="fa-solid ${p.activo?'fa-ban':'fa-check'}"></i></button><button class="btn-icon danger" onclick="adminDeletePrograma('${p.id}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join(''):'<p class="text-muted">Aún no hay programas.</p>'; }

async function handleCreatePrograma(e){e.preventDefault(); const name=document.getElementById('adminProgramaNombre').value.trim(); const btn=document.getElementById('btnCrearPrograma'); setButtonLoading(btn,true,'Creando...'); try{const {error}=await db.from('programas').insert({nombre:name,activo:true,creado_por:APP.user.id}); if(error) throw error; e.target.reset(); showToast('Programa creado correctamente.','success'); await loadAdminProgramasList(); await loadAdminStats();}catch(error){showToast(friendlyError(error),'error');}finally{setButtonLoading(btn,false);}}

async function adminEditUser(id){const u=[...APP.admin.docentes,...APP.admin.estudiantes].find(x=>x.id===id); if(!u)return; const nombres=prompt('Nombres:',u.nombres); if(nombres===null)return; const apellidos=prompt('Apellidos:',u.apellidos); if(apellidos===null)return; const email=prompt('Correo:',u.email); if(email===null)return; const {error}=await db.from('usuarios').update({nombres:nombres.trim(),apellidos:apellidos.trim(),email:email.trim()}).eq('id',id); if(error)showToast(friendlyError(error),'error');else{showToast('Usuario actualizado.','success');await loadAdminUsersList(u.rol|| (APP.admin.docentes.some(x=>x.id===id)?'docente':'estudiante'));}}
async function adminToggleUser(id,activo){const {error}=await db.from('usuarios').update({activo}).eq('id',id); if(error){showToast(friendlyError(error),'error');return;} showToast(activo?'Usuario activado.':'Usuario desactivado.','success'); const rol=APP.admin.docentes.some(x=>x.id===id)?'docente':'estudiante'; await loadAdminUsersList(rol); await loadAdminStats();}
async function adminDeleteUser(id,rol){if(!confirm('¿Desea eliminar este usuario? Esta acción no se puede deshacer.'))return; const {error}=await db.from('usuarios').delete().eq('id',id); if(error){showToast(friendlyError(error),'error');return;} showToast('Usuario eliminado.','success'); await loadAdminUsersList(rol); await loadAdminStats();}
async function adminEditPrograma(id){const p=APP.admin.programas.find(x=>x.id===id); if(!p)return; const nombre=prompt('Nombre del programa:',p.nombre); if(nombre===null||!nombre.trim())return; const {error}=await db.from('programas').update({nombre:nombre.trim()}).eq('id',id); if(error)showToast(friendlyError(error),'error');else{showToast('Programa actualizado.','success');loadAdminProgramasList();}}
async function adminTogglePrograma(id,activo){const {error}=await db.from('programas').update({activo}).eq('id',id);if(error)showToast(friendlyError(error),'error');else{showToast(activo?'Programa activado.':'Programa desactivado.','success');loadAdminProgramasList();loadAdminStats();}}
async function adminDeletePrograma(id){if(!confirm('¿Eliminar este programa? No se podrá eliminar si tiene información relacionada.'))return;const {error}=await db.from('programas').delete().eq('id',id);if(error)showToast(friendlyError(error),'error');else{showToast('Programa eliminado.','success');loadAdminProgramasList();loadAdminStats();}}

function initAdminModule(){
    document.querySelectorAll('[data-admin-module]').forEach(b=>b.addEventListener('click',()=>showAdminModule(b.dataset.adminModule)));
    document.querySelectorAll('.admin-back').forEach(b=>b.addEventListener('click',()=>showAdminModule('dashboard')));
    document.getElementById('adminCreateDocenteForm').addEventListener('submit',e=>createAdminUser(e,'docente'));
    document.getElementById('adminCreateEstudianteForm').addEventListener('submit',e=>createAdminUser(e,'estudiante'));
    document.getElementById('adminCreateProgramaForm').addEventListener('submit',handleCreatePrograma);
}
