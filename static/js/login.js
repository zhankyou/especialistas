/**
 * CLIENTE DE AUTENTICACION IAM - APS ESE 2026
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    if (!loginForm) {
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const submitButton = loginForm.querySelector('button[type="submit"]');

        if (!email || !password) {
            if (window.AppDialog && typeof window.AppDialog.alert === 'function') {
                window.AppDialog.alert('Validacion', 'Ingrese correo y contrasena.');
            } else {
                alert('Ingrese correo y contrasena.');
            }
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = 'Autenticando...';
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email: email, password: password })
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                localStorage.setItem('token', data.data.token);
                localStorage.setItem('email', data.data.email);
                localStorage.setItem('rol', data.data.rol);

                window.location.replace('/dashboard');
            } else {
                if (window.AppDialog && typeof window.AppDialog.alert === 'function') {
                    window.AppDialog.alert('Acceso Denegado', data.message || 'Credenciales invalidas.');
                } else {
                    alert(data.message || 'Credenciales invalidas.');
                }

                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            console.error('Fallo de red al autenticar:', error);
            if (window.AppDialog && typeof window.AppDialog.alert === 'function') {
                window.AppDialog.alert('Error', 'No se pudo conectar con el servidor.');
            } else {
                alert('No se pudo conectar con el servidor.');
            }
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Ingresar';
            }
        }
    });
});