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
const userTimers = {};
const userData = {}; // Para armazenar dados temporários (porte do pet, nome do pet, tipo de serviço)

const TIMEOUT_MS = 2 * 60 * 1000; // Tempo limite de inatividade: 2 minutos

function startInactivityTimer(userId, sendMessageCallback) {
  clearTimeout(userTimers[userId]);

  userTimers[userId] = setTimeout(() => {
    sendMessageCallback(
      '⏱️ Atendimento encerrado por inatividade. Se precisar, envie "oi" para começar novamente.'
    );
    delete userState[userId];
    delete userTimers[userId];
    delete userData[userId];
  }, TIMEOUT_MS);
}

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
      if (!userData[from]) {
        userData[from] = {};
      }

      // **TRATAR COMANDOS GLOBAIS "voltar" e "cancelar"**
      if (userText === 'voltar') {
        userState[from] = 'menu';
        delete userData[from]; // limpa dados temporários
        await sendMessage(
          from,
          '🔙 Voltando ao menu principal...\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente'
        );
        startInactivityTimer(from, sendMessage.bind(null, from));
        return res.sendStatus(200);
      }
      if (userText === 'cancelar') {
        await sendMessage(
          from,
          '❌ Atendimento cancelado. Se precisar, envie "oi" para começar novamente.'
        );
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
            userData[from].portePet = userText.match(/pequeno|médio|medio|grande/)[0]; // salva o porte
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
            // Confirmação positiva — finaliza agendamento
            reply = `✅ ${userData[from].tipoServico} agendado com sucesso!`;
            reply += '\nDeseja mais alguma coisa?\n1️⃣ Sim\n2️⃣ Não';
            userState[from] = 'finalizacao';
          } else if (respostasNao.includes(userText)) {
            // Confirmação negativa — volta ao menu para refazer
            reply =
              '❌ Agendamento cancelado. Voltando ao menu principal.\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';
            userState[from] = 'menu';
            delete userData[from];
          } else {
            reply = '❗ Por favor, responda com "sim" ou "não".';
          }
          break;

        case 'finalizacao':
          const respostasSimFinal = ['1', 'sim', 's'];
          if (respostasSimFinal.includes(userText)) {
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
          reply = '⚠️ Não entendi sua mensagem. Por favor, digite "oi" para começar de novo.';
          delete userState[from];
          delete userData[from];
          clearTimeout(userTimers[from]);
          delete userTimers[from];
      }

      // Envia a resposta ao usuário
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

      // Inicia o timer após enviar a mensagem, se o usuário ainda estiver ativo
      if (userState[from]) {
        startInactivityTimer(from, async (msg) => {
          try {
            await axios.post(
              `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
              {
                messaging_product: 'whatsapp',
                to: from,
                type: 'text',
                text: { body: msg },
              },
              {
                headers: {
                  Authorization: `Bearer ${TOKEN_META}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            console.log(`⏱️ Timer expirado: conversa encerrada com ${from}`);
          } catch (err) {
            console.error(
              '❌ Erro ao enviar mensagem por inatividade:',
              err.response?.data || err.message
            );
          }
        });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Erro ao processar mensagem:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

async function sendMessage(to, message) {
  try {
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

app.listen(port, () => {
  console.log(`🚀 Bot rodando na porta ${port}`);
});
