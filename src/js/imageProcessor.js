const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

const thumbPx = 250;
const fullPx = 800;
const originalMaxSize = 4000;

async function processImages(imageFiles, imageFolderRoot, watermarkPath, applyWatermarkFlag) {
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
        // Skip non-image files
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

module.exports = {
    processImages
};
