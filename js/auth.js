/**
 * auth.js
 * ----------------------------------------------------------------------
 * Maneja el inicio de sesión, cierre de sesión y restauración de sesión.
 *
 * Roles:
 * - administrador
 * - docente
 * - estudiante
 * ----------------------------------------------------------------------
 */

const APP = {
    user: null,
    profile: null
};


/** Se ejecuta al cargar la página e intenta restaurar la sesión activa. */
async function initAuth() {
    const { data: { session } } = await db.auth.getSession();

    if (session?.user) {
        await handleSessionActive(session.user);
    } else {
        showAuthScreen();
    }

    db.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            APP.user = null;
            APP.profile = null;
            showAuthScreen();
        }
    });
}


function showAuthScreen() {
    document.getElementById('mainHeader').classList.add('hidden');
    document.getElementById('userNav').classList.add('hidden');
    switchView('authView');
}


/** Carga el perfil institucional y dirige al usuario según su rol. */
async function handleSessionActive(user) {
    APP.user = user;

    const { data: profile, error } = await db
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Error de Supabase al buscar perfil:', error);
        showToast(
            'Error al buscar perfil: ' + error.message,
            'error',
            8000
        );
        await db.auth.signOut();
        return;
    }

    if (!profile) {
        showToast(
            'No se encontró un perfil institucional para esta cuenta.',
            'error',
            6000
        );
        await db.auth.signOut();
        return;
    }

    if (!profile.activo) {
        showToast(
            'Esta cuenta institucional se encuentra inactiva.',
            'error',
            6000
        );
        await db.auth.signOut();
        return;
    }

    APP.profile = profile;

    // Mostrar información del usuario.
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('userNav').classList.remove('hidden');

    document.getElementById('userNameDisplay').textContent =
        `${profile.nombres} ${profile.apellidos}`;


    // ==================================================================
    // ADMINISTRADOR
    // ==================================================================

    if (profile.rol === 'administrador') {

        document.getElementById('userRoleBadge').textContent =
            'Administrador';

        // Si existe una vista específica para administrador, la usamos.
        const adminView = document.getElementById('adminView');

        if (adminView) {
            switchView('adminView');

            // Se ejecuta únicamente si la función existe.
            if (typeof loadAdminDashboard === 'function') {
                await loadAdminDashboard();
            }

        } else {
            // Temporalmente utiliza el panel docente hasta crear adminView.
            switchView('teacherView');

            if (typeof loadTeacherDashboard === 'function') {
                await loadTeacherDashboard();
            }
        }

        return;
    }


    // ==================================================================
    // DOCENTE
    // ==================================================================

    if (profile.rol === 'docente') {

        document.getElementById('userRoleBadge').textContent =
            'Docente';

        switchView('teacherView');

        if (typeof loadTeacherDashboard === 'function') {
            await loadTeacherDashboard();
        }

        return;
    }


    // ==================================================================
    // ESTUDIANTE
    // ==================================================================

    if (profile.rol === 'estudiante') {

        document.getElementById('userRoleBadge').textContent =
            'Estudiante';

        switchView('studentView');

        if (typeof loadStudentDashboard === 'function') {
            await loadStudentDashboard();
        }

        return;
    }


    // ==================================================================
    // ROL NO RECONOCIDO
    // ==================================================================

    console.error('Rol no reconocido:', profile.rol);

    showToast(
        'El rol asignado a esta cuenta no es válido.',
        'error',
        6000
    );

    await db.auth.signOut();
}


/** Procesa el formulario de inicio de sesión. */
async function handleLogin(event) {
    event.preventDefault();

    const btn = document.getElementById('btnLogin');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setButtonLoading(btn, true, 'Ingresando...');

    try {
        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        await handleSessionActive(data.user);

        document.getElementById('loginForm').reset();

    } catch (error) {
        console.error('Error de inicio de sesión:', error);
        showToast(friendlyError(error), 'error');

    } finally {
        setButtonLoading(btn, false);
    }
}


/** Cierra la sesión actual. */
async function handleLogout() {
    await db.auth.signOut();
    showToast('Sesión cerrada.', 'info', 2500);
}