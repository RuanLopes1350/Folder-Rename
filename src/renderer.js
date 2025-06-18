let selectedFolderPath = null;
let currentAnalysis = null;

// Elementos DOM
const selectFolderBtn = document.getElementById('selectFolder');
const selectedPathDiv = document.getElementById('selectedPath');
const analysisSection = document.getElementById('analysisSection');
const analysisDiv = document.getElementById('analysis');
const refreshAnalysisBtn = document.getElementById('refreshAnalysis');
const configSection = document.getElementById('configSection');
const previewSection = document.getElementById('previewSection');
const executeSection = document.getElementById('executeSection');
const generatePreviewBtn = document.getElementById('generatePreview');
const executeRenameBtn = document.getElementById('executeRename');
const previewResults = document.getElementById('previewResults');
const executeResults = document.getElementById('executeResults');
const loading = document.getElementById('loading');

// Event Listeners
selectFolderBtn.addEventListener('click', selectFolder);
refreshAnalysisBtn.addEventListener('click', () => analyzeFolder(selectedFolderPath));
generatePreviewBtn.addEventListener('click', generatePreview);
executeRenameBtn.addEventListener('click', executeRename);

async function selectFolder() {
    try {
        const folderPath = await window.electronAPI.selectFolder();
        if (folderPath) {
            selectedFolderPath = folderPath;
            selectedPathDiv.textContent = folderPath;
            selectedPathDiv.classList.remove('hidden');
            
            await analyzeFolder(folderPath);
        }
    } catch (error) {
        showError('Erro ao selecionar pasta: ' + error.message);
    }
}

async function analyzeFolder(folderPath) {
    showLoading(true);
    try {
        currentAnalysis = await window.electronAPI.analyzeFolder(folderPath);
        displayAnalysis(currentAnalysis);
        
        analysisSection.classList.remove('hidden');
        configSection.classList.remove('hidden');
        previewSection.classList.remove('hidden');
        executeSection.classList.remove('hidden');
    } catch (error) {
        showError('Erro ao analisar pasta: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function displayAnalysis(analysis) {
    let html = `
        <h4>📊 Resumo da Análise</h4>
        <p><strong>Total de subpastas:</strong> ${analysis.totalSubfolders}</p>
        <p><strong>Total de arquivos:</strong> ${analysis.totalFiles}</p>
        <p><strong>Tipos de arquivo encontrados:</strong> ${analysis.fileTypes.join(', ') || 'Nenhum'}</p>
        
        <h4>📁 Arquivos por pasta:</h4>
        <ul>
    `;
    
    for (const [folder, count] of Object.entries(analysis.filesByFolder)) {
        html += `<li><strong>${folder}:</strong> ${count} arquivo${count === 1 ? '' : 's'}</li>`;
    }
    
    html += '</ul>';
    analysisDiv.innerHTML = html;
}

async function generatePreview() {
    if (!selectedFolderPath) return;
    
    showLoading(true);
    try {
        const options = getOptions();
        const results = await window.electronAPI.previewRename(selectedFolderPath, options);
        displayPreviewResults(results);
    } catch (error) {
        showError('Erro ao gerar preview: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function executeRename() {
    if (!selectedFolderPath) return;
    
    if (!confirm('⚠️ ATENÇÃO: Esta ação irá renomear todos os arquivos conforme o preview. Tem certeza que deseja continuar?')) {
        return;
    }
    
    showLoading(true);
    try {
        const options = getOptions();
        const results = await window.electronAPI.renameFiles(selectedFolderPath, options);
        displayExecuteResults(results);
        
        // Atualiza a análise após renomeação
        await analyzeFolder(selectedFolderPath);
    } catch (error) {
        showError('Erro ao renomear arquivos: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function getOptions() {
    const startNumber = parseInt(document.getElementById('startNumber').value) || 1;
    const digits = parseInt(document.getElementById('digits').value) || 3;
    const separator = document.getElementById('separator').value;
    const fileTypesInput = document.getElementById('fileTypes').value.trim();
    
    let fileTypes = [];
    if (fileTypesInput) {
        fileTypes = fileTypesInput.split(',').map(type => type.trim().toLowerCase());
    }
    
    return { startNumber, digits, separator, fileTypes };
}

function displayPreviewResults(results) {
    let html = `
        <div class="success">
            <h4>👁️ Preview da Renomeação</h4>
            <p><strong>Pastas processadas:</strong> ${results.totalFolders}</p>
            <p><strong>Arquivos que serão renomeados:</strong> ${results.changes.length}</p>
        </div>
    `;
    
    if (results.errors.length > 0) {
        html += '<div class="error"><h4>⚠️ Avisos:</h4><ul>';
        results.errors.forEach(error => {
            html += `<li>${error}</li>`;
        });
        html += '</ul></div>';
    }
    
    if (results.changes.length > 0) {
        html += `
            <table class="preview-table">
                <thead>
                    <tr>
                        <th>Pasta</th>
                        <th>Nome Atual</th>
                        <th>Novo Nome</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        results.changes.forEach(change => {
            html += `
                <tr>
                    <td>${change.folder}</td>
                    <td>${change.oldName}</td>
                    <td>${change.newName}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
    }
    
    previewResults.innerHTML = html;
}

function displayExecuteResults(results) {
    let html = `
        <div class="${results.errors.length === 0 ? 'success' : 'error'}">
            <h4>🚀 Resultado da Renomeação</h4>
            <p><strong>Pastas processadas:</strong> ${results.totalFolders}</p>
            <p><strong>Total de arquivos:</strong> ${results.totalFiles}</p>
            <p><strong>Arquivos renomeados com sucesso:</strong> ${results.renamedFiles}</p>
        </div>
    `;
    
    if (results.errors.length > 0) {
        html += '<div class="error"><h4>❌ Erros encontrados:</h4><ul>';
        results.errors.forEach(error => {
            html += `<li>${error}</li>`;
        });
        html += '</ul></div>';
    }
    
    executeResults.innerHTML = html;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.container').firstChild);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showLoading(show) {
    loading.classList.toggle('hidden', !show);
}