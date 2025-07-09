const express = require('express');
const axios = require('axios');
const { db, admin } = require('./database/Database');
require('dotenv').config();

const app = express();
app.use(express.json());

const userState = {};
const userTimers = {};
const userData = {};
const TIMEOUT_MS = 1 * 60 * 1000;

const VERIFY_TOKEN = process.env.MEU_TOKEN;
const TOKEN_META = process.env.TOKEN_DA_META;
const phoneNumberId = process.env.ID_NUMBER;
const PORT = process.env.PORT || 3000;

//webhook para validar e conectar na meta
app.get('/webhook', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado com sucesso!');
    res.status(200).send(challenge);
  } else {
    res.status(403);
  }
});

//função para enviar mensagens ao usuario
async function sendMessage(to, message) {
  if (!message || !message.trim()) {
    console.warn('⚠️ Tentativa de enviar mensagem vazia evitada.');
    return;
  }

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
    console.log('mensagem enviada', response.data);
  } catch (err) {
    console.log(err.response?.data || err.message);
  }
}

function limparDados(userId) {
  delete userState[userId];
  delete userData[userId];
  clearTimeout(userTimers[userId]);
  delete userTimers[userId];
}

//Inicia o ou reinicia o timer de inatividade
async function startInactivityTimer(userId, sendMessageCallback) {
  clearTimeout(userTimers[userId]);
  userTimers[userId] = setTimeout(() => {
    sendMessageCallback(
      '⏱️ Atendimento encerrado por inatividade. Se precisar, envie "oi" para começar novamente.'
    );
    limparDados(userId);
  }, TIMEOUT_MS);
}

//salvando as conversas como um doc unico no db
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

//salvando cada agendamento vinculado ao número de telefone
async function registrarAgendamento(userId, dados) {
  const docRef = db.collection('agendamentos').doc(userId).collection('agendado').doc();
  await docRef.set({
    ...dados,
    timestamp: new Date(),
  });
}

//função generica que envia os botão criados nas funções abaixo
async function enviarBotao(to, text, buttons) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: { buttons },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN_META}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ Botão enviado:', response.data);
  } catch (err) {
    console.error('❌ Erro ao enviar botão:', err.response?.data || err.message);
  }
}

//inicia o menu com o cliente
async function menuBotao(to) {
  await enviarBotao(to, '🐾 Olá! Bem-vindo ao PetShop. Escolha uma opção:', [
    { type: 'reply', reply: { id: 'banho_btn', title: '🐶 Banho' } },
    { type: 'reply', reply: { id: 'consulta_btn', title: '🩺 Consulta' } },
    { type: 'reply', reply: { id: 'atendente_btn', title: '👤 Atendente' } },
  ]);
}

//seleciona o porte do animal
async function porteBotao(to) {
  await enviarBotao(to, '🐶 Qual o porte do seu pet?', [
    { type: 'reply', reply: { id: 'porte_pequeno', title: 'Pequeno' } },
    { type: 'reply', reply: { id: 'porte_medio', title: 'Médio' } },
    { type: 'reply', reply: { id: 'porte_grande', title: 'Grande' } },
  ]);
}

//confirma as informações
async function confirmarBotao(to, portePet) {
  await enviarBotao(
    to,
    `🐾 Você escolheu Banho para pet de porte *${portePet}*.
Confirma o agendamento?`,
    [
      { type: 'reply', reply: { id: 'confirma_sim', title: 'Sim' } },
      { type: 'reply', reply: { id: 'confirma_nao', title: 'Não' } },
    ]
  );
}

//finaliza o atendimento
async function finalizaBotao(to, tipoServico) {
  await enviarBotao(to, `✅ ${tipoServico} agendado com sucesso!\nDeseja mais alguma coisa?`, [
    { type: 'reply', reply: { id: 'mais_sim', title: 'Sim' } },
    { type: 'reply', reply: { id: 'mais_nao', title: 'Não' } },
  ]);
}

