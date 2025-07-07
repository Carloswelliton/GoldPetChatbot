const admin = require('firebase-admin');
const serviceAccount = require('../../chatbot-gold.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const database = admin.firestore();
module.exports = database;
module.exports.admin = admin;
