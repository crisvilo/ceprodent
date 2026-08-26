/**
 * auth.js
 * ----------------------------------------------------------------------
 * Maneja el inicio de sesión, cierre de sesión, restauración de sesión
 * al recargar la página y el enrutamiento inicial según el rol del
 * usuario (docente / estudiante).
 * ----------------------------------------------------------------------
 */

// Estado global de la aplicación (compartido por los demás módulos).
const APP = {
    user: null,      // Usuario de Supabase Auth
    profile: null,   // Fila de la tabla "usuarios" (nombres, apellidos, rol...)
};

/** Se ejecuta una vez al cargar la página: intenta restaurar la sesión activa. */
async function initAuth() {
    const { data: { session } } = await db.auth.getSession();

    if (session?.user) {
        await handleSessionActive(session.user);
    } else {
        showAuthScreen();
    }

    // Reacciona a cambios de sesión (login/logout desde cualquier parte).
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

/** Carga el perfil institucional del usuario y muestra el panel correspondiente. */
async function handleSessionActive(user) {
    APP.user = user;

    const { data: profile, error } = await db
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
    console.error('Error de Supabase al buscar perfil:', error);
    showToast('Error al buscar perfil: ' + error.message, 'error', 8000);
    await db.auth.signOut();
    return;
}

if (!profile) {
    showToast('No se encontró un perfil institucional para esta cuenta.', 'error', 6000);
    await db.auth.signOut();
    return;
}

    APP.profile = profile;

    // Actualiza la barra superior.
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('userNav').classList.remove('hidden');
    document.getElementById('userRoleBadge').textContent = profile.rol === 'docente' ? 'Docente' : 'Estudiante';
    document.getElementById('userNameDisplay').textContent = `${profile.nombres} ${profile.apellidos}`;

    if (profile.rol === 'docente') {
        switchView('teacherView');
        await loadTeacherDashboard();
    } else {
        switchView('studentView');
        await loadStudentDashboard();
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const btn = document.getElementById('btnLogin');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setButtonLoading(btn, true, 'Ingresando...');
    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await handleSessionActive(data.user);
        document.getElementById('loginForm').reset();
    } catch (error) {
        showToast(friendlyError(error), 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleLogout() {
    await db.auth.signOut();
    showToast('Sesión cerrada.', 'info', 2500);
}
