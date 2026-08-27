/**
 * teacher.js
 * ----------------------------------------------------------------------
 * Panel del docente CEPRODENT 2.0
 *
 * - Gestión de módulos y programas.
 * - Banco de preguntas.
 * - Activación de evaluaciones.
 * - Creación e inscripción de estudiantes.
 * - Consulta de resultados.
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

async function fetchTeacherModulesData() {
    const grid = document.getElementById('teacherModulesGrid');

    grid.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando tus módulos...
        </div>
    `;

    const { data, error } = await db
        .from('modulos')
        .select(`
            id,
            nombre,
            descripcion,
            created_at,
            programas ( id, nombre ),
            evaluaciones_activas ( activa ),
            banco_preguntas ( id ),
            inscripciones ( id )
        `)
        .eq('docente_id', APP.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al cargar módulos:', error);
        grid.innerHTML = '';
        showToast(friendlyError(error), 'error');
        return;
    }

    APP.teacher.modules = data || [];
    renderTeacherModules();

    const { data: programas, error: programasError } = await db
        .from('programas')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');

    if (!programasError) {
        APP.teacher.programs = programas || [];
        renderProgramaOptions();
    }
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
                        <i class="fa-solid fa-circle"></i>
                        ${activa ? 'Evaluación activa' : 'Inactiva'}
                    </span>

                    <h3 class="eval-title">
                        ${escapeHTML(m.nombre)}
                    </h3>

                    <div class="eval-info">
                        <div>
                            <i class="fa-solid fa-book"></i>
                            Programa: ${escapeHTML(m.programas?.nombre || '—')}
                        </div>

                        <div>
                            <i class="fa-solid fa-list-check"></i>
                            Banco de preguntas: ${nPreguntas}/20
                        </div>

                        <div>
                            <i class="fa-solid fa-user-graduate"></i>
                            Estudiantes inscritos: ${nEstudiantes}
                        </div>
                    </div>
                </div>

                <div class="card-actions">
                    <button
                        class="btn-primary btn-compact"
                        style="width:100%"
                        onclick="openModuleDetail('${m.id}')"
                    >
                        <i class="fa-solid fa-gear"></i>
                        Gestionar módulo
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderProgramaOptions() {
    const select = document.getElementById('programaSelect');

    if (!select) return;

    const currentValue = select.value;

    select.innerHTML =
        '<option value="">— Crear un programa nuevo —</option>' +
        APP.teacher.programs.map(p =>
            `<option value="${p.id}">${escapeHTML(p.nombre)}</option>`
        ).join('');

    select.value = currentValue || '';
}

/* ============================== NUEVO MÓDULO ============================== */

function initNewModuleModal() {
    document.getElementById('btnNuevoModulo')
        .addEventListener('click', () => openModal('newModuleModal'));

    document.getElementById('btnCloseModal')
        .addEventListener('click', () => closeModal('newModuleModal'));

    document.getElementById('newModuleModal')
        .addEventListener('click', (e) => {
            if (e.target.id === 'newModuleModal') {
                closeModal('newModuleModal');
            }
        });

    document.getElementById('programaSelect')
        .addEventListener('change', (e) => {
            document.getElementById('newProgramGroup')
                .classList.toggle('hidden', !!e.target.value);
        });

    document.getElementById('newModuleForm')
        .addEventListener('submit', handleCreateModule);
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
            if (!programaNuevo) {
                throw new Error(
                    'Escribe el nombre del nuevo programa o selecciona uno existente.'
                );
            }

            const { data: nuevoPrograma, error: progError } = await db
                .from('programas')
                .insert({
                    nombre: programaNuevo
                })
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
                descripcion: descripcion || null
            })
            .select('id')
            .single();

        if (modError) throw modError;

        showToast('Módulo creado con éxito.', 'success');

        document.getElementById('newModuleForm').reset();
        document.getElementById('newProgramGroup')
            .classList.remove('hidden');

        closeModal('newModuleModal');

        await loadTeacherDashboard();
        await openModuleDetail(nuevoModulo.id);

    } catch (error) {
        console.error('Error al crear módulo:', error);
        showToast(friendlyError(error), 'error');

    } finally {
        setButtonLoading(btn, false);
    }
}

/* ============================== DETALLE DEL MÓDULO ============================== */

