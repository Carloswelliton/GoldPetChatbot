const admin = require('firebase-admin');
require('dotenv').config();

admin.initializeApp({
  credential: admin.credential.cert({
    type: 'service_account',
    projectId: 'chatbot-goldpet',
    privateKeyId: process.env.PRIVATE_KEY_ID,
    privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.CLIENT_EMAIL,
    authUri: process.env.AUTH_URI,
    tokenUri: process.env.TOKEN_URI,
    authProviderX509CertUrl: process.env.AUTH_PROVIDER_CERT_URL,
    clientC509CertUrl: process.env.CLIENT_CERT_URL,
    universeDomain: process.env.UNIVERSE_DOMAIN,
  }),
});

const db = admin.firestore();
module.exports = { db, admin };
