const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
const axios = require('axios');
const { baseUrl } = require('./config'); // Import baseUrl from config.js

const thumbPx = 250;
const fullPx = 800;
const originalMaxSize = 4000;

async function processImages(imageFiles, imageFolderRoot, watermarkPath, applyWatermarkFlag, uploadPackDetails) {
    const fullFolder = path.join(imageFolderRoot, 'full');
    const thumbFolder = path.join(imageFolderRoot, 'thumb');
    const originalFolder = path.join(imageFolderRoot, 'original');

    [fullFolder, thumbFolder, originalFolder].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });

    let modifiedWatermarkPath = null;
    if (applyWatermarkFlag) {
        console.log('Preparing watermark...');
        modifiedWatermarkPath = await prepareWatermark(watermarkPath, imageFolderRoot);
        if (!modifiedWatermarkPath) {
            console.error('Failed to prepare watermark.');
            return;
        }
    }

    const tasks = imageFiles.map(async (filePath, index) => {
        if (!filePath.match(/\.(jpg|jpeg|png|gif)$/i)) {
            console.warn(`Skipping non-image file: ${filePath}`);
            return;
        }

        const newName = `image_${index + 1}.jpg`;
        const fullImagePath = path.join(fullFolder, newName);
        const thumbImagePath = path.join(thumbFolder, newName);
        const originalImagePath = path.join(originalFolder, newName);

        let image = sharp(filePath).withMetadata();

        const metadata = await image.metadata();
        const isVertical = metadata.height > metadata.width;

        const fullResizeOptions = { width: isVertical ? undefined : fullPx, height: isVertical ? fullPx : undefined };
        const thumbResizeOptions = { width: isVertical ? undefined : thumbPx, height: isVertical ? thumbPx : undefined };

        if (applyWatermarkFlag && modifiedWatermarkPath) {
            console.log(`Applying watermark to: ${fullImagePath}`);
            try {
                await image
                    .resize(fullResizeOptions)
                    .composite([{ input: modifiedWatermarkPath, blend: 'over', tile: true }])
                    .toFile(fullImagePath);
                console.log(`Watermark applied to: ${fullImagePath}`);
            } catch (err) {
                console.error(`Error applying watermark to ${fullImagePath}:`, err);
            }
        } else {
            await image.clone().resize(fullResizeOptions).toFile(fullImagePath);
        }

        await image.clone().resize(thumbResizeOptions).toFile(thumbImagePath);

        const buffer = await image.toBuffer();
        await adjustQualityToFitFileSize(buffer, originalImagePath, originalMaxSize);
    });

    await Promise.all(tasks);
    console.log('All images processed successfully.');

    // After processing images, create the upload pack
    const uploadPackId = await uploadPack(
        uploadPackDetails.eventId,
        uploadPackDetails.email,
        uploadPackDetails.price,
        uploadPackDetails.name,
        uploadPackDetails.date,
        uploadPackDetails.place,
        uploadPackDetails.tags
    );

    console.log('Upload Pack created with ID:', uploadPackId);
    return uploadPackId;
}

async function prepareWatermark(watermarkPath, imageFolderRoot) {
    const modifiedWatermarkPath = path.join(imageFolderRoot, 'modified_watermark.png');

    return new Promise((resolve, reject) => {
        sharp(watermarkPath)
            .ensureAlpha()
            .raw()
            .toBuffer((err, buffer, info) => {
                if (err) return reject(err);

                const watermarkOpacity = 0.3;
                for (let i = 0; i < buffer.length; i += 4) {
                    buffer[i + 3] = buffer[i + 3] * watermarkOpacity;
                }

                sharp(buffer, {
                    raw: {
                        width: info.width,
                        height: info.height,
                        channels: 4
                    }
                })
                .toFile(modifiedWatermarkPath, err => {
                    if (err) {
                        console.error('Error preparing watermark image:', err);
                        return reject(err);
                    }
                    console.log('Modified watermark prepared at:', modifiedWatermarkPath);
                    resolve(modifiedWatermarkPath);
                });
            });
    });
}

async function adjustQualityToFitFileSize(buffer, outputPath, maxFileSizeKB) {
    let quality = 95;
    while (quality > 10) {
        const result = await sharp(buffer).jpeg({ quality }).toBuffer();

        if (result.length / 1024 <= maxFileSizeKB) {
            await fs.promises.writeFile(outputPath, result);
            console.log(`Achieved target size of ${maxFileSizeKB}KB at quality ${quality} for ${path.basename(outputPath)}`);
            return;
        }
        quality -= 5;
    }
    console.log(`Could not reduce file size to below ${maxFileSizeKB}KB for ${path.basename(outputPath)}`);
}

// Upload Pack function to be used after resizing images
async function uploadPack(eventId, email, price, name, date, place, tags) {
    const fotolsCode = '1eventols23'; // Replace with your actual code

    try {
        const response = await axios.get(`${baseUrl}/uploader/uploadPack`, {
            params: {
                code: fotolsCode,
                eventId: eventId,
                email: email,
                price: price,
                name: name,
                date: date,
                place: place,
                tags: tags
            }
        });

        const uploadPackResponse = response.data;

        if (uploadPackResponse && uploadPackResponse.uploadPackId) {
            console.log("Upload Pack ID:", uploadPackResponse.uploadPackId);
            return uploadPackResponse.uploadPackId;
        } else {
            throw new Error('Upload pack ID not found in response');
        }

    } catch (error) {
        console.error("Failed to upload pack:", error);
        throw error; // Optional: re-throw the error if you want calling functions to handle it
    }
}

module.exports = {
    processImages
};
