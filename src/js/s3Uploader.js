// s3Uploader.js
const AWS = require('aws-sdk');
const fs = require('fs');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

async function uploadToS3(filePath, bucketName, keyPrefix) {
    try {
        const fileStream = fs.createReadStream(filePath);
        const uploadParams = {
            Bucket: bucketName,
            Key: `${keyPrefix}/${path.basename(filePath)}`,
            Body: fileStream,
            ACL: 'public-read',
        };

        const data = await s3.upload(uploadParams).promise();
        return data.Location;
    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw error;
    }
}

module.exports = {
    uploadToS3
};
