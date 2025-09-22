class NotesApp {
    constructor() {
        this.notes = [];
        this.suggestionTimeout = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadNotes();
        this.updateCharCount();
    }

    bindEvents() {
        const noteTextarea = document.getElementById('noteTextarea');
        const saveBtn = document.getElementById('saveBtn');
        const correctBtn = document.getElementById('correctBtn');

        // Auto-completion as user types
        noteTextarea.addEventListener('input', (e) => {
            this.updateCharCount();
            this.updateButtonStates();
            
            // Debounce AI suggestions
            clearTimeout(this.suggestionTimeout);
            if (e.target.value.length > 10) {
                this.suggestionTimeout = setTimeout(() => {
                    this.getSuggestions(e.target.value);
                }, 1000);
            } else {
                this.clearSuggestions();
            }
        });

        saveBtn.addEventListener('click', () => this.saveNote());
        correctBtn.addEventListener('click', () => this.correctText());

        // Enter + Ctrl/Cmd to save
        noteTextarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.saveNote();
            }
        });
    }

    updateCharCount() {
        const textarea = document.getElementById('noteTextarea');
        const charCount = document.getElementById('charCount');
        charCount.textContent = textarea.value.length;
    }

    updateButtonStates() {
        const textarea = document.getElementById('noteTextarea');
        const saveBtn = document.getElementById('saveBtn');
        const correctBtn = document.getElementById('correctBtn');
        
        const hasContent = textarea.value.trim().length > 0;
        saveBtn.disabled = !hasContent;
        correctBtn.disabled = !hasContent;
    }

    async getSuggestions(text) {
        try {
            this.setAIStatus('Getting suggestions...');
            
            const response = await fetch('/api/ai/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });

            const data = await response.json();
            this.displaySuggestions(data.suggestions || []);
            this.setAIStatus('');
        } catch (error) {
            console.error('Error getting suggestions:', error);
            this.setAIStatus('Suggestions unavailable');
            this.clearSuggestions();
        }
    }

    displaySuggestions(suggestions) {
        const container = document.getElementById('suggestions');
        container.innerHTML = '';

        suggestions.slice(0, 3).forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = suggestion.trim();
            btn.onclick = () => this.applySuggestion(suggestion);
            container.appendChild(btn);
        });
    }

    applySuggestion(suggestion) {
        const textarea = document.getElementById('noteTextarea');
        const currentText = textarea.value;
        const lastSpaceIndex = currentText.lastIndexOf(' ');
        
        const newText = lastSpaceIndex >= 0 
            ? currentText.substring(0, lastSpaceIndex + 1) + suggestion
            : suggestion;
            
        textarea.value = newText;
        textarea.focus();
        textarea.setSelectionRange(newText.length, newText.length);
        
        this.updateCharCount();
        this.clearSuggestions();
    }

    clearSuggestions() {
        document.getElementById('suggestions').innerHTML = '';
    }

    async correctText() {
        const textarea = document.getElementById('noteTextarea');
        const text = textarea.value.trim();
        
        if (!text) return;

        try {
            this.showLoading();
            this.setAIStatus('Correcting text...');

            const response = await fetch('/api/ai/correct', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });

            const data = await response.json();
            
            if (data.correctedText) {
                textarea.value = data.correctedText;
                this.updateCharCount();
                this.setAIStatus('Text corrected!');
                setTimeout(() => this.setAIStatus(''), 2000);
            }
        } catch (error) {
            console.error('Error correcting text:', error);
            this.setAIStatus('Correction failed');
        } finally {
            this.hideLoading();
        }
    }

    async saveNote() {
        const textarea = document.getElementById('noteTextarea');
        const content = textarea.value.trim();
        
        if (!content) return;

        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            const note = await response.json();
            this.notes.unshift(note);
            this.renderNotes();
            
            textarea.value = '';
            this.updateCharCount();
            this.updateButtonStates();
            this.clearSuggestions();
            
            this.showToast('Note saved successfully!');
        } catch (error) {
            console.error('Error saving note:', error);
            this.showToast('Failed to save note', 'error');
        }
    }

    async loadNotes() {
        try {
            const response = await fetch('/api/notes');
            this.notes = await response.json();
            this.renderNotes();
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    async deleteNote(noteId) {
        if (!confirm('Are you sure you want to delete this note?')) return;

        try {
            await fetch(`/api/notes/${noteId}`, {
                method: 'DELETE'
            });

            this.notes = this.notes.filter(note => note.id !== noteId);
            this.renderNotes();
            this.showToast('Note deleted');
        } catch (error) {
            console.error('Error deleting note:', error);
            this.showToast('Failed to delete note', 'error');
        }
    }

    editNote(note) {
        const textarea = document.getElementById('noteTextarea');
        textarea.value = note.content;
        textarea.focus();
        this.updateCharCount();
        this.updateButtonStates();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    renderNotes() {
        const notesList = document.getElementById('notesList');
        const notesCount = document.getElementById('notesCount');
        
        notesCount.textContent = this.notes.length;

        if (this.notes.length === 0) {
            notesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-sticky-note"></i>
                    <p>No notes yet. Create your first note above!</p>
                </div>
            `;
            return;
        }

        notesList.innerHTML = this.notes.map(note => `
            <div class="note-item">
                <div class="note-content">${this.escapeHtml(note.content)}</div>
                <div class="note-meta">
                    <span>${this.formatDate(note.timestamp)}</span>
                    <div class="note-actions">
                        <button onclick="app.editNote(${JSON.stringify(note).replace(/"/g, '&quot;')})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="app.deleteNote(${note.id})" class="delete-btn" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);

        if (diffInHours < 1) {
            return 'Just now';
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)} hours ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setAIStatus(message) {
        document.getElementById('aiStatus').textContent = message;
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showToast(message, type = 'success') {
        // Simple toast implementation
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? 'var(--error-color)' : 'var(--success-color)'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 1001;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

const app = new NotesApp();