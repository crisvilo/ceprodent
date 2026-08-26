/**
 * app.js
 * ----------------------------------------------------------------------
 * Punto de entrada de la aplicación. Conecta los formularios/botones
 * estáticos del HTML con sus manejadores y arranca la sesión.
 * ----------------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('btnLogout').addEventListener('click', handleLogout);

    initTeacherModule();
    initQuizModule();
    initStudentModule();

    initAuth();
});


// ============================================================
// REGISTRO DEL SERVICE WORKER
// ============================================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('./sw.js')
            .then(registration => {
                console.log('Service Worker registrado correctamente:', registration.scope);
            })
            .catch(error => {
                console.error('Error al registrar el Service Worker:', error);
            });
    });
}