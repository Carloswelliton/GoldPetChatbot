const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();
const { db, admin } = require('./database/Database');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.MEU_TOKEN;
const TOKEN_META = process.env.TOKEN_DA_META;
const phoneNumberId = process.env.ID_NUMBER;
const port = process.env.PORT || 3000;

const userState = {};
const userTimers = {};
const userData = {};
const TIMEOUT_MS = 2 * 60 * 1000;

console.log('📦 Firebase DB:', typeof db);

// Inicia ou reinicia o timer de inatividade
function startInactivityTimer(userId, sendMessageCallback) {
  clearTimeout(userTimers[userId]);

  userTimers[userId] = setTimeout(() => {
    sendMessageCallback(
      '⏱️ Atendimento encerrado por inatividade. Se precisar, envie "oi" para começar novamente.'
    );
    delete userState[userId];
    delete userData[userId];
    clearTimeout(userTimers[userId]);
    delete userTimers[userId];
  }, TIMEOUT_MS);
}

// Salva a mensagem no histórico da conversa do usuário
async function salvarConversa(userId, quem, mensagem) {
  const docRef = db.collection('conversas').doc(userId);

  await docRef.set(
    {
      historico: admin.firestore.FieldValue.arrayUnion({
        quem,
        mensagem,
        timestamp: new Date(),
      }),
    },
    { merge: true }
  );
}

// Cria um novo documento de agendamento
async function registrarAgendamento(userId, dados) {
  const docRef = db
    .collection('agendamentos')
    .doc(userId)
    .collection('agendado')
    .doc();

  await docRef.set({
    ...dados,
    timestamp: new Date(),
  });
}

// Função para enviar mensagens
async function sendMessage(to, message) {
  try {
    await salvarConversa(to, 'bot', message);
    const response = await axios.post(
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
    console.log('✅ Mensagem enviada:', response.data);
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err.response?.data || err.message);
  }
}

// Verificação do webhook
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

// Manipulação de mensagens recebidas
app.post('/webhook', async (req, res) => {
  try {
    const change = req.body?.entry?.[0]?.changes?.[0];

    if (change?.field === 'messages') {
      const message = change.value?.messages?.[0];
      const from = message?.from;
      const userText = message?.text?.body?.toLowerCase();

      if (!message || !from || !userText) return res.sendStatus(200);

      await salvarConversa(from, 'usuario', userText);

      if (!userState[from]) userState[from] = 'inicio';
      if (!userData[from]) userData[from] = {};

      if (userText === 'voltar') {
        userState[from] = 'menu';
        delete userData[from];
        await sendMessage(
          from,
          '🔙 Voltando ao menu principal...\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente'
        );
        startInactivityTimer(from, sendMessage.bind(null, from));
        return res.sendStatus(200);
      }

      if (userText === 'cancelar') {
        await sendMessage(from, '❌ Atendimento cancelado.');
        delete userState[from];
        delete userData[from];
        clearTimeout(userTimers[from]);
        delete userTimers[from];
        return res.sendStatus(200);
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
            userData[from].tipoServico = 'Banho';
          } else if (userText.includes('2')) {
            reply = '🩺 Qual o nome do seu pet para a consulta?';
            userState[from] = 'consulta_nome';
            userData[from].tipoServico = 'Consulta';
          } else if (userText.includes('3')) {
            reply = '👤 Encaminhando para um atendente humano...';
            userState[from] = 'atendimento_humano';
            delete userData[from];
          } else {
            reply = '❗ Opção inválida. Digite 1, 2 ou 3.';
          }
          break;

        case 'banho_porte':
          if (['pequeno', 'médio', 'medio', 'grande'].some((p) => userText.includes(p))) {
            userData[from].portePet = userText.match(/pequeno|médio|medio|grande/)[0];
            userState[from] = 'confirmacao';
            reply = `🐾 Você escolheu Banho para pet de porte *${userData[from].portePet}*.\nConfirma o agendamento? (sim/não)`;
          } else {
            reply = '❗ Por favor, digite o porte do seu pet: pequeno, médio ou grande.';
          }
          break;

        case 'consulta_nome':
          userData[from].nomePet = userText;
          userState[from] = 'confirmacao';
          reply = `🐾 Você escolheu Consulta para o pet *${userData[from].nomePet}*.\nConfirma o agendamento? (sim/não)`;
          break;

        case 'confirmacao':
          const respostasSim = ['sim', 's', '1'];
          const respostasNao = ['não', 'nao', 'n', '2'];

          if (respostasSim.includes(userText)) {
            reply = `✅ ${userData[from].tipoServico} agendado com sucesso!\nDeseja mais alguma coisa?\n1️⃣ Sim\n2️⃣ Não`;
            userState[from] = 'finalizacao';

            // Registro do agendamento
            await registrarAgendamento(from, userData[from]);
          } else if (respostasNao.includes(userText)) {
            reply =
              '❌ Agendamento cancelado. Voltando ao menu principal.\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';
            userState[from] = 'menu';
            delete userData[from];
          } else {
            reply = '❗ Por favor, responda com "sim" ou "não".';
          }
          break;

        case 'finalizacao':
          if (['1', 'sim', 's'].includes(userText)) {
            reply =
              '🔁 Voltando ao menu principal...\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';
            userState[from] = 'menu';
            delete userData[from];
          } else {
            reply = '🛑 Atendimento encerrado. Obrigado por usar o PetShop!';
            delete userState[from];
            delete userData[from];
            clearTimeout(userTimers[from]);
            delete userTimers[from];
          }
          break;

        default:
          reply = '⚠️ Não entendi. Envie "oi" para começar novamente.';
          delete userState[from];
          delete userData[from];
          clearTimeout(userTimers[from]);
          delete userTimers[from];
      }

      await sendMessage(from, reply);

      if (userState[from]) {
        startInactivityTimer(from, sendMessage.bind(null, from));
      }
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
