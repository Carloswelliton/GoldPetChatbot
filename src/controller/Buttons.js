const axios = require('axios');
require('dotenv').config();

const TOKEN_META = process.env.TOKEN_DA_META;
const phoneNumberId = process.env.ID_NUMBER;

async function enviarBotao(to, text, buttons) {
  try {
    await axios.post(
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
  } catch (err) {
    console.error('❌ Erro ao enviar botão:', err.response?.data || err.message);
  }
}

async function menuBotao(to) {
  await enviarBotao(to, '🐾 Olá! Bem-vindo(a) ao Gold Pet. Escolha uma opção:', [
    { type: 'reply', reply: { id: 'servico_btn', title: '📆 Agendamento' } },
    { type: 'reply', reply: { id: 'atendente_btn', title: '👤 Atendente' } },
    { type: 'reply', reply: { id: 'outros_btn', title: '🐾 Preços e serviços' } },
  ]);
}

async function agendamentoBotao(to) {
  await enviarBotao(to, 'Selecione o tipo de serviço que deseja', [
    { type: 'reply', reply: { id: 'agendamento_btn', title: '🐶🩺Banho/Consulta' } },
    { type: 'reply', reply: { id: 'consultar_agendamento', title: 'Consulta agendamento' } },
    { type: 'reply', reply: { id: 'cancelar_agendamento', title: 'Cancelar agendamento' } },
  ]);
  
}

async function consultaBotao(to) {
  await enviarBotao(to, 'Selecione qual o tipo de serviço você deseja:', [
    { type: 'reply', reply: { id: 'banho_btn', title: '🛁 Banho' } },
    { type: 'reply', reply: { id: 'consulta_btn', title: '🩺 Consulta' } },
  ]);
}

async function finalizaBotao(to, tipoServico) {
  await enviarBotao(to, `✅ ${tipoServico} agendado com sucesso!\nDeseja mais alguma coisa?`, [
    { type: 'reply', reply: { id: 'mais_sim', title: 'Sim' } },
    { type: 'reply', reply: { id: 'mais_nao', title: 'Não' } },
  ]);
}

module.exports = {
  menuBotao,
  consultaBotao,
  finalizaBotao,
  agendamentoBotao,
};
