// modal.js - 通用模态框系统
(function() {
    function showModal(title, content, buttons) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#fff;border-radius:12px;padding:25px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

        const titleEl = document.createElement('h3');
        titleEl.style.cssText = 'margin:0 0 15px;color:#2d3748;font-size:18px;';
        titleEl.textContent = title;
        modal.appendChild(titleEl);

        if (typeof content === 'string') {
            const contentEl = document.createElement('div');
            contentEl.style.cssText = 'margin-bottom:20px;line-height:1.6;color:#4a5568;';
            contentEl.innerHTML = content;
            modal.appendChild(contentEl);
        } else if (content instanceof HTMLElement) {
            content.style.marginBottom = '20px';
            modal.appendChild(content);
        }

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

        (buttons || []).forEach(btn => {
            const button = document.createElement('button');
            button.className = 'btn ' + (btn.class || 'btn-secondary');
            button.textContent = btn.text;
            button.addEventListener('click', () => {
                overlay.remove();
                if (btn.onClick) btn.onClick();
            });
            btnContainer.appendChild(button);
        });

        modal.appendChild(btnContainer);
        overlay.appendChild(modal);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    function showAlert(message, title) {
        return showModal(title || '提示', message, [
            { text: '确定', class: 'btn-primary' }
        ]);
    }

    function showConfirm(message, title) {
        return new Promise((resolve) => {
            showModal(title || '确认', message, [
                { text: '取消', class: 'btn-secondary', onClick: () => resolve(false) },
                { text: '确认', class: 'btn-primary', onClick: () => resolve(true) }
            ]);
        });
    }

    function showEditModal(title, initialValue, onSave) {
        const textarea = document.createElement('textarea');
        textarea.className = 'form-textarea';
        textarea.value = initialValue || '';
        textarea.rows = 12;
        textarea.style.cssText = 'width:100%;min-height:300px;font-size:14px;line-height:1.6;';

        showModal(title, textarea, [
            { text: '取消', class: 'btn-secondary' },
            { text: '保存', class: 'btn-primary', onClick: () => { if (onSave) onSave(textarea.value); } }
        ]);
    }

    window.showModal = showModal;
    window.showAlert = showAlert;
    window.showConfirm = showConfirm;
    window.showEditModal = showEditModal;
})();
