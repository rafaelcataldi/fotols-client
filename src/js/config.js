const isProduction = false; // Change this to true in production

const baseUrl = isProduction ? 'https://fotols.com' : 'http://localhost:8888';

module.exports = {
    baseUrl
};