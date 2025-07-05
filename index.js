
  const express = require('express');
  const bodyParser = require('body-parser');
  const axios = require('axios');

  const app = express();
  app.use(bodyParser.json());

  const VERIFY_TOKEN = 'meu_token_secreto_petshop';
  const TOKEN_META =
    'EACLDBfzMWBkBPF04OFRDVZBdMqzPjZBhxKVYV8DaMuHoI2tGjovFThpVNHviHAMbwsAKCiC7CmJREKZCXWZBPZCZCWbF6qgZA1ajjQ72BlhDH0ZAgZAYAN3OAkIRE6aGWIXRfwCVIkZCSUwvorydgBGovS2TVJbhRmKo4Oa4XnPZArd7apiWcl0Np3bDYZC4gTLlHFbc5OKOuuZBNMIGDYRBW6SZAHOxOh49rkoRXwNwHUExXFLZCIZD'; // token da API do WhatsApp
  const phoneNumberId = '694324243763743';
  const PORT = 3000;

// Verificação do webhook (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado com sucesso!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recebimento de mensagens (POST)
app.post('/webhook', async (req, res) => {
  console.log('📥 Requisição recebida:\n', JSON.stringify(req.body, null, 2));

  try {
    const change = req.body?.entry?.[0]?.changes?.[0];

    if (change.field === 'messages') {
      const message = change.value?.messages?.[0];
      const from = message?.from;
      const userText = message?.text?.body?.toLowerCase();

      if (!message || !from || !userText) return res.sendStatus(200);

      console.log('📨 Mensagem recebida:', userText);

      let reply = 'Olá! Bem-vindo ao PetShop. Digite:\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';

      if (userText.includes('banho')) {
        reply = '🐶 Entendi! Você deseja agendar um banho para seu pet. Qual o porte do animal?';
      } else if (userText.includes('consulta')) {
        reply = '🩺 Ok! Para agendar uma consulta veterinária, por favor, informe o nome do seu pet.';
      } else if (userText.includes('atendente')) {
        reply = '👤 Certo! Encaminhando para um atendente humano...';
      }

      // Envio da resposta para o WhatsApp
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: { body: reply }
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN_META}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Mensagem enviada:', response.data);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Erro ao processar mensagem:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Bot rodando na porta ${PORT}`);
});