async function openModuleDetail(moduloId) {
    APP.teacher.currentModuleId = moduloId;

    activateTeacherTab('preguntas');

    document.getElementById('teacherModulesPanel')
        .classList.add('hidden');

    document.getElementById('moduleDetailPanel')
        .classList.remove('hidden');

    await Promise.all([
        loadModuleHeader(moduloId),
        loadModuleQuestions(moduloId),
        loadModuleStudents(moduloId),
        loadModuleResults(moduloId)
    ]);
}

function backToModuleList() {
    APP.teacher.currentModuleId = null;

    document.getElementById('moduleDetailPanel')
        .classList.add('hidden');

    document.getElementById('teacherModulesPanel')
        .classList.remove('hidden');

    loadTeacherDashboard();
}

async function loadModuleHeader(moduloId) {
    const { data, error } = await db
        .from('modulos')
        .select(`
            id,
            nombre,
            programas ( nombre ),
            evaluaciones_activas ( activa )
        `)
        .eq('id', moduloId)
        .single();

    if (error) {
        showToast(friendlyError(error), 'error');
        return;
    }

    document.getElementById('detailModuleName').textContent = data.nombre;

    document.getElementById('detailProgramName').textContent =
        `Programa: ${data.programas?.nombre || '—'}`;

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

function syncEvalToggleAvailability() {
    const toggle = document.getElementById('evalToggle');
    const puedeActivar = APP.teacher.currentQuestionCount >= 10;

    if (!toggle.checked) {
        toggle.disabled = !puedeActivar;

        toggle.title = puedeActivar
            ? ''
            : `Necesitas al menos 10 preguntas en el banco (tienes ${APP.teacher.currentQuestionCount}).`;

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

        showToast(
            `Necesitas al menos 10 preguntas en el banco para activar la evaluación (tienes ${APP.teacher.currentQuestionCount}).`,
            'error',
            5500
        );

        return;
    }

    checkbox.disabled = true;

    try {
        const { error } = await db
            .from('evaluaciones_activas')
            .update({
                activa: isActive,
                activada_en: new Date().toISOString(),
                activada_por: APP.user.id
            })
            .eq('modulo_id', moduloId);

        if (error) throw error;

        updateToggleLabel(isActive);

        showToast(
            isActive
                ? 'Evaluación activada. Los estudiantes ya pueden presentarla.'
                : 'Evaluación desactivada.',
            'success'
        );

        fetchTeacherModulesData();

    } catch (error) {
        checkbox.checked = !isActive;
        showToast(friendlyError(error), 'error');

    } finally {
        checkbox.disabled = false;
    }
}

/* ============================== BANCO DE PREGUNTAS ============================== */

async function loadModuleQuestions(moduloId) {
    const list = document.getElementById('questionsList');

    list.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando preguntas...
        </div>
    `;

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

    document.getElementById('tabPreguntasCount').textContent =
        `${count}/20`;

    const addBtn = document.getElementById('btnAddQuestion');

    addBtn.disabled = count >= 20;
    addBtn.title = count >= 20
        ? 'Ya alcanzaste el máximo de 20 preguntas.'
        : '';

    syncEvalToggleAvailability();

    if (!count) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-clipboard-question"></i>
                <h3>Sin preguntas todavía</h3>
                <p>
                    Agrega preguntas con el formulario de arriba.
                    Necesitas al menos 10 para poder activar la evaluación.
                </p>
            </div>
        `;
        return;
    }

    const optionLabel = {
        A: 'opcion_a',
        B: 'opcion_b',
        C: 'opcion_c',
        D: 'opcion_d'
    };

    list.innerHTML = preguntas.map((q, i) => `
        <div class="question-item">
            <div class="question-item-header">
                <div>
                    <div class="q-index">
                        Pregunta ${i + 1}
                    </div>

                    <div class="q-text">
                        ${escapeHTML(q.pregunta)}
                    </div>
                </div>

                <button
                    class="icon-btn"
                    title="Eliminar pregunta"
                    onclick="handleDeleteQuestion('${q.id}')"
                >
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>

            <div class="q-options-mini">
                ${['A', 'B', 'C', 'D'].map(letra => `
                    <span class="${q.respuesta_correcta === letra ? 'correct' : ''}">
                        ${letra}. ${escapeHTML(q[optionLabel[letra]])}
                        ${q.respuesta_correcta === letra
                            ? '<i class="fa-solid fa-check"></i>'
                            : ''
                        }
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
        respuesta_correcta: document.getElementById('qCorrect').value
    };

    setButtonLoading(btn, true, 'Guardando...');

    try {
        const { error } = await db
            .from('banco_preguntas')
            .insert(payload);

        if (error) throw error;

        document.getElementById('questionForm').reset();

        showToast(
            'Pregunta agregada al banco.',
            'success',
            2500
        );

        await loadModuleQuestions(moduloId);
        await fetchTeacherModulesData();

    } catch (error) {
        showToast(friendlyError(error), 'error');

    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleDeleteQuestion(preguntaId) {
    if (!confirm('¿Eliminar esta pregunta del banco? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        const { error } = await db
            .from('banco_preguntas')
            .delete()
            .eq('id', preguntaId);

        if (error) throw error;

        showToast('Pregunta eliminada.', 'info', 2500);

        await loadModuleQuestions(APP.teacher.currentModuleId);
        await fetchTeacherModulesData();

    } catch (error) {
        showToast(friendlyError(error), 'error');
    }
}

/* ============================== ESTUDIANTES ============================== */

async function loadModuleStudents(moduloId) {
    const list = document.getElementById('studentsList');

    list.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando estudiantes...
        </div>
    `;

    hideCreateStudentInline();

    try {
        const { data: inscripciones, error: inscripcionesError } = await db
            .from('inscripciones')
            .select('id, estudiante_id')
            .eq('modulo_id', moduloId)
            .order('created_at', { ascending: true });

        if (inscripcionesError) throw inscripcionesError;

        const total = (inscripciones || []).length;

        document.getElementById('tabEstudiantesCount').textContent = total;

        if (!total) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-user-plus"></i>
                    <h3>Sin estudiantes inscritos</h3>
                    <p>
                        Puedes inscribir un estudiante existente o crear
                        uno nuevo desde este módulo.
                    </p>
                </div>
            `;
            return;
        }

        const estudianteIds = inscripciones.map(
            inscripcion => inscripcion.estudiante_id
        );

        const { data: estudiantes, error: estudiantesError } = await db
            .from('usuarios')
            .select('id, nombres, apellidos, email, activo')
            .in('id', estudianteIds);

        if (estudiantesError) throw estudiantesError;

        const estudiantesPorId = {};

        (estudiantes || []).forEach(estudiante => {
            estudiantesPorId[estudiante.id] = estudiante;
        });

        list.innerHTML = inscripciones.map(inscripcion => {
            const estudiante =
                estudiantesPorId[inscripcion.estudiante_id];

            if (!estudiante) {
                return `
                    <div class="student-item">
                        <div>
                            <div class="s-name">
                                Estudiante no disponible
                            </div>
                            <div class="s-email">
                                No fue posible cargar su información.
                            </div>
                        </div>

                        <button
                            class="icon-btn"
                            title="Quitar del módulo"
                            onclick="handleUnenroll('${inscripcion.id}')"
                        >
                            <i class="fa-solid fa-user-minus"></i>
                        </button>
                    </div>
                `;
            }

            const estado = estudiante.activo
                ? ''
                : ' <span class="badge-inactive">Inactivo</span>';

            return `
                <div class="student-item">
                    <div>
                        <div class="s-name">
                            ${escapeHTML(estudiante.nombres || '')}
                            ${escapeHTML(estudiante.apellidos || '')}
                            ${estado}
                        </div>

                        <div class="s-email">
                            ${escapeHTML(estudiante.email || '')}
                        </div>
                    </div>

                    <button
                        class="icon-btn"
                        title="Quitar del módulo"
                        onclick="handleUnenroll('${inscripcion.id}')"
                    >
                        <i class="fa-solid fa-user-minus"></i>
                    </button>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error(
            'Error al cargar estudiantes del módulo:',
            error
        );

        list.innerHTML = '';
        showToast(friendlyError(error), 'error');
    }
}

/**
 * Obtiene y valida el programa del módulo actual.
 * El docente no selecciona manualmente el programa.
 */
async function getCurrentModuleProgramId(moduloId) {
    const { data, error } = await db
        .from('modulos')
        .select('id, programa_id, docente_id, activo')
        .eq('id', moduloId)
        .single();

    if (error) throw error;

    if (!data) {
        throw new Error('No fue posible encontrar el módulo.');
    }

    if (data.activo === false) {
        throw new Error('El módulo seleccionado está inactivo.');
    }

    if (data.docente_id !== APP.user.id) {
        throw new Error(
            'No tienes permisos para gestionar estudiantes en este módulo.'
        );
    }

    if (!data.programa_id) {
        throw new Error(
            'El módulo no tiene un programa asociado.'
        );
    }

    return data.programa_id;
}

/* ------------------------- Inscribir existente ------------------------- */

async function handleEnrollStudent(event) {
    event.preventDefault();

    const btn = document.getElementById('btnEnroll');
    const email = document.getElementById('enrollEmail').value.trim();
    const moduloId = APP.teacher.currentModuleId;

    if (!email) {
        showToast('Escribe el correo del estudiante.', 'error');
        return;
    }

    setButtonLoading(btn, true, 'Buscando...');

    try {
        // Verificamos que el docente esté trabajando sobre uno de sus módulos.
        const programaId =
            await getCurrentModuleProgramId(moduloId);

        const { data: estudiantes, error: buscarError } = await db
            .rpc('buscar_estudiante_por_email', {
                p_email: email
            });

        if (buscarError) throw buscarError;

        // El estudiante no existe: mostramos el formulario de creación.
        if (!estudiantes || !estudiantes.length) {
            showCreateStudentInline(email);
            return;
        }

        const estudiante = estudiantes[0];

        // Verificar que el estudiante pertenece al mismo programa del módulo.
        const { data: perfilEstudiante, error: perfilError } = await db
            .from('estudiantes')
            .select('usuario_id, programa_id, activo')
            .eq('usuario_id', estudiante.id)
            .single();

        if (perfilError) throw perfilError;

        if (!perfilEstudiante) {
            throw new Error(
                'El usuario encontrado no tiene un perfil de estudiante.'
            );
        }

        if (perfilEstudiante.activo === false) {
            throw new Error(
                'Este estudiante se encuentra inactivo.'
            );
        }

        if (perfilEstudiante.programa_id !== programaId) {
            throw new Error(
                'El estudiante pertenece a un programa diferente y no puede ser inscrito en este módulo.'
            );
        }

        const { error: insertError } = await db
            .from('inscripciones')
            .insert({
                estudiante_id: estudiante.id,
                modulo_id: moduloId
            });

        if (insertError) {
            if (
                insertError.message?.toLowerCase().includes('duplicate') ||
                insertError.code === '23505'
            ) {
                throw new Error(
                    'Ese estudiante ya está inscrito en este módulo.'
                );
            }

            throw insertError;
        }

        document.getElementById('enrollForm').reset();
        hideCreateStudentInline();

        showToast(
            'Estudiante inscrito correctamente.',
            'success'
        );

        await loadModuleStudents(moduloId);
        await fetchTeacherModulesData();

    } catch (error) {
        console.error('Error al inscribir estudiante:', error);

        showToast(
            friendlyError(error),
            'error',
            6000
        );

    } finally {
        setButtonLoading(btn, false);
    }
}

/* ------------------------- Crear estudiante ------------------------- */

function showCreateStudentInline(email) {
    const panel = document.getElementById('createStudentInline');

    document.getElementById('createStudentEmailPreview').textContent =
        email;

    panel.dataset.email = email;

    panel.classList.remove('hidden');

    document.getElementById('newStudentNombres').focus();
}

function hideCreateStudentInline() {
    const panel = document.getElementById('createStudentInline');

    if (!panel) return;

    panel.classList.add('hidden');
    panel.removeAttribute('data-email');

    const form = document.getElementById('createStudentForm');

    if (form) {
        form.reset();
    }
}

async function handleCreateStudentInline(event) {
    event.preventDefault();

    const btn = document.getElementById('btnCreateStudent');
    const moduloId = APP.teacher.currentModuleId;

    const panel = document.getElementById('createStudentInline');

    const email = panel.dataset.email;

    if (!email) {
        showToast(
            'Vuelve a escribir el correo del estudiante.',
            'error'
        );
        return;
    }

    setButtonLoading(btn, true, 'Creando...');

    try {
        // El programa se obtiene automáticamente del módulo actual.
        const programaId =
            await getCurrentModuleProgramId(moduloId);

        const payload = {
            rol: 'estudiante',

            nombres:
                document.getElementById('newStudentNombres')
                    .value.trim(),

            apellidos:
                document.getElementById('newStudentApellidos')
                    .value.trim(),

            email,

            password:
                document.getElementById('newStudentPassword')
                    .value,

            // Datos CEPRODENT 2.0
            programa_id: programaId,
            modulo_id: moduloId
        };

        const { data, error } = await db.functions.invoke(
            'create-user',
            {
                body: payload
            }
        );

        if (error) {
            console.error(
                'Error de la Edge Function:',
                error
            );

            throw error;
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        showToast(
            'Estudiante creado e inscrito correctamente.',
            'success'
        );

        document.getElementById('enrollForm').reset();
        hideCreateStudentInline();

        await loadModuleStudents(moduloId);
        await fetchTeacherModulesData();

    } catch (error) {
        console.error(
            'Error al crear estudiante:',
            error
        );

        showToast(
            friendlyError(error),
            'error',
            7000
        );

    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleUnenroll(inscripcionId) {
    if (!confirm('¿Quitar a este estudiante del módulo?')) {
        return;
    }

    try {
        const { error } = await db
            .from('inscripciones')
            .delete()
            .eq('id', inscripcionId);

        if (error) throw error;

        showToast(
            'Estudiante removido del módulo.',
            'info',
            2500
        );

        await loadModuleStudents(APP.teacher.currentModuleId);
        await fetchTeacherModulesData();

    } catch (error) {
        showToast(friendlyError(error), 'error');
    }
}

/* ============================== RESULTADOS ============================== */

async function loadModuleResults(moduloId) {
    const list = document.getElementById('moduleResultsList');

    list.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando resultados...
        </div>
    `;

    const { data, error } = await db
        .from('resultados')
        .select(`
            id,
            calificacion,
            respuestas_correctas,
            total_preguntas,
            created_at,
            usuarios ( nombres, apellidos )
        `)
        .eq('modulo_id', moduloId)
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = '';
        showToast(friendlyError(error), 'error');
        return;
    }

    if (!data || !data.length) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-chart-simple"></i>
                <h3>Aún no hay resultados</h3>
                <p>
                    Cuando tus estudiantes presenten la evaluación,
                    sus calificaciones aparecerán aquí.
                </p>
            </div>
        `;
        return;
    }

    list.innerHTML = data.map(r => `
        <div class="result-item">
            <div class="r-main">
                <strong>
                    ${escapeHTML(r.usuarios?.nombres || '')}
                    ${escapeHTML(r.usuarios?.apellidos || '')}
                </strong>

                <span class="r-meta">
                    ${r.respuestas_correctas}/${r.total_preguntas}
                    correctas · ${formatDate(r.created_at)}
                </span>
            </div>

            <span class="result-score ${scoreClass(r.calificacion)}">
                ${Number(r.calificacion).toFixed(1)}
            </span>
        </div>
    `).join('');
}

/* ============================== PESTAÑAS DEL DOCENTE ============================== */

function activateTeacherTab(tabName) {
    const tabsContainer = document.querySelector('#moduleDetailPanel .tabs');

    if (!tabsContainer) return;

    // Actualizar botones
    tabsContainer.querySelectorAll('.tab-btn').forEach(button => {
        button.classList.toggle(
            'active',
            button.dataset.tab === tabName
        );
    });

    // Ocultar todos los paneles
    const panels = {
        preguntas: document.getElementById('tabPanelPreguntas'),
        estudiantes: document.getElementById('tabPanelEstudiantes'),
        resultados: document.getElementById('tabPanelResultados')
    };

    Object.entries(panels).forEach(([name, panel]) => {
        if (!panel) return;

        panel.classList.toggle('hidden', name !== tabName);
    });
}

function initTeacherTabs() {
    const tabsContainer = document.querySelector('#moduleDetailPanel .tabs');

    if (!tabsContainer) return;

    // Evita registrar los eventos más de una vez.
    if (tabsContainer.dataset.initialized === 'true') return;

    tabsContainer.dataset.initialized = 'true';

    tabsContainer.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;

            activateTeacherTab(tabName);
        });
    });
}



/* ============================== INIT / EVENTOS ============================== */

/* ============================== INIT / EVENTOS ============================== */

function initTeacherModule() {
    initNewModuleModal();
    initTeacherTabs();

    document.getElementById('btnBackToModules')
        .addEventListener('click', backToModuleList);

    document.getElementById('evalToggle')
        .addEventListener('change', handleToggleEvaluation);

    document.getElementById('questionForm')
        .addEventListener('submit', handleAddQuestion);

    document.getElementById('enrollForm')
        .addEventListener('submit', handleEnrollStudent);

    document.getElementById('createStudentForm')
        .addEventListener('submit', handleCreateStudentInline);
}