app.post('/webhook', async (req, res) => {
  try {
    const change = req.body?.entry?.[0]?.changes?.[0];

    //identifica o evento messages (cliente enviou mensagem no whatsapp)
    if (change?.field === 'messages') {
      //pega a primeira mensagem enviada pelo cliente
      const message = change.value?.messages?.[0];

      //armazena o número de telefone do cliente
      const from = message?.from;

      //armazena a mensagem enviada pelo cliente
      const textRaw = message?.text?.body || '';

      //transforma e lowerCase e retira os acentos
      const clientText = textRaw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      //botão de selecao do user
      const buttonId = message?.interactive?.button_reply?.id;

      //validações para garantir que o fluxo de messagens ocorra sem erros
      if (!message || !from || (!clientText && !buttonId)) return res.sendStatus(200);

      //se for o primeiro contato, redireciona para o incio
      if (!userState[from]) userState[from] = 'inicio';

      //se for o primeiro contato, inicializa os dados do cliente
      if (!userData[from]) userData[from] = {};

      //validações de cancelamento por parte do usuario
      if (clientText === 'voltar') {
        userState[from] = 'menu';
        delete userData[from];
        await sendMessage(from, '🔙 Voltando ao menu principal...');
        await menuBotao(from);
        startInactivityTimer(from, sendMessage.bind(null, from));
        return res.sendStatus(200);
      }
      if (clientText === 'cancelar' || clientText === 'encerrar') {
        await sendMessage(from, '❌ Atendimento cancelado.');
        limparDados(from);
        return res.sendStatus(200);
      }

      let reply = '';
      await salvarConversa(from, 'usuario', clientText);

      if (buttonId) {
        switch (buttonId) {
          case 'banho_btn':
            await porteBotao(from);
            userState[from] = 'banho_porte';
            userData[from].tipoServico = 'banho';
            break;

          case 'consulta_btn':
            await sendMessage(from, '🩺 Qual o nome do seu pet para a consulta?');
            userState[from] = 'consulta_nome';
            userData[from].tipoServico = 'consulta';
            break;

          case 'atendente_btn':
            await sendMessage(from, '👤 Encaminhando para um atendente humano...');
            userState[from] = 'atendimento_humano';
            limparDados(from);
            break;

          case 'porte_pequeno':
          case 'porte_medio':
          case 'porte_grande':
            userData[from].portePet = buttonId.replace('porte_',"");
            userState[from] = 'confirmacao';
            await confirmarBotao(from, userData[from].portePet);
            break;

          case 'confirma_sim':
            await registrarAgendamento(from, userData[from]);
            userState[from] = 'finalizacao';
            await finalizaBotao(from, userData[from].tipoServico);
            break;

          case 'confirma_nao':
            await sendMessage(from, '❌ Agendamento cancelado. Voltando ao menu principal...');
            userState[from] = 'menu';
            delete userData[from];
            break;

          case 'mais_sim':
            await menuBotao(from);
            userState[from] = 'menu';
            delete userData[from];
            break;

          case 'mais_nao':
            await sendMessage(from, '🛑 Atendimento encerrado. Obrigado por usar o PetShop!');
            limparDados(from);
            break;
        }
      }else {
      switch (userState[from]) {
        case 'inicio':
          await menuBotao(from);
          userState[from] = 'menu';
          return res.sendStatus(200);

        case 'banho_porte': 
          if (/\b(pequeno|medio|grande)\b/.test(clientText)) {
            userData[from].portePet = clientText;
            userState[from] = 'confirmacao';
            await confirmarBotao(from, `Banho para pet de porte *${clientText}*`);
          } else {
            await sendMessage(from, '❗ Informe o porte do seu pet: pequeno, médio ou grande.');
          }
          break;
        

        case 'consulta_nome':
          userData[from].nomePet = clientText;
          userState[from] = 'confirmacao';
          await confirmarBotao(from, `Consulta para o pet *${clientText}*`)
          break;

        default:
          await sendMessage(from, '⚠️ Não entendi. Envie "oi" para começar novamente.');
          limparDados(from);
      }
    }
      
    if (userState[from]) startInactivityTimer(from, sendMessage.bind(null, from));
    return res.sendStatus(200);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Erro ao processar mensagem:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Bot rodando na porta http://localhost:${PORT}`);
});
