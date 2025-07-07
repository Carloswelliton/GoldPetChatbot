const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();


const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.MEU_TOKEN;
const TOKEN_META = process.env.TOKEN_DA_META; 
const phoneNumberId = process.env.ID_NUMBER;
const port = process.env.PORT || 3000;

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



const userState = {}; 

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

      if (!userState[from]) {
        userState[from] = 'inicio';
      }

      let reply = '';

      switch (userState[from]) {
        case 'inicio':
          reply =
            '🐾 Olá! Bem-vindo ao PetShop. Escolha uma opção:\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';
          userState[from] = 'menu';
          break;

        case 'menu':
          if (userText.includes('1')) {
            reply = '🐶 Qual o porte do seu pet? (pequeno, médio ou grande)';
            userState[from] = 'banho_porte';
          } else if (userText.includes('2')) {
            reply = '🩺 Qual o nome do seu pet para a consulta?';
            userState[from] = 'consulta_nome';
          } else if (userText.includes('3')) {
            reply = '👤 Encaminhando para um atendente humano...';
            userState[from] = 'atendimento_humano';
          } else {
            reply = '❗ Opção inválida. Digite 1, 2 ou 3.';
          }
          break;

        case 'banho_porte':
          if (['pequeno', 'médio', 'medio', 'grande'].some(p => userText.includes(p))) {
            reply = `✅ Banho para pet de porte *${userText}* agendado! Deseja mais alguma coisa?\n1️⃣ Sim\n2️⃣ Não`;
            userState[from] = 'finalizacao';
          } else {
            reply = '❗ Por favor, digite o porte do seu pet: pequeno, médio ou grande.';
          }
          break;

        case 'consulta_nome':
          reply = `✅ Consulta agendada para *${userText}*.\nDeseja mais alguma coisa?\n1️⃣ Sim\n2️⃣ Não`;
          userState[from] = 'finalizacao';
          break;

        case 'finalizacao':
          if (userText.includes('1')) {
            reply =
              '🔁 Voltando ao menu principal...\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';
            userState[from] = 'menu';
          } else {
            reply = '🛑 Atendimento encerrado. Obrigado por usar o PetShop!';
            delete userState[from];
          }
          break;

        default:
          reply = '⚠️ Não entendi sua mensagem. Por favor, digite "oi" para começar de novo.';
          delete userState[from];
      }

      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: { body: reply },
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN_META}`,
            'Content-Type': 'application/json',
          },
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

app.listen(port, () => {
  console.log(`🚀 Bot rodando na porta ${port}`);
});
