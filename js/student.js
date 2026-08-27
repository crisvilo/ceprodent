/**
 * student.js
 * ----------------------------------------------------------------------
 * Panel del estudiante - CEPRODENT 2.0
 *
 * - Muestra únicamente los módulos donde el estudiante está inscrito.
 * - Muestra el programa y docente responsable.
 * - Permite presentar evaluaciones activas.
 * - Muestra el historial de calificaciones.
 * - Se actualiza cuando el docente activa o desactiva una evaluación.
 * ----------------------------------------------------------------------
 */

APP.student = {
    modules: [],
    resultsByModule: {},
    realtimeChannel: null
};

/* ============================== DASHBOARD ============================== */

async function loadStudentDashboard() {
    const grid = document.getElementById('studentModulesGrid');
    const empty = document.getElementById('studentEmptyState');

    grid.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando tus módulos...
        </div>
    `;

    if (empty) {
        empty.classList.add('hidden');
    }

    try {
        /*
         * Primero obtenemos las inscripciones del estudiante.
         * Se hace una consulta separada para evitar problemas con
         * relaciones anidadas después de la migración a CEPRODENT 2.0.
         */
        const { data: inscripciones, error: errInsc } = await db
            .from('inscripciones')
            .select('id, estudiante_id, modulo_id')
            .eq('estudiante_id', APP.user.id);

        if (errInsc) throw errInsc;

        if (!inscripciones || inscripciones.length === 0) {
            APP.student.modules = [];
            APP.student.resultsByModule = {};

            grid.innerHTML = '';

            if (empty) {
                empty.classList.remove('hidden');
            }

            renderStudentResults([]);
            unsubscribeStudentRealtime();
            return;
        }

        const moduleIds = inscripciones.map(
            inscripcion => inscripcion.modulo_id
        );

        /*
         * Obtenemos los módulos directamente.
         * Esto evita depender de una relación antigua o ambigua.
         */
        const { data: modules, error: errModules } = await db
            .from('modulos')
            .select(`
                id,
                nombre,
                descripcion,
                programa_id,
                docente_id,
                activo,
                programas (
                    id,
                    nombre
                )
            `)
            .in('id', moduleIds);

        if (errModules) throw errModules;

        /*
         * Cargar los docentes responsables.
         */
        const docenteIds = [
            ...new Set(
                (modules || [])
                    .map(modulo => modulo.docente_id)
                    .filter(Boolean)
            )
        ];

        let docentesPorId = {};

        if (docenteIds.length > 0) {
            const { data: docentes, error: errDocentes } = await db
                .from('usuarios')
                .select('id, nombres, apellidos')
                .in('id', docenteIds);

            if (errDocentes) throw errDocentes;

            (docentes || []).forEach(docente => {
                docentesPorId[docente.id] = docente;
            });
        }

        /*
         * Cargar el estado de las evaluaciones.
         */
        const { data: evaluaciones, error: errEvaluaciones } = await db
            .from('evaluaciones_activas')
            .select('modulo_id, activa')
            .in('modulo_id', moduleIds);

        if (errEvaluaciones) throw errEvaluaciones;

        const evaluacionesPorModulo = {};

        (evaluaciones || []).forEach(evaluacion => {
            evaluacionesPorModulo[evaluacion.modulo_id] =
                evaluacion.activa === true;
        });

        /*
         * Construir los módulos que verá el estudiante.
         * Los módulos inactivos no se muestran.
         */
        APP.student.modules = (modules || [])
            .filter(modulo => modulo.activo !== false)
            .map(modulo => ({
                ...modulo,

                docente: docentesPorId[modulo.docente_id] || null,

                evaluaciones_activas: {
                    activa:
                        evaluacionesPorModulo[modulo.id] === true
                }
            }));

        /*
         * Obtener resultados del estudiante.
         */
        const { data: resultados, error: errRes } = await db
            .from('resultados')
            .select(`
                id,
                modulo_id,
                calificacion,
                respuestas_correctas,
                total_preguntas,
                created_at
            `)
            .eq('estudiante_id', APP.user.id)
            .order('created_at', { ascending: false });

        if (errRes) {
            console.error('Error al cargar resultados:', errRes);
        }

        /*
         * Guardar solamente el último resultado de cada módulo.
         */
        APP.student.resultsByModule = {};

        (resultados || []).forEach(resultado => {
            if (!APP.student.resultsByModule[resultado.modulo_id]) {
                APP.student.resultsByModule[resultado.modulo_id] =
                    resultado;
            }
        });

        renderStudentModules();
        renderStudentResults(resultados || [], errRes);

        subscribeToEvaluationChanges();

    } catch (error) {
        console.error(
            'Error al cargar el dashboard del estudiante:',
            error
        );

        grid.innerHTML = '';

        if (empty) {
            empty.classList.remove('hidden');
        }

        showToast(
            friendlyError(error),
            'error',
            6000
        );
    }
}

/* ============================== MÓDULOS ============================== */

function renderStudentModules() {
    const grid = document.getElementById('studentModulesGrid');
    const empty = document.getElementById('studentEmptyState');
    const modules = APP.student.modules || [];

    if (!modules.length) {
        grid.innerHTML = '';

        if (empty) {
            empty.classList.remove('hidden');
        }

        return;
    }

    if (empty) {
        empty.classList.add('hidden');
    }

    grid.innerHTML = modules.map(modulo => {
        const activa =
            modulo.evaluaciones_activas?.activa === true;

        const resultado =
            APP.student.resultsByModule[modulo.id];

        const docenteNombre = modulo.docente
            ? `${modulo.docente.nombres || ''} ${modulo.docente.apellidos || ''}`.trim()
            : '—';

        let boton = '';

        if (resultado) {
            boton = `
                <button
                    class="btn-secondary"
                    style="width:100%"
                    disabled
                >
                    <i class="fa-solid fa-circle-check"></i>
                    Ya presentada · Nota ${Number(
                        resultado.calificacion
                    ).toFixed(1)}
                </button>
            `;

        } else if (activa) {
            boton = `
                <button
                    class="btn-primary"
                    style="width:100%"
                    onclick="startQuiz(
                        '${modulo.id}',
                        '${escapeHTML(modulo.nombre).replace(/'/g, "\\'")}'
                    )"
                >
                    <i class="fa-solid fa-pen-to-square"></i>
                    Presentar evaluación
                </button>
            `;

        } else {
            boton = `
                <button
                    class="btn-secondary"
                    style="width:100%"
                    disabled
                >
                    <i class="fa-solid fa-lock"></i>
                    Evaluación no disponible
                </button>
            `;
        }

        return `
            <div class="eval-card ${activa ? '' : 'is-inactive'}">
                <div>
                    <span class="eval-badge ${
                        activa
                            ? 'badge-active'
                            : 'badge-inactive'
                    }">
                        <i class="fa-solid ${
                            activa
                                ? 'fa-circle'
                                : 'fa-lock'
                        }"></i>
                        ${
                            activa
                                ? 'Evaluación activa'
                                : 'No disponible'
                        }
                    </span>

                    <h3 class="eval-title">
                        ${escapeHTML(modulo.nombre || 'Módulo')}
                    </h3>

                    <div class="eval-info">
                        <div>
                            <i class="fa-solid fa-book"></i>
                            Programa:
                            ${escapeHTML(
                                modulo.programas?.nombre || '—'
                            )}
                        </div>

                        <div>
                            <i class="fa-solid fa-user-tie"></i>
                            Docente:
                            ${escapeHTML(docenteNombre)}
                        </div>

                        <div>
                            <i class="fa-solid fa-clock"></i>
                            10 preguntas aleatorias · 15 min
                        </div>
                    </div>
                </div>

                ${boton}
            </div>
        `;
    }).join('');
}

/* ============================== RESULTADOS ============================== */

function renderStudentResults(resultados, error) {
    const list = document.getElementById('studentResultsList');

    if (!list) return;

    if (error) {
        list.innerHTML = `
            <p class="text-muted">
                No fue posible cargar tu historial de calificaciones.
            </p>
        `;
        return;
    }

    if (!resultados || resultados.length === 0) {
        list.innerHTML = `
            <p class="text-muted">
                Aún no has presentado ninguna evaluación.
            </p>
        `;
        return;
    }

    const modulesPorId = {};

    (APP.student.modules || []).forEach(modulo => {
        modulesPorId[modulo.id] = modulo;
    });

    list.innerHTML = resultados.map(resultado => {
        const modulo =
            modulesPorId[resultado.modulo_id];

        return `
            <div class="result-item">
                <div class="r-main">
                    <strong>
                        ${escapeHTML(
                            modulo?.nombre || 'Módulo'
                        )}
                    </strong>

                    <span class="r-meta">
                        ${resultado.respuestas_correctas || 0}/${
                            resultado.total_preguntas || 0
                        } correctas ·
                        ${formatDate(resultado.created_at)}
                    </span>
                </div>

                <span class="result-score ${
                    scoreClass(resultado.calificacion)
                }">
                    ${Number(resultado.calificacion).toFixed(1)}
                </span>
            </div>
        `;
    }).join('');
}

/* ============================== TIEMPO REAL ============================== */

function unsubscribeStudentRealtime() {
    if (APP.student.realtimeChannel) {
        db.removeChannel(APP.student.realtimeChannel);
        APP.student.realtimeChannel = null;
    }
}

/**
 * Escucha cambios de las evaluaciones activas para actualizar
 * automáticamente el estado de los módulos del estudiante.
 */
function subscribeToEvaluationChanges() {
    unsubscribeStudentRealtime();

    const moduleIds = new Set(
        (APP.student.modules || []).map(
            modulo => modulo.id
        )
    );

    if (!moduleIds.size) return;

    APP.student.realtimeChannel = db
        .channel(
            `evaluaciones-estudiante-${APP.user.id}`
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'evaluaciones_activas'
            },
            payload => {
                const moduloId =
                    payload.new?.modulo_id ||
                    payload.old?.modulo_id;

                if (
                    moduloId &&
                    moduleIds.has(moduloId)
                ) {
                    loadStudentDashboard();
                }
            }
        )
        .subscribe();
}

/* ============================== INICIALIZACIÓN ============================== */

function initStudentModule() {
    const refreshButton =
        document.getElementById('btnRefreshStudent');

    if (refreshButton) {
        refreshButton.addEventListener(
            'click',
            loadStudentDashboard
        );
    }
}