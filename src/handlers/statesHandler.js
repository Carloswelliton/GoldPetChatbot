const botao = require('../controller/Buttons');
const { registrarAgendamento } = require('../utils/firestore');
const { validarCpf } = require('../utils/cpfCheck');
const { sendMessage } = require('../utils/sendMessage');

const userState = {};
const userData = {};

function getUserState(userId) {
  if (!userState[userId]) userState[userId] = 'inicio';
  if (!userData[userId]) userData[userId] = {};
  return userState[userId];
}

function setUserState(userId, state) {
  userState[userId] = state;
}

function getUserData(userId) {
  return userData[userId];
}

function clearUser(userId) {
  delete userState[userId];
  delete userData[userId];
}

async function handleText(userId, text) {
  const state = getUserState(userId);
  const data = getUserData(userId);

  switch (state) {
    case 'inicio':
      await botao.menuBotao(userId);
      setUserState(userId, 'menu');
      break;

    case 'cpf':
      if (!validarCpf(text)) {
        await sendMessage(userId, '❌ CPF inválido. Tente novamente.');
        return;
      }
      data.cpf = text;
      await sendMessage(userId, 'Informe o seu nome completo');
      setUserState(userId, 'nome');
      break;

    case 'nome':
      data.nome = text;
      await sendMessage(userId, 'Qual o seu CEP?');
      setUserState(userId, 'cep');
      break;

    case 'cep':
      data.cep = text;
      await sendMessage(userId, 'Informe o seu endereço (rua, número, bairro)');
      setUserState(userId, 'endereco');
      break;

    case 'endereco':
      data.endereco = text;
      await sendMessage(userId, 'Entre quais ruas?');
      setUserState(userId, 'entre_ruas');
      break;

    case 'entre_ruas':
      data.entreRuas = text;
      await sendMessage(userId, 'Informe um ponto de referência');
      setUserState(userId, 'referencia');
      break;

    case 'referencia':
      data.referencia = text;
      await sendMessage(userId, 'Qual o nome do pet?');
      setUserState(userId, 'nome_pet');
      break;

    case 'nome_pet':
      data.nome_pet = text;
      await sendMessage(userId, 'Qual a data de nascimento do pet?');
      setUserState(userId, 'nascimento_pet');
      break;

    case 'nascimento_pet':
      data.nascimento_pet = text;
      await sendMessage(userId, 'Qual a raça do pet?');
      setUserState(userId, 'raca');
      break;

    case 'raca':
      data.raca = text;
      await sendMessage(userId, 'Qual a cor da pelagem?');
      setUserState(userId, 'pelagem');
      break;

    case 'pelagem':
      data.pelagem = text;
      await botao.finalizaBotao(userId, data.tipoServico);
      setUserState(userId, 'aguardando_confirmacao');
      break;
  }
}

async function handleButton(userId, buttonId) {
  const data = getUserData(userId);

  switch (buttonId) {
    case 'servico_btn':
      await botao.agendamentoBotao(userId);
      break;

    case 'agendamento_btn':
      await botao.consultaBotao(userId);
      break;

    case 'banho_btn':
    case 'consulta_btn':
      data.tipoServico = buttonId.replace('_btn', '');
      await sendMessage(userId, 'Informe o seu CPF');
      setUserState(userId, 'cpf');
      break;

    case 'mais_sim':
      await botao.menuBotao(userId);
      setUserState(userId, 'menu');
      break;

    case 'mais_nao':
      await registrarAgendamento(data.cpf, data);
      await sendMessage(userId, '✅ Agendado com sucesso. Obrigado por usar o PetShop!');
      clearUser(userId);
      break;
  }
}

module.exports = {
  handleText,
  handleButton,
  getUserState,
  setUserState,
  getUserData,
  clearUser,
};
