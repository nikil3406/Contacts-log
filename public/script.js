class ContactManager {
    constructor() {
        this.contacts = [];
        this.filteredContacts = [];
        this.editingId = null;
        this.user = null;
        this.init();
    }

    async init() {
        await this.loadUser();
        await this.loadContacts();
        this.setupEventListeners();
        this.updateStats();
        this.renderContacts();
        this.hideAddForm();
    }

    async loadUser() {
        try {
            const response = await fetch('/api/auth/me');
            if (!response.ok) {
                window.location.href = 'login.html';
                return;
            }
            this.user = await response.json();
            const usernameDisplay = document.getElementById('usernameDisplay');
            if (usernameDisplay) {
                usernameDisplay.textContent = `Signed in as ${this.user.name}`;
            }
        } catch (error) {
            console.error('Failed to load user session:', error);
            window.location.href = 'login.html';
        }
    }

    setupEventListeners() {
        const addBtn = document.getElementById('addContactBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                window.location.href = 'add.html';
            });
        }

        const emptyStateBtn = document.getElementById('emptyStateAddBtn');
        if (emptyStateBtn) {
            emptyStateBtn.addEventListener('click', () => {
                window.location.href = 'add.html';
            });
        }

        const contactForm = document.getElementById('contactForm');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveContact();
            });
        }

        const cancelButton = document.getElementById('cancelEdit');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                this.cancelEdit();
            });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchContacts(e.target.value);
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await this.logout();
            });
        }

        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('focus', function() {
                this.parentElement.classList.add('focused');
            });
            input.addEventListener('blur', function() {
                this.parentElement.classList.remove('focused');
            });
        });
    }

    async loadContacts() {
        try {
            const response = await fetch('/api/contacts');
            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error('Failed to fetch contacts');
            }
            this.contacts = await response.json();
            this.filteredContacts = [...this.contacts];
        } catch (error) {
            console.error('Error loading contacts:', error);
            this.showNotification('Failed to load contacts', 'error');
        }
    }

    async saveContact() {
        const name = document.getElementById('name').value.trim();
        const nickname = document.getElementById('nickname') ? document.getElementById('nickname').value.trim() : '';
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const company = document.getElementById('company') ? document.getElementById('company').value.trim() : '';
        const address = document.getElementById('address') ? document.getElementById('address').value.trim() : '';
        const notes = document.getElementById('notes') ? document.getElementById('notes').value.trim() : '';
        const id = document.getElementById('editId') ? document.getElementById('editId').value : '';

        // Validation
        if (!name || !email || !phone) {
            this.showNotification('Please fill all fields', 'error');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showNotification('Please enter a valid email', 'error');
            return;
        }

        const contactData = { name, nickname, email, phone, company, address, notes };

        try {
            let response;
            if (this.editingId) {
                // Update existing contact
                response = await fetch(`/api/contacts/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(contactData)
                });
            } else {
                // Create new contact
                response = await fetch('/api/contacts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(contactData)
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save contact');
            }

            await this.loadContacts();
            this.renderContacts();
            this.updateStats();
            this.resetForm();
            this.showNotification(
                this.editingId ? 'Contact updated successfully!' : 'Contact added successfully!', 
                'success'
            );
        } catch (error) {
            console.error('Error saving contact:', error);
            this.showNotification(error.message || 'Error saving contact', 'error');
        }
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout failed:', error);
        }
        window.location.href = 'login.html';
    }

    editContact(id) {
        const editForm = document.getElementById('contactForm');
        if (!editForm) {
            window.location.href = `add.html?id=${id}`;
            return;
        }

        const contact = this.contacts.find(c => c.id == id);
        if (contact) {
            document.getElementById('editId').value = contact.id;
            document.getElementById('name').value = contact.name;
            document.getElementById('email').value = contact.email;
            document.getElementById('phone').value = contact.phone;
            document.getElementById('nickname').value = contact.nickname || '';
            document.getElementById('company').value = contact.company || '';
            document.getElementById('address').value = contact.address || '';
            document.getElementById('notes').value = contact.notes || '';
            
            this.editingId = id;
            this.toggleAddForm(true);
            document.body.classList.add('editing');
            
            const saveBtn = document.querySelector('.btn-primary');
            saveBtn.innerHTML = '<i class="fas fa-edit"></i> Update Contact';
            saveBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            
            this.showNotification('Edit mode activated', 'info');
        }
    }

    async deleteContact(id) {
        if (confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
            try {
                const response = await fetch(`/api/contacts/${id}`, { 
                    method: 'DELETE' 
                });
                if (!response.ok) throw new Error('Failed to delete contact');
                
                await this.loadContacts();
                this.renderContacts();
                this.updateStats();
                this.showNotification('Contact deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting contact:', error);
                this.showNotification('Error deleting contact', 'error');
            }
        }
    }

    cancelEdit() {
        this.resetForm();
        this.showNotification('Edit cancelled', 'info');
    }

    toggleAddForm(show = true) {
        const formContainer = document.getElementById('addContactFormContainer');
        const addBtn = document.getElementById('addContactBtn');
        if (!formContainer || !addBtn) return;

        if (show) {
            formContainer.classList.remove('hidden');
            formContainer.scrollIntoView({ behavior: 'smooth' });
            document.getElementById('name').focus();
            addBtn.innerHTML = '<i class="fas fa-times"></i> Hide Form';
            addBtn.classList.add('btn-secondary-like');
        } else {
            formContainer.classList.add('hidden');
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Add New Contact';
            addBtn.classList.remove('btn-secondary-like');
        }
    }

    resetForm() {
        document.getElementById('contactForm').reset();
        document.getElementById('editId').value = '';
        this.editingId = null;
        document.body.classList.remove('editing');
        
        const saveBtn = document.querySelector('.btn-primary');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Contact';
        saveBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        this.hideAddForm();
    }

    hideAddForm() {
        this.toggleAddForm(false);
    }

    searchContacts(query) {
        const trimmedQuery = query.trim().toLowerCase();
        
        if (!trimmedQuery) {
            this.filteredContacts = [...this.contacts];
        } else {
            this.filteredContacts = this.contacts.filter(contact =>
                contact.name.toLowerCase().includes(trimmedQuery) ||
                (contact.nickname || '').toLowerCase().includes(trimmedQuery) ||
                contact.email.toLowerCase().includes(trimmedQuery) ||
                contact.phone.toLowerCase().includes(trimmedQuery) ||
                (contact.company || '').toLowerCase().includes(trimmedQuery) ||
                (contact.address || '').toLowerCase().includes(trimmedQuery) ||
                (contact.notes || '').toLowerCase().includes(trimmedQuery)
            );
        }
        
        this.renderContacts();
    }

    updateStats() {
        const statsElement = document.getElementById('totalContacts');
        if (statsElement) {
            statsElement.textContent = this.contacts.length;
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    renderContacts() {
        const container = document.getElementById('contactsContainer');
        
        if (this.filteredContacts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>${this.contacts.length === 0 ? 'No contacts yet. Add your first contact!' : 'No contacts found matching your search.'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredContacts.map(contact => `
            <div class="contact-card" data-id="${contact.id}">
                <div class="avatar">${this.escapeHtml(contact.name.charAt(0).toUpperCase())}</div>
                <div class="contact-info">
                    <div class="contact-heading">
                        <h3 class="contact-name">
                            ${this.escapeHtml(contact.name)}
                            <span class="toggle-icon"><i class="fas fa-chevron-down"></i></span>
                        </h3>
                        <div class="contact-actions">
                            <button type="button" class="btn-sm btn-edit" onclick="event.stopPropagation(); window.app.editContact(${contact.id});" title="Edit contact">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn-sm btn-delete" onclick="event.stopPropagation(); window.app.deleteContact(${contact.id});" title="Delete contact">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    ${contact.nickname ? `<p class="subtitle"><i class="fas fa-user-tag"></i> ${this.escapeHtml(contact.nickname)}</p>` : ''}
                    <div class="contact-details">
                        <p><i class="fas fa-envelope"></i> ${this.escapeHtml(contact.email)}</p>
                        <p><i class="fas fa-phone"></i> ${this.escapeHtml(contact.phone)}</p>
                        ${contact.company ? `<p><i class="fas fa-building"></i> ${this.escapeHtml(contact.company)}</p>` : ''}
                        ${contact.address ? `<p><i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(contact.address)}</p>` : ''}
                        ${contact.notes ? `<p><i class="fas fa-sticky-note"></i> ${this.escapeHtml(contact.notes)}</p>` : ''}
                        <small>
                            <i class="fas fa-clock"></i> 
                            ${new Date(contact.created_at).toLocaleDateString()}
                        </small>
                    </div>
                </div>
            </div>
        `).join('');

        // Toggle details when clicking on a contact card, but ignore action buttons.
        container.querySelectorAll('.contact-card').forEach(card => {
            card.addEventListener('click', (event) => {
                if (event.target.closest('.contact-actions')) return;
                card.classList.toggle('expanded');
            });
        });

        // Make app globally accessible for onclick handlers
        window.app = this;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            ${message}
        `;
        
        // Add CSS for notifications
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 10px;
                    color: white;
                    font-weight: 600;
                    z-index: 10000;
                    transform: translateX(400px);
                    transition: all 0.3s ease;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    max-width: 350px;
                }
                .notification.show {
                    transform: translateX(0);
                }
                .notification-success { background: linear-gradient(135deg, #28a745, #20c997); }
                .notification-error { background: linear-gradient(135deg, #dc3545, #c82333); }
                .notification-info { background: linear-gradient(135deg, #17a2b8, #138496); }
                .notification i { font-size: 1.2em; }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);
        
        // Show animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ContactManager();
});

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});