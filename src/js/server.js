// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { applyWatermark } = require('./src/js/imageProcessor'); // Path to your image processor script

const app = express();
const upload = multer({ dest: 'tmp/original/' }); // Temporary storage for uploaded files

app.post('/processImages', upload.array('images'), async (req, res) => {
    try {
        const isFree = req.body.isFree === 'true';
        const imageFolderRoot = path.join(__dirname, 'tmp');
        const watermarkPath = path.join(__dirname, 'path_to_watermark.png'); // Replace with your watermark image path
        const imageFiles = req.files.map(file => file.path);

        let processedFiles = imageFiles;

        if (!isFree) {
            // Apply watermark if the event is not free
            processedFiles = await applyWatermark(imageFolderRoot, processedFiles, watermarkPath);
        }

        res.status(200).send({ message: 'Files processed successfully!' });
    } catch (error) {
        console.error('Error during processing:', error);
        res.status(500).send({ error: 'An error occurred during processing.' });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
