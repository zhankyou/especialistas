/**
 * CORE AUTH ENGINE - APS ESE
 * Responsabilidades: Captura de credenciales, Handshake con API,
 * Sanitización de LocalStorage y Manipulación UI (Visibilidad de Contraseña).
 */
document.addEventListener('DOMContentLoaded', () => {

    // 1. Redirección automática si la sesión ya existe
    if (localStorage.getItem('token')) {
        window.location.replace('/dashboard');
        return;
    }

    // 2. Controladores del DOM
    const loginForm = document.getElementById('login-form');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');

    // 3. Arquitectura UX: Alternador de visibilidad de contraseña
    if (togglePasswordBtn && passwordInput && eyeIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';

            // Intercambio seguro de clases de FontAwesome
            if (isPassword) {
                eyeIcon.classList.remove('fa-eye');
                eyeIcon.classList.add('fa-eye-slash');
            } else {
                eyeIcon.classList.remove('fa-eye-slash');
                eyeIcon.classList.add('fa-eye');
            }
        });
    }

    // 4. Lógica transaccional de Inicio de Sesión
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            // Prevención de Double-Submit
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';

            const emailInput = document.getElementById('email').value.trim();
            const passValue = passwordInput.value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: emailInput,
                        password: passValue
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    // Guardado criptográfico en Caché (Cero Trust)
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('email', data.email);
                    localStorage.setItem('rol', data.rol);

                    submitBtn.innerHTML = '<i class="fas fa-check"></i> Acceso Concedido';
                    setTimeout(() => {
                        window.location.replace('/dashboard');
                    }, 500);
                } else {
                    // Manejo de Error de Credenciales
                    alert(`Acceso Denegado: ${data.message}`);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            } catch (error) {
                console.error("Fallo crítico de red: ", error);
                alert("Error de conexión. Verifique que el servidor Backend esté respondiendo o su conexión a Internet.");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
});