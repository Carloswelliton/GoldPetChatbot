const axios = require('axios');
const { salvarConversa } = require('./firestore');
require('dotenv').config();

const TOKEN_META = process.env.TOKEN_DA_META;
const phoneNumberId = process.env.ID_NUMBER;

async function sendMessage(to, message) {
  if (!message || !message.trim()) return;

  try {
    await salvarConversa(to, 'bot', message);
    await axios.post(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN_META}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err.response?.data || err.message);
  }
}

module.exports = {
  sendMessage,
};
