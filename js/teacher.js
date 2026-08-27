/**
 * teacher.js
 * ----------------------------------------------------------------------
 * Todo lo relacionado con el panel del docente:
 *   - Listado de sus módulos (con conteo de preguntas y estudiantes).
 *   - Creación de programas/módulos nuevos.
 *   - Banco de preguntas (agregar / eliminar, máx. 20 por módulo).
 *   - Inscripción de estudiantes por correo.
 *   - Activar / desactivar la evaluación en tiempo real.
 *   - Consulta de resultados de sus estudiantes.
 * ----------------------------------------------------------------------
 */

APP.teacher = {
    modules: [],
    programs: [],
    currentModuleId: null,
    currentQuestionCount: 0,
};

/* ============================== DASHBOARD ============================== */

async function loadTeacherDashboard() {
    document.getElementById('moduleDetailPanel').classList.add('hidden');
    document.getElementById('teacherModulesPanel').classList.remove('hidden');
    await fetchTeacherModulesData();
}

/** Igual que loadTeacherDashboard pero sin tocar la visibilidad de paneles;
 *  útil para refrescar los conteos de una tarjeta mientras se está en el
 *  detalle de un módulo (evita el parpadeo de cambiar de panel). */
async function fetchTeacherModulesData() {
    const grid = document.getElementById('teacherModulesGrid');
    grid.innerHTML = '<div class="loading-inline"><i class="fa-solid fa-spinner"></i>Cargando tus módulos...</div>';

    const { data, error } = await db
        .from('modulos')
        .select(`
            id, nombre, descripcion, created_at,
            programas ( id, nombre ),
            evaluaciones_activas ( activa ),
            banco_preguntas ( id ),
            inscripciones ( id )
        `)
        .eq('docente_id', APP.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        grid.innerHTML = '';
        showToast(friendlyError(error), 'error');
        return;
    }

    APP.teacher.modules = data || [];
    renderTeacherModules();

    // Refresca también la lista de programas disponibles para el modal "Nuevo módulo".
    const { data: programas } = await db.from('programas').select('id, nombre').order('nombre');
    APP.teacher.programs = programas || [];
    renderProgramaOptions();
}

