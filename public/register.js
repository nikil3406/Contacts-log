document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('registerForm');
    const messageEl = document.getElementById('message');

    function showMessage(text, type = 'info') {
        if (!messageEl) return;
        messageEl.textContent = text;
        messageEl.className = 'form-message';
        if (type === 'error') {
            messageEl.style.background = 'rgba(220, 53, 69, 0.12)';
            messageEl.style.color = '#842029';
        } else {
            messageEl.style.background = 'rgba(40, 167, 69, 0.12)';
            messageEl.style.color = '#0f5132';
        }
    }

    async function checkSession() {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                window.location.href = 'index.html';
            }
        } catch (err) {
            // Not signed in yet.
        }
    }

    await checkSession();

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const confirmPassword = document.getElementById('confirmPassword').value.trim();

            if (!name || !email || !password || !confirmPassword) {
                showMessage('Please complete all fields.', 'error');
                return;
            }

            if (password !== confirmPassword) {
                showMessage('Passwords do not match.', 'error');
                return;
            }

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    showMessage(errorData.error || 'Registration failed.', 'error');
                    return;
                }

                showMessage('Registration successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 700);
            } catch (error) {
                showMessage('Unable to register. Please try again.', 'error');
            }
        });
    }
});
