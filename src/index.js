const express = require('express');
require('dotenv').config();

const agendamentosRoutes = require('./controller/agendamento');
const botao = require('./controller/Buttons');
const {
  handleText,
  handleButton,
  getUserState,
  setUserState,
  clearUser,
} = require('./handlers/statesHandler');
const { sendMessage } = require('./utils/sendMessage');

const app = express();
app.use(express.json());
app.use('/api', agendamentosRoutes);

const VERIFY_TOKEN = process.env.MEU_TOKEN;
const PORT = process.env.PORT || 3000;
const TIMEOUT_MS = 1 * 60 * 1000;
const userTimers = {};

// Webhook para validação
app.get('/webhook', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado com sucesso!');
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// Timer de inatividade
function startInactivityTimer(userId) {
  clearTimeout(userTimers[userId]);
  userTimers[userId] = setTimeout(() => {
    sendMessage(
      userId,
      '⏱️ Atendimento encerrado por inatividade. Envie "oi" para começar novamente.'
    );
    clearUser(userId);
  }, TIMEOUT_MS);
}

// Webhook principal
app.post('/webhook', async (req, res) => {
  try {
    const change = req.body?.entry?.[0]?.changes?.[0];
    if (change?.field !== 'messages') return res.sendStatus(200);

    const message = change.value?.messages?.[0];
    const from = message?.from;
    const textRaw = message?.text?.body || '';
    const clientText = textRaw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const buttonId = message?.interactive?.button_reply?.id;

    if (!message || !from || (!clientText && !buttonId)) return res.sendStatus(200);

    if (['cancelar', 'encerrar'].includes(clientText)) {
      await sendMessage(from, '❌ Atendimento cancelado.');
      clearUser(from);
      return res.sendStatus(200);
    }

    if (clientText === 'voltar') {
      setUserState(from, 'menu');
      await sendMessage(from, '🔙 Voltando ao menu principal...');
      await botao.menuBotao(from);
      return res.sendStatus(200);
    }

    if (buttonId) {
      await handleButton(from, buttonId);
    } else {
      await handleText(from, clientText);
    }

    startInactivityTimer(from);
    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ Erro ao processar mensagem:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Bot rodando em http://localhost:${PORT}`);
});
