const registerForm = document.getElementById('formulario-registro');
const loginForm = document.getElementById('formulario-login');
const messageElement = document.getElementById('mensaje');

const API_URL = 'http://localhost:3000';

//mostrar mensajes
function mostrarMensaje(texto, tipo) {
    const mensaje = document.getElementById('mensaje');
    mensaje.textContent = texto;

    mensaje.className = 'mensaje-estado';

    if (tipo === 'exito') {
        mensaje.classList.add('mensaje-exito');
    } else {
        mensaje.classList.add('mensaje-error');
    }

    setTimeout(() => {
        mensaje.textContent = '';
        mensaje.className = 'mensaje-estado';
    }, 4000);
}

//Registro de usuarios normales
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const email = document.getElementById('reg-email').value;

    const res = await fetch(`${API_URL}/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email }),
    });

    const data = await res.json();

    if (res.ok) {
        mostrarMensaje(data.message || 'Registro exitoso', 'exito');
        registerForm.reset();
    } else {
        mostrarMensaje(data.error || 'Error al registrar usuario', 'error');
    }
});


loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('log-email').value;
    const password = document.getElementById('log-password').value;

    //Verificación del administrador
    //el correo es admin@app.com con contraseña admin123
    if (email === 'admin@miapp.com' && password === 'admin123') {
        localStorage.setItem('rol', 'admin');
        localStorage.setItem('usuarioActivo', 'Administrador');
        mostrarMensaje('Bienvenido, Administrador', 'exito');
        loginForm.reset();

        //si es admin redirige al panel de admin
        setTimeout(() => window.location.href = "/admin", 1200);
        return;
    }

    //aca redirige al usuario normal
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) {
        mostrarMensaje(data.message || 'Inicio de sesión exitoso', 'exito');

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('usuarioActivo', data.user.username);
        localStorage.setItem('rol', 'usuario');

        loginForm.reset();

        
        setTimeout(() => window.location.href = "/usuario", 1200);
    } else {
        mostrarMensaje(data.error || 'Error al iniciar sesión', 'error');
    }
});


window.addEventListener('DOMContentLoaded', () => {
    const rol = localStorage.getItem('rol');
    if (rol === 'admin') {
        window.location.href = '/admin';
    } else if (rol === 'usuario') {
        window.location.href = '/usuario';
    }
});
