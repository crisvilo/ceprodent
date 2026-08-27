/**
 * admin.js
 * ----------------------------------------------------------------------
 * Panel del administrador:
 *   - Crear cuentas de docentes y estudiantes (vía la Edge Function
 *     "create-user", que es quien realmente crea el usuario en Supabase
 *     Auth usando la service role key en el servidor, nunca en el navegador).
 *   - Listar los docentes y estudiantes ya registrados.
 * ----------------------------------------------------------------------
 */

APP.admin = {
    docentes: [],
    estudiantes: [],
};

async function loadAdminDashboard() {
    await Promise.all([
        loadAdminUsersList('docente'),
        loadAdminUsersList('estudiante'),
    ]);
}

async function loadAdminUsersList(rol) {
    const containerId = rol === 'docente' ? 'adminDocentesList' : 'adminEstudiantesList';
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="loading-inline"><i class="fa-solid fa-spinner"></i>Cargando...</div>';

    const { data, error } = await db
        .from('usuarios')
        .select('id, nombres, apellidos, email, created_at')
        .eq('rol', rol)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = '';
        showToast(friendlyError(error), 'error');
        return;
    }

    if (rol === 'docente') APP.admin.docentes = data || [];
    else APP.admin.estudiantes = data || [];

    renderAdminUsersList(containerId, data || [], rol);
}

function renderAdminUsersList(containerId, users, rol) {
    const container = document.getElementById(containerId);

    if (!users.length) {
        const etiqueta = rol === 'docente' ? 'docentes' : 'estudiantes';
        container.innerHTML = `<p class="text-muted">Aún no hay ${etiqueta} registrados.</p>`;
        return;
    }

    container.innerHTML = users.map(u => `
        <div class="student-item">
            <div>
                <div class="s-name">${escapeHTML(u.nombres)} ${escapeHTML(u.apellidos)}</div>
                <div class="s-email">${escapeHTML(u.email)}</div>
            </div>
            <span class="text-muted" style="font-size:0.75rem;">${formatDate(u.created_at)}</span>
        </div>
    `).join('');
}

async function handleCreateUserAdmin(event) {
    event.preventDefault();
    const btn = document.getElementById('btnCrearUsuarioAdmin');

    const payload = {
        rol: document.getElementById('adminNewRol').value,
        nombres: document.getElementById('adminNewNombres').value.trim(),
        apellidos: document.getElementById('adminNewApellidos').value.trim(),
        email: document.getElementById('adminNewEmail').value.trim(),
        password: document.getElementById('adminNewPassword').value,
    };

    setButtonLoading(btn, true, 'Creando...');
    try {
        const { data, error } = await db.functions.invoke('create-user', { body: payload });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        showToast(`Cuenta de ${payload.rol === 'docente' ? 'docente' : 'estudiante'} creada correctamente.`, 'success');
        document.getElementById('adminCreateUserForm').reset();
        await loadAdminUsersList(payload.rol);
    } catch (error) {
        showToast(friendlyError(error), 'error', 6000);
    } finally {
        setButtonLoading(btn, false);
    }
}

function initAdminModule() {
    document.getElementById('adminCreateUserForm').addEventListener('submit', handleCreateUserAdmin);
}
