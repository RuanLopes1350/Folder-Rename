const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    icon: path.join(__dirname, '..', 'icon', 'icone.png'), // Ícone da aplicação
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Bulk File Renamer',
    resizable: true,
    minimizable: true,
    maximizable: true
  });

  mainWindow.loadFile(path.join(__dirname, 'views', 'index.html'));
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Função para obter extensão do arquivo
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

// Função para verificar se é um arquivo válido (não oculto, não sistema)
function isValidFile(filename) {
  const hiddenFiles = ['.DS_Store', 'Thumbs.db', '.gitkeep'];
  return !filename.startsWith('.') && !hiddenFiles.includes(filename);
}

// Função principal de renomeação
async function renameFilesInFolder(folderPath, options = {}) {
  const {
    startNumber = 1,
    digits = 3,
    separator = '_',
    fileTypes = [], // Se vazio, aceita todos os tipos
    dryRun = false
  } = options;

  const results = {
    totalFolders: 0,
    totalFiles: 0,
    renamedFiles: 0,
    errors: [],
    changes: []
  };

  try {
    // Lê o conteúdo da pasta raiz
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    
    // Filtra apenas as subpastas
    const subfolders = items.filter(item => item.isDirectory());
    results.totalFolders = subfolders.length;

    for (const subfolder of subfolders) {
      const subfolderPath = path.join(folderPath, subfolder.name);
      
      try {
        // Lê os arquivos da subpasta
        const files = await fs.readdir(subfolderPath, { withFileTypes: true });
        const validFiles = files.filter(file => 
          file.isFile() && 
          isValidFile(file.name) &&
          (fileTypes.length === 0 || fileTypes.includes(getFileExtension(file.name)))
        );

        results.totalFiles += validFiles.length;
        
        // Renomeia cada arquivo
        let counter = startNumber;
        for (const file of validFiles) {
          const oldPath = path.join(subfolderPath, file.name);
          const extension = getFileExtension(file.name);
          const newFileName = `${subfolder.name}${separator}${counter.toString().padStart(digits, '0')}${extension}`;
          const newPath = path.join(subfolderPath, newFileName);

          // Verifica se o novo nome já existe
          try {
            await fs.access(newPath);
            results.errors.push(`Arquivo já existe: ${newFileName} em ${subfolder.name}`);
            continue;
          } catch {
            // Arquivo não existe, pode prosseguir
          }

          const change = {
            folder: subfolder.name,
            oldName: file.name,
            newName: newFileName,
            path: subfolderPath
          };

          if (!dryRun) {
            try {
              await fs.rename(oldPath, newPath);
              results.renamedFiles++;
              change.status = 'success';
            } catch (error) {
              results.errors.push(`Erro ao renomear ${file.name}: ${error.message}`);
              change.status = 'error';
              change.error = error.message;
            }
          } else {
            change.status = 'preview';
          }

          results.changes.push(change);
          counter++;
        }
      } catch (error) {
        results.errors.push(`Erro ao processar pasta ${subfolder.name}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`Erro ao ler pasta raiz: ${error.message}`);
  }

  return results;
}

// Função para analisar pasta (preview)
async function analyzeFolder(folderPath) {
  const analysis = {
    totalSubfolders: 0,
    totalFiles: 0,
    filesByFolder: {},
    fileTypes: new Set()
  };

  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    const subfolders = items.filter(item => item.isDirectory());
    analysis.totalSubfolders = subfolders.length;

    for (const subfolder of subfolders) {
      const subfolderPath = path.join(folderPath, subfolder.name);
      
      try {
        const files = await fs.readdir(subfolderPath, { withFileTypes: true });
        const validFiles = files.filter(file => 
          file.isFile() && isValidFile(file.name)
        );

        analysis.filesByFolder[subfolder.name] = validFiles.length;
        analysis.totalFiles += validFiles.length;

        // Coleta tipos de arquivo
        validFiles.forEach(file => {
          const ext = getFileExtension(file.name);
          if (ext) analysis.fileTypes.add(ext);
        });
      } catch (error) {
        analysis.filesByFolder[subfolder.name] = `Erro: ${error.message}`;
      }
    }
  } catch (error) {
    throw error;
  }

  analysis.fileTypes = Array.from(analysis.fileTypes).sort();
  return analysis;
}

// Handlers IPC
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecione a pasta raiz'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('folder:analyze', async (event, folderPath) => {
  try {
    return await analyzeFolder(folderPath);
  } catch (error) {
    throw new Error(`Erro ao analisar pasta: ${error.message}`);
  }
});

ipcMain.handle('files:rename', async (event, folderPath, options) => {
  try {
    return await renameFilesInFolder(folderPath, options);
  } catch (error) {
    throw new Error(`Erro ao renomear arquivos: ${error.message}`);
  }
});

ipcMain.handle('files:preview', async (event, folderPath, options) => {
  try {
    return await renameFilesInFolder(folderPath, { ...options, dryRun: true });
  } catch (error) {
    throw new Error(`Erro ao gerar preview: ${error.message}`);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
