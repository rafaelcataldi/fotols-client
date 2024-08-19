const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { processImages } = require('./imageProcessor');
const { baseUrl } = require('./config'); // Import baseUrl

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../js/preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    win.loadFile(path.join(__dirname, '../html/login.html'));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('process-images', async (event, { isFree, directory, eventId, description, tag, email }) => {
    const imageFolderRoot = path.join(__dirname, '../tmp');
    const watermarkPath = path.join(__dirname, '../img/watermarks/watermark1.png');

    try {
        console.log("Received directory files:", directory);

        let processedDirectory = directory.filter(file => {
            if (typeof file === 'string' && file.endsWith('.jpg')) {
                return true;
            }
            console.error('Invalid file object:', file);
            return false;
        });

        console.log("Processed directory paths:", processedDirectory);

        if (processedDirectory.length > 0) {

            const price = 0; // Replace with dynamic price, e.g., from the form
            const name = description;
            const date = '';
            const place = ''; // Replace with dynamic place
            const tags = tag;

            const uploadPackDetails = {
                eventId,
                email,
                price,
                name,
                date,
                place,
                tags
            };

            const uploadPackId = await processImages(processedDirectory, imageFolderRoot, watermarkPath, !isFree, uploadPackDetails);
            console.log('Upload Pack created with ID:', uploadPackId);
        } else {
            console.error('No valid files to process.');
        }

        event.sender.send('processing-status', { message: 'All files processed successfully!' });
        event.sender.send('processing-complete', 'Processing complete. Ready for next step.');
    } catch (error) {
        console.error('Error during processing:', error);
        event.sender.send('processing-complete', 'An error occurred during processing.');
    }
});

ipcMain.on('stop-processing', () => {
    console.log('Processing stopped by user.');
});
