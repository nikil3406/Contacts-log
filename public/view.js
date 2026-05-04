document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get('id');
    const backBtn = document.getElementById('backBtn');
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const messageEl = document.getElementById('message');

    if (!contactId) {
        window.location.href = 'index.html';
        return;
    }

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
        messageEl.classList.remove('hidden');
        if (type === 'error') {
            messageEl.style.background = 'rgba(220, 53, 69, 0.12)';
            messageEl.style.color = '#842029';
        } else if (type === 'success') {
            messageEl.style.background = 'rgba(40, 167, 69, 0.12)';
            messageEl.style.color = '#0f5132';
        }
        setTimeout(() => messageEl.classList.add('hidden'), 3000);
    }

    async function loadContact() {
        try {
            const response = await fetch(`/api/contacts/${contactId}`);
            if (!response.ok) throw new Error('Contact not found');
            const contact = await response.json();
            
            // Header
            document.getElementById('contactNameHeader').textContent = contact.name;
            document.getElementById('contactName').textContent = contact.name;
            document.querySelector('.contact-avatar-large').textContent = contact.name.charAt(0).toUpperCase();
            document.getElementById('nicknameHeader').textContent = contact.nickname || '';
            
            // Details
            document.getElementById('name').textContent = contact.name;
            document.getElementById('nickname').textContent = contact.nickname || '—';
            document.getElementById('email').textContent = contact.email;
            document.getElementById('phone').textContent = contact.phone;
            document.getElementById('company').textContent = contact.company || '—';
            document.getElementById('address').textContent = contact.address || '—';
            document.getElementById('notes').textContent = contact.notes || '—';
            document.getElementById('created').textContent = new Date(contact.created_at).toLocaleDateString();
            document.getElementById('contactSubtitle').textContent = `All details for ${contact.name}`;
        } catch (error) {
            showMessage('Contact not found.', 'error');
            setTimeout(() => window.location.href = 'index.html', 1500);
        }
    }

    if (!(await ensureAuth())) return;

    await loadContact();

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            window.location.href = `add.html?id=${contactId}`;
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Delete this contact? This cannot be undone.')) {
                try {
                    const response = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Delete failed');
                    showMessage('Contact deleted successfully!', 'success');
                    setTimeout(() => window.location.href = 'index.html', 1000);
                } catch (error) {
                    showMessage('Failed to delete contact.', 'error');
                }
            }
        });
    }
});