function renderTeacherModules() {
    const grid = document.getElementById('teacherModulesGrid');
    const empty = document.getElementById('teacherEmptyState');
    const modules = APP.teacher.modules;

    if (!modules.length) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    grid.innerHTML = modules.map(m => {
        const activa = extractActiva(m.evaluaciones_activas);
        const nPreguntas = m.banco_preguntas?.length || 0;
        const nEstudiantes = m.inscripciones?.length || 0;

        return `
            <div class="eval-card ${activa ? '' : 'is-inactive'}">
                <div>
                    <span class="eval-badge ${activa ? 'badge-active' : 'badge-inactive'}">
                        <i class="fa-solid fa-circle"></i> ${activa ? 'Evaluación activa' : 'Inactiva'}
                    </span>
                    <h3 class="eval-title">${escapeHTML(m.nombre)}</h3>
                    <div class="eval-info">
                        <div><i class="fa-solid fa-book"></i> Programa: ${escapeHTML(m.programas?.nombre || '—')}</div>
                        <div><i class="fa-solid fa-list-check"></i> Banco de preguntas: ${nPreguntas}/20</div>
                        <div><i class="fa-solid fa-user-graduate"></i> Estudiantes inscritos: ${nEstudiantes}</div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-primary btn-compact" style="width:100%" onclick="openModuleDetail('${m.id}')">
                        <i class="fa-solid fa-gear"></i> Gestionar módulo
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderProgramaOptions() {
    const select = document.getElementById('programaSelect');
    const currentValue = select.value;
    select.innerHTML = '<option value="">— Crear un programa nuevo —</option>' +
        APP.teacher.programs.map(p => `<option value="${p.id}">${escapeHTML(p.nombre)}</option>`).join('');
    select.value = currentValue || '';
}

/* ============================== NUEVO MÓDULO ============================== */

function initNewModuleModal() {
    document.getElementById('btnNuevoModulo').addEventListener('click', () => openModal('newModuleModal'));
    document.getElementById('btnCloseModal').addEventListener('click', () => closeModal('newModuleModal'));
    document.getElementById('newModuleModal').addEventListener('click', (e) => {
        if (e.target.id === 'newModuleModal') closeModal('newModuleModal');
    });

    document.getElementById('programaSelect').addEventListener('change', (e) => {
        document.getElementById('newProgramGroup').classList.toggle('hidden', !!e.target.value);
    });

    document.getElementById('newModuleForm').addEventListener('submit', handleCreateModule);
}

async function handleCreateModule(event) {
    event.preventDefault();
    const btn = document.getElementById('btnCrearModulo');
    const programaSelect = document.getElementById('programaSelect');
    const programaNuevo = document.getElementById('programaNuevo').value.trim();
    const nombre = document.getElementById('moduloNombre').value.trim();
    const descripcion = document.getElementById('moduloDescripcion').value.trim();

    setButtonLoading(btn, true, 'Creando...');
    try {
        let programaId = programaSelect.value;

        if (!programaId) {
            if (!programaNuevo) throw new Error('Escribe el nombre del nuevo programa o selecciona uno existente.');
            const { data: nuevoPrograma, error: progError } = await db
                .from('programas')
                .insert({ nombre: programaNuevo })
                .select('id')
                .single();
            if (progError) throw progError;
            programaId = nuevoPrograma.id;
        }

        const { data: nuevoModulo, error: modError } = await db
            .from('modulos')
            .insert({
                programa_id: programaId,
                docente_id: APP.user.id,
                nombre,
                descripcion: descripcion || null,
            })
            .select('id')
            .single();
        if (modError) throw modError;

        showToast('Módulo creado con éxito.', 'success');
        document.getElementById('newModuleForm').reset();
        document.getElementById('newProgramGroup').classList.remove('hidden');
        closeModal('newModuleModal');

        await loadTeacherDashboard();
        openModuleDetail(nuevoModulo.id);
    } catch (error) {
        showToast(friendlyError(error), 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

/* ============================== DETALLE DE MÓDULO ============================== */

async function openModuleDetail(moduloId) {
    APP.teacher.currentModuleId = moduloId;

    document.getElementById('teacherModulesPanel').classList.add('hidden');
    document.getElementById('moduleDetailPanel').classList.remove('hidden');

    await Promise.all([
        loadModuleHeader(moduloId),
        loadModuleQuestions(moduloId),
        loadModuleStudents(moduloId),
        loadModuleResults(moduloId),
    ]);
}

function backToModuleList() {
    APP.teacher.currentModuleId = null;
    document.getElementById('moduleDetailPanel').classList.add('hidden');
    document.getElementById('teacherModulesPanel').classList.remove('hidden');
    loadTeacherDashboard();
}

async function loadModuleHeader(moduloId) {
    const { data, error } = await db
        .from('modulos')
        .select('id, nombre, programas ( nombre ), evaluaciones_activas ( activa )')
        .eq('id', moduloId)
        .single();

    if (error) {
        showToast(friendlyError(error), 'error');
        return;
    }

    document.getElementById('detailModuleName').textContent = data.nombre;
    document.getElementById('detailProgramName').textContent = `Programa: ${data.programas?.nombre || '—'}`;

    const activa = extractActiva(data.evaluaciones_activas);
    const toggle = document.getElementById('evalToggle');
    toggle.checked = activa;
    updateToggleLabel(activa);
    syncEvalToggleAvailability();
}

function updateToggleLabel(activa) {
    const label = document.getElementById('toggleLabel');
    label.textContent = activa ? 'ACTIVADA' : 'DESACTIVADA';
    label.classList.toggle('is-active', activa);
    label.classList.toggle('is-inactive', !activa);
}

/** Un módulo necesita al menos 10 preguntas en el banco antes de poder activarse. */
function syncEvalToggleAvailability() {
    const toggle = document.getElementById('evalToggle');
    const puedeActivar = APP.teacher.currentQuestionCount >= 10;
    // Si ya está activa, se permite dejarla así (o desactivarla) aunque bajen las preguntas;
    // solo se bloquea el paso de inactiva -> activa por debajo de 10 preguntas.
    if (!toggle.checked) {
        toggle.disabled = !puedeActivar;
        toggle.title = puedeActivar ? '' : `Necesitas al menos 10 preguntas en el banco (tienes ${APP.teacher.currentQuestionCount}).`;
    } else {
        toggle.disabled = false;
        toggle.title = '';
    }
}

async function handleToggleEvaluation(event) {
    const checkbox = event.target;
    const isActive = checkbox.checked;
    const moduloId = APP.teacher.currentModuleId;

    if (isActive && APP.teacher.currentQuestionCount < 10) {
        checkbox.checked = false;
        showToast(`Necesitas al menos 10 preguntas en el banco para activar la evaluación (tienes ${APP.teacher.currentQuestionCount}).`, 'error', 5500);
        return;
    }

    checkbox.disabled = true;
    try {
        const { error } = await db
            .from('evaluaciones_activas')
            .update({
                activa: isActive,
                activada_en: new Date().toISOString(),
                activada_por: APP.user.id,
            })
            .eq('modulo_id', moduloId);

        if (error) throw error;

        updateToggleLabel(isActive);
        showToast(isActive ? 'Evaluación activada. Los estudiantes ya pueden presentarla.' : 'Evaluación desactivada.', 'success');
        fetchTeacherModulesData(); // refresca el badge en la tarjeta, sin bloquear la UI
    } catch (error) {
        checkbox.checked = !isActive;
        showToast(friendlyError(error), 'error');
    } finally {
        checkbox.disabled = false;
    }
}

/* ------------------------- Banco de preguntas ------------------------- */

async function loadModuleQuestions(moduloId) {
    const list = document.getElementById('questionsList');
    list.innerHTML = '<div class="loading-inline"><i class="fa-solid fa-spinner"></i>Cargando preguntas...</div>';

    const { data, error } = await db
        .from('banco_preguntas')
        .select('*')
        .eq('modulo_id', moduloId)
        .order('created_at', { ascending: true });

    if (error) {
        list.innerHTML = '';
        showToast(friendlyError(error), 'error');
        return;
    }

    renderQuestionsList(data || []);
}

function renderQuestionsList(preguntas) {
    const list = document.getElementById('questionsList');
    const count = preguntas.length;
    APP.teacher.currentQuestionCount = count;

    document.getElementById('tabPreguntasCount').textContent = `${count}/20`;

    const addBtn = document.getElementById('btnAddQuestion');
    addBtn.disabled = count >= 20;
    addBtn.title = count >= 20 ? 'Ya alcanzaste el máximo de 20 preguntas.' : '';

    syncEvalToggleAvailability();

    if (!count) {
        list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clipboard-question"></i><h3>Sin preguntas todavía</h3><p>Agrega preguntas con el formulario de arriba. Necesitas al menos 10 para poder activar la evaluación.</p></div>`;
        return;
    }

    const optionLabel = { A: 'opcion_a', B: 'opcion_b', C: 'opcion_c', D: 'opcion_d' };

    list.innerHTML = preguntas.map((q, i) => `
        <div class="question-item">
            <div class="question-item-header">
                <div>
                    <div class="q-index">Pregunta ${i + 1}</div>
                    <div class="q-text">${escapeHTML(q.pregunta)}</div>
                </div>
                <button class="icon-btn" title="Eliminar pregunta" onclick="handleDeleteQuestion('${q.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="q-options-mini">
                ${['A', 'B', 'C', 'D'].map(letra => `
                    <span class="${q.respuesta_correcta === letra ? 'correct' : ''}">
                        ${letra}. ${escapeHTML(q[optionLabel[letra]])} ${q.respuesta_correcta === letra ? '<i class="fa-solid fa-check"></i>' : ''}
                    </span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

async function handleAddQuestion(event) {
    event.preventDefault();
    const btn = document.getElementById('btnAddQuestion');
    const moduloId = APP.teacher.currentModuleId;

    const payload = {
        modulo_id: moduloId,
        pregunta: document.getElementById('qText').value.trim(),
        opcion_a: document.getElementById('qOptionA').value.trim(),
        opcion_b: document.getElementById('qOptionB').value.trim(),
        opcion_c: document.getElementById('qOptionC').value.trim(),
        opcion_d: document.getElementById('qOptionD').value.trim(),
        respuesta_correcta: document.getElementById('qCorrect').value,
    };

    setButtonLoading(btn, true, 'Guardando...');
    try {
        const { error } = await db.from('banco_preguntas').insert(payload);
        if (error) throw error;

        document.getElementById('questionForm').reset();
        showToast('Pregunta agregada al banco.', 'success', 2500);
        await loadModuleQuestions(moduloId);
        await fetchTeacherModulesData(); // refresca conteo en la tarjeta del módulo (sin cambiar de panel)
    } catch (error) {
        showToast(friendlyError(error), 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleDeleteQuestion(preguntaId) {
    if (!confirm('¿Eliminar esta pregunta del banco? Esta acción no se puede deshacer.')) return;

    try {
        const { error } = await db.from('banco_preguntas').delete().eq('id', preguntaId);
        if (error) throw error;
        showToast('Pregunta eliminada.', 'info', 2500);
        await loadModuleQuestions(APP.teacher.currentModuleId);
        await fetchTeacherModulesData();
    } catch (error) {
        showToast(friendlyError(error), 'error');
    }
}

/* ------------------------- Estudiantes inscritos ------------------------- */

async function loadModuleStudents(moduloId) {
    const list = document.getElementById('studentsList');
    list.innerHTML = '<div class="loading-inline"><i class="fa-solid fa-spinner"></i>Cargando estudiantes...</div>';
    hideCreateStudentInline();

    const { data, error } = await db
        .from('inscripciones')
        .select('id, usuarios ( id, nombres, apellidos, email )')
        .eq('modulo_id', moduloId)
        .order('created_at', { ascending: true });

    if (error) {
        list.innerHTML = '';
        showToast(friendlyError(error), 'error');
        return;
    }

    document.getElementById('tabEstudiantesCount').textContent = (data || []).length;

    if (!data || !data.length) {
        list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-user-plus"></i><h3>Sin estudiantes inscritos</h3><p>Inscribe estudiantes usando su correo institucional en el formulario de arriba.</p></div>`;
        return;
    }

    list.innerHTML = data.map(row => `
        <div class="student-item">
            <div>
                <div class="s-name">${escapeHTML(row.usuarios?.nombres || '')} ${escapeHTML(row.usuarios?.apellidos || '')}</div>
                <div class="s-email">${escapeHTML(row.usuarios?.email || '')}</div>
            </div>
            <button class="icon-btn" title="Quitar del módulo" onclick="handleUnenroll('${row.id}')">
                <i class="fa-solid fa-user-minus"></i>
            </button>
        </div>
    `).join('');
}

async function handleEnrollStudent(event) {
    event.preventDefault();
    const btn = document.getElementById('btnEnroll');
    const email = document.getElementById('enrollEmail').value.trim();
    const moduloId = APP.teacher.currentModuleId;

    setButtonLoading(btn, true, 'Buscando...');
    try {
        const { data: estudiantes, error: buscarError } = await db.rpc('buscar_estudiante_por_email', { p_email: email });
        if (buscarError) throw buscarError;

        if (!estudiantes || !estudiantes.length) {
            // No existe ninguna cuenta con ese correo: ofrecemos crearla en el momento.
            showCreateStudentInline(email);
            return;
        }

        const { error: insertError } = await db
            .from('inscripciones')
            .insert({ estudiante_id: estudiantes[0].id, modulo_id: moduloId });

        if (insertError) {
            if (insertError.message?.toLowerCase().includes('duplicate')) {
                throw new Error('Ese estudiante ya está inscrito en este módulo.');
            }
            throw insertError;
        }

        document.getElementById('enrollForm').reset();
        hideCreateStudentInline();
        showToast('Estudiante inscrito correctamente.', 'success');
        await loadModuleStudents(moduloId);
        await fetchTeacherModulesData();
    } catch (error) {
        showToast(friendlyError(error), 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

/** Muestra el mini-formulario para crear una cuenta de estudiante nueva,
 *  con el correo ya escrito por el docente en el paso anterior. */
function showCreateStudentInline(email) {
    const panel = document.getElementById('createStudentInline');
    document.getElementById('createStudentEmailPreview').textContent = email;
    panel.dataset.email = email;
    panel.classList.remove('hidden');
    document.getElementById('newStudentNombres').focus();
}

function hideCreateStudentInline() {
    const panel = document.getElementById('createStudentInline');
    panel.classList.add('hidden');
    panel.removeAttribute('data-email');
    document.getElementById('createStudentForm').reset();
}

async function handleCreateStudentInline(event) {
    event.preventDefault();
    const btn = document.getElementById('btnCreateStudent');
    const moduloId = APP.teacher.currentModuleId;
    const email = document.getElementById('createStudentInline').dataset.email;

    if (!email) {
        showToast('Vuelve a escribir el correo en el campo de arriba.', 'error');
        return;
    }

    const payload = {
        rol: 'estudiante',
        nombres: document.getElementById('newStudentNombres').value.trim(),
        apellidos: document.getElementById('newStudentApellidos').value.trim(),
        email,
        password: document.getElementById('newStudentPassword').value,
        modulo_id: moduloId,
    };

    setButtonLoading(btn, true, 'Creando...');
    try {
        const { data, error } = await db.functions.invoke('create-user', { body: payload });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        showToast('Estudiante creado e inscrito correctamente.', 'success');
        document.getElementById('enrollForm').reset();
        hideCreateStudentInline();
        await loadModuleStudents(moduloId);
        await fetchTeacherModulesData();
    } catch (error) {
        showToast(friendlyError(error), 'error', 6000);
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleUnenroll(inscripcionId) {
    if (!confirm('¿Quitar a este estudiante del módulo?')) return;
    try {
        const { error } = await db.from('inscripciones').delete().eq('id', inscripcionId);
        if (error) throw error;
        showToast('Estudiante removido del módulo.', 'info', 2500);
        await loadModuleStudents(APP.teacher.currentModuleId);
        await fetchTeacherModulesData();
    } catch (error) {
        showToast(friendlyError(error), 'error');
    }
}

/* ------------------------- Resultados del módulo ------------------------- */

async function loadModuleResults(moduloId) {
    const list = document.getElementById('moduleResultsList');
    list.innerHTML = '<div class="loading-inline"><i class="fa-solid fa-spinner"></i>Cargando resultados...</div>';

    const { data, error } = await db
        .from('resultados')
        .select('id, calificacion, respuestas_correctas, total_preguntas, created_at, usuarios ( nombres, apellidos )')
        .eq('modulo_id', moduloId)
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = '';
        showToast(friendlyError(error), 'error');
        return;
    }

    if (!data || !data.length) {
        list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-chart-simple"></i><h3>Aún no hay resultados</h3><p>Cuando tus estudiantes presenten la evaluación, sus calificaciones aparecerán aquí.</p></div>`;
        return;
    }

    list.innerHTML = data.map(r => `
        <div class="result-item">
            <div class="r-main">
                <strong>${escapeHTML(r.usuarios?.nombres || '')} ${escapeHTML(r.usuarios?.apellidos || '')}</strong>
                <span class="r-meta">${r.respuestas_correctas}/${r.total_preguntas} correctas · ${formatDate(r.created_at)}</span>
            </div>
            <span class="result-score ${scoreClass(r.calificacion)}">${Number(r.calificacion).toFixed(1)}</span>
        </div>
    `).join('');
}

/* ============================== INIT / EVENTOS ============================== */

function initTeacherModule() {
    initNewModuleModal();
    initTabs(document.querySelector('.tabs'));

    document.getElementById('btnBackToModules').addEventListener('click', backToModuleList);
    document.getElementById('evalToggle').addEventListener('change', handleToggleEvaluation);
    document.getElementById('questionForm').addEventListener('submit', handleAddQuestion);
    document.getElementById('enrollForm').addEventListener('submit', handleEnrollStudent);
    document.getElementById('createStudentForm').addEventListener('submit', handleCreateStudentInline);
}
