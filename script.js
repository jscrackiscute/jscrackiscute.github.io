document.addEventListener('DOMContentLoaded', () => {
    // Check for Config
    if (typeof CONFIG === 'undefined') {
        console.error("CONFIG is missing! Make sure config.js is loaded.");
        return;
    }

    const isAdmin = document.body.classList.contains('admin-page');
    const isLoginPage = document.querySelector('.login-container');

    // Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const fileCount = document.querySelector('.file-count');

    // Constants
    const STORAGE_KEY = 'donut_smp_files';
    const AUTH_KEY = 'donut_smp_auth';

    // --- Authentication Logic (Login Page) ---
    if (isLoginPage) {
        const loginForm = document.getElementById('login-form');
        const passwordInput = document.getElementById('password');
        const errorMsg = document.getElementById('login-error');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: passwordInput.value })
                });
                const data = await response.json();

                if (data.success) {
                    localStorage.setItem(AUTH_KEY, 'true');
                    window.location.href = 'admin.html';
                } else {
                    errorMsg.style.display = 'block';
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            } catch (err) {
                console.error('Login error:', err);
                errorMsg.textContent = 'Server connection failed.';
                errorMsg.style.display = 'block';
            }
        });
        return; // Logic ends here for login page
    }

    // --- Admin Protection ---
    if (isAdmin) {
        if (localStorage.getItem(AUTH_KEY) !== 'true') {
            window.location.href = 'login.html';
            return;
        }

        // Setup Logout Button
        const nav = document.querySelector('nav');
        if (nav) {
            // Check if logout button already exists to avoid dupes
            if (!nav.querySelector('.logout-btn')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.className = 'btn-secondary logout-btn';
                logoutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Logout';
                logoutBtn.style.marginLeft = '10px';
                logoutBtn.onclick = () => {
                    localStorage.removeItem(AUTH_KEY);
                    window.location.href = 'index.html';
                };
                nav.appendChild(logoutBtn);
            }
        }
    }

    // --- File Management Logic ---

    // Initialize
    if (fileList) {
        loadFiles();
    }

    // Admin Drag & Drop
    if (isAdmin && dropZone) {
        setupDragAndDrop();
    }

    // --- Core Functions ---

    function setupDragAndDrop() {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                handleNewFiles(e.dataTransfer.files);
            }
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
                handleNewFiles(fileInput.files);
            }
        });
    }

    // New Download Logic: Direct link to server file
    function downloadFile(name) {
        // Files are served from /uploads/
        // We use the name as it was saved on the server (which we kept as original name in this simple config)
        // If we changed filenames to include IDs, we'd need that property here.
        // Our server saves as original name.
        const url = `/uploads/${name}`;
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async function handleNewFiles(fileListObject) {
        // Prepare to upload
        updateCount('Uploading...');

        for (const file of fileListObject) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error('Upload failed');
            } catch (error) {
                console.error('Error uploading file:', file.name, error);
                alert(`Failed to upload ${file.name}`);
            }
        }

        loadFiles(); // Refresh list after uploads
    }

    async function loadFiles() {
        try {
            const response = await fetch('/api/files');
            const files = await response.json();

            renderFileList(files);
        } catch (error) {
            console.error('Error loading files:', error);
            if (fileList) fileList.innerHTML = '<div class="empty-state"><p>Error connecting to server</p></div>';
        }
    }

    async function deleteFile(id) {
        try {
            const response = await fetch(`/api/files/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadFiles();
            } else {
                alert('Failed to delete file');
            }
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    }

    function renderFileList(files) {
        fileList.innerHTML = '';
        if (files.length === 0) {
            fileList.innerHTML = `
                <div class="empty-state">
                    <p>${isAdmin ? 'No cheats uploaded' : 'No cheats available yet'}</p>
                </div>
            `;
        } else {
            files.forEach(file => {
                fileList.appendChild(renderFileItem(file));
            });
        }
        updateCount(files.length);
    }

    function renderFileItem(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        const formattedSize = formatSize(file.size);

        let actionHtml = '';
        if (isAdmin) {
            actionHtml = `<button class="btn-icon delete-btn" title="Delete File"><i class="fa-solid fa-trash"></i></button>`;
        } else {
            actionHtml = `<button class="download-btn" title="Download Cheat">Download <i class="fa-solid fa-download"></i></button>`;
        }

        fileItem.innerHTML = `
            <div class="file-icon">
                <i class="fa-regular fa-file-code"></i>
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formattedSize}</div>
            </div>
            <div class="file-status">
                ${actionHtml}
            </div>
        `;

        // Direct Event Handlers
        if (isAdmin) {
            const deleteBtn = fileItem.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (deleteBtn.classList.contains('confirm-state')) {
                        deleteFile(file.id);
                    } else {
                        deleteBtn.classList.add('confirm-state');
                        deleteBtn.innerHTML = 'Sure?';
                        setTimeout(() => {
                            if (document.body.contains(deleteBtn)) {
                                deleteBtn.classList.remove('confirm-state');
                                deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                            }
                        }, 3000);
                    }
                });
            }
        } else {
            const downloadBtn = fileItem.querySelector('.download-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    downloadFile(file.name); // Using file.name assumes server saved it as such
                });
            }
        }

        return fileItem;
    }

    function formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function updateCount(count) { // Adapted to handle both number and string (loading state)
        if (fileCount) {
            if (typeof count === 'string') {
                fileCount.textContent = count;
            } else {
                fileCount.textContent = `${count} file${count !== 1 ? 's' : ''}`;
            }
        }
    }
});
