/**
 * student.js
 * ----------------------------------------------------------------------
 * Panel del estudiante:
 *   - Lista los módulos en los que está inscrito y si su evaluación
 *     está activa en este momento (con actualización en tiempo real
 *     vía Supabase Realtime cuando el docente cambia el switch).
 *   - Muestra el historial de calificaciones ya obtenidas.
 * ----------------------------------------------------------------------
 */

APP.student = {
    modules: [],
    resultsByModule: {},
    realtimeChannel: null,
};

async function loadStudentDashboard() {
    const grid = document.getElementById('studentModulesGrid');
    grid.innerHTML = '<div class="loading-inline"><i class="fa-solid fa-spinner"></i>Cargando tus módulos...</div>';

    const [{ data: inscripciones, error: errInsc }, { data: resultados, error: errRes }] = await Promise.all([
        db.from('inscripciones')
            .select(`
                id,
                modulos (
                    id, nombre,
                    programas ( nombre ),
                    evaluaciones_activas ( activa ),
                    docente:usuarios ( nombres, apellidos )
                )
            `)
            .eq('estudiante_id', APP.user.id),
        db.from('resultados')
            .select('id, modulo_id, calificacion, respuestas_correctas, total_preguntas, created_at, modulos ( nombre )')
            .eq('estudiante_id', APP.user.id)
            .order('created_at', { ascending: false }),
    ]);

    if (errInsc) {
        grid.innerHTML = '';
        showToast(friendlyError(errInsc), 'error');
        return;
    }

    APP.student.modules = (inscripciones || []).map(row => row.modulos).filter(Boolean);

    // Último resultado por módulo, para saber si ya la presentó.
    APP.student.resultsByModule = {};
    (resultados || []).forEach(r => {
        if (!APP.student.resultsByModule[r.modulo_id]) {
            APP.student.resultsByModule[r.modulo_id] = r;
        }
    });

    renderStudentModules();
    renderStudentResults(resultados || [], errRes);
    subscribeToEvaluationChanges();
}

function renderStudentModules() {
    const grid = document.getElementById('studentModulesGrid');
    const empty = document.getElementById('studentEmptyState');
    const modules = APP.student.modules;

    if (!modules.length) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    grid.innerHTML = modules.map(m => {
        const activa = extractActiva(m.evaluaciones_activas);
        const yaPresentada = APP.student.resultsByModule[m.id];
        const docenteNombre = m.docente ? `${m.docente.nombres} ${m.docente.apellidos}` : '—';

        let boton;
        if (yaPresentada) {
            boton = `<button class="btn-secondary" style="width:100%" disabled>
                        <i class="fa-solid fa-circle-check"></i> Ya presentada · Nota ${Number(yaPresentada.calificacion).toFixed(1)}
                     </button>`;
        } else if (activa) {
            boton = `<button class="btn-primary" onclick="startQuiz('${m.id}', '${escapeHTML(m.nombre).replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-pen-to-square"></i> Presentar evaluación
                     </button>`;
        } else {
            boton = `<button class="btn-secondary" style="width:100%" disabled>No disponible</button>`;
        }

        return `
            <div class="eval-card ${activa ? '' : 'is-inactive'}">
                <div>
                    <span class="eval-badge ${activa ? 'badge-active' : 'badge-inactive'}">
                        <i class="fa-solid ${activa ? 'fa-circle' : 'fa-lock'}"></i> ${activa ? 'Evaluación activa' : 'No disponible'}
                    </span>
                    <h3 class="eval-title">${escapeHTML(m.nombre)}</h3>
                    <div class="eval-info">
                        <div><i class="fa-solid fa-book"></i> Programa: ${escapeHTML(m.programas?.nombre || '—')}</div>
                        <div><i class="fa-solid fa-user-tie"></i> Docente: ${escapeHTML(docenteNombre)}</div>
                        <div><i class="fa-solid fa-clock"></i> 10 preguntas aleatorias · 15 min</div>
                    </div>
                </div>
                ${boton}
            </div>
        `;
    }).join('');
}

function renderStudentResults(resultados, error) {
    const list = document.getElementById('studentResultsList');

    if (error) {
        list.innerHTML = `<p class="text-muted">No fue posible cargar tu historial.</p>`;
        return;
    }

    if (!resultados.length) {
        list.innerHTML = `<p class="text-muted">Aún no has presentado ninguna evaluación.</p>`;
        return;
    }

    list.innerHTML = resultados.map(r => `
        <div class="result-item">
            <div class="r-main">
                <strong>${escapeHTML(r.modulos?.nombre || 'Módulo')}</strong>
                <span class="r-meta">${r.respuestas_correctas}/${r.total_preguntas} correctas · ${formatDate(r.created_at)}</span>
            </div>
            <span class="result-score ${scoreClass(r.calificacion)}">${Number(r.calificacion).toFixed(1)}</span>
        </div>
    `).join('');
}

/** Escucha cambios en vivo de evaluaciones_activas para refrescar el dashboard
 *  automáticamente cuando el docente activa/desactiva una evaluación. */
function subscribeToEvaluationChanges() {
    if (APP.student.realtimeChannel) {
        db.removeChannel(APP.student.realtimeChannel);
        APP.student.realtimeChannel = null;
    }

    const moduleIds = new Set(APP.student.modules.map(m => m.id));
    if (!moduleIds.size) return;

    APP.student.realtimeChannel = db
        .channel('evaluaciones-activas-estudiante')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluaciones_activas' }, (payload) => {
            const moduloId = payload.new?.modulo_id || payload.old?.modulo_id;
            if (moduloId && moduleIds.has(moduloId)) {
                loadStudentDashboard();
            }
        })
        .subscribe();
}

function initStudentModule() {
    document.getElementById('btnRefreshStudent').addEventListener('click', loadStudentDashboard);
}
