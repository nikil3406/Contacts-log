document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('addContactForm');
    const backBtn = document.getElementById('backBtn');
    const messageEl = document.getElementById('message');
    const editIdInput = document.getElementById('editId');
    const formTitle = document.getElementById('formTitle');
    const submitIcon = document.getElementById('submitIcon');
    const submitText = document.getElementById('submitText');
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get('id');

    async function ensureAuth() {
        try {
            const response = await fetch('/api/auth/me');
            if (!response.ok) {
                window.location.href = 'login.html';
                return false;
            }
            return true;
        } catch (err) {
            window.location.href = 'login.html';
            return false;
        }
    }

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

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function setEditMode(contact) {
        if (!contact) return;
        editIdInput.value = contact.id;
        document.getElementById('name').value = contact.name;
        document.getElementById('nickname').value = contact.nickname || '';
        document.getElementById('email').value = contact.email;
        document.getElementById('phone').value = contact.phone;
        document.getElementById('company').value = contact.company || '';
        document.getElementById('address').value = contact.address || '';
        document.getElementById('notes').value = contact.notes || '';
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-user-edit"></i> Edit Contact';
        }
        if (submitIcon) {
            submitIcon.className = 'fas fa-edit';
        }
        if (submitText) {
            submitText.textContent = 'Update Contact';
        }
    }

    async function loadContact(id) {
        try {
            const response = await fetch(`/api/contacts/${id}`);
            if (!response.ok) {
                throw new Error('Contact not found');
            }
            const contact = await response.json();
            setEditMode(contact);
        } catch (error) {
            showMessage('Unable to load contact for editing.', 'error');
        }
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    if (!(await ensureAuth())) {
        return;
    }

    if (contactId) {
        loadContact(contactId);
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value.trim();
            const nickname = document.getElementById('nickname').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const company = document.getElementById('company').value.trim();
            const address = document.getElementById('address').value.trim();
            const notes = document.getElementById('notes').value.trim();
            const contactIdValue = editIdInput.value;

            if (!name || !email || !phone) {
                showMessage('Please fill in name, email, and phone before saving.', 'error');
                return;
            }
            if (!isValidEmail(email)) {
                showMessage('Please enter a valid email address.', 'error');
                return;
            }

            const body = { name, nickname, email, phone, company, address, notes };
            const endpoint = contactIdValue ? `/api/contacts/${contactIdValue}` : '/api/contacts';
            const method = contactIdValue ? 'PUT' : 'POST';

            try {
                const response = await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    const errorMessage = errorData.error || 'Unable to save contact.';
                    showMessage(errorMessage, 'error');
                    return;
                }

                showMessage(contactIdValue ? 'Contact updated successfully! Redirecting...' : 'Contact added successfully! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 900);
            } catch (error) {
                showMessage('Failed to save contact. Try again later.', 'error');
            }
        });
    }
});
