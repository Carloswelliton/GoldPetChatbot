const botao = require('../controller/Buttons');
const { registrarAgendamento } = require('../utils/firestore');
const { validarCpf } = require('../utils/cpfCheck');
const { sendMessage } = require('../utils/sendMessage');
const axios = require('axios');
const { text } = require('body-parser');
const admin = require('firebase-admin');

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

function limparDados(userId) {
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
      data.cpf = text.replace(/[^0-9]/g, '');
      try {
        const response = await axios.get(
          `http://localhost:3000/api/agendamentos/existe/${data.cpf}`
        );
        if (response.data.existe) {
          const cadastro = response.data.dados;
          Object.assign(data, cadastro);
          await sendMessage(userId, '📋 Cadastro localizado!');
          await sendMessage(userId, 'Qual o nome do pet?');
          setUserState(userId, 'nome_pet');
          return;
        }
      } catch (error) {
        console.error('❌ Erro ao verificar agendamento:', error.message);
        await sendMessage(
          userId,
          '⚠️ CPF não encontrado na base de dados, vamos prosseguir com o seu cadastro.'
        );
      }
      await sendMessage(userId, 'Informe o seu nome completo');
      setUserState(userId, 'nome');
      break;

    case 'nome':
      data.nome = text;
      await sendMessage(userId, 'Qual o seu CEP? (ex: 79331-050)');
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
      await sendMessage(userId, 'Qual a data de nascimento do pet? (ex: 01/01/2025)');
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
      await sendMessage(userId, 'Qual a data desejada para o agendamento? (ex: 14/07/2025)');
      setUserState(userId, 'data_agendamento');
      break;

    case 'data_agendamento':
      data.data = text; 
      await botao.finalizaBotao(userId, data.tipoServico);
      setUserState(userId, 'aguardando_confirmacao');
      break;

    case 'aguardando_cpf_cancelamento':
      const cpfLimpo = text.replace(/\D/g, '');
      if (!validarCpf(cpfLimpo)) {
        await sendMessage(userId, '❌ CPF inválido. Tente novamente.');
        return;
      }

      try {
        const response = await axios.get(
          `http://localhost:3000/api/agendamentos/futuros/${cpfLimpo}`
        );
        const agendamentos = response.data.agendamentos;

        if (!agendamentos.length) {
          await sendMessage(userId, '⚠️ Nenhum agendamento futuro encontrado.');
          return;
        }

        // salvar CPF e lista para o próximo passo
        userData[userId].cpf = cpfLimpo;
        userData[userId].agendamentos = agendamentos;

        // criar lista para usuário escolher
        let texto = '📅 Agendamentos encontrados:\n\n';
        agendamentos.forEach((a, i) => {
          const dataFormatada = new Date(a.data._seconds * 1000).toLocaleDateString('pt-BR');
          texto += `${i + 1}. ${a.tipoServico} - ${dataFormatada} (${a.nome_pet})\n`;
        });
        texto += '\nDigite o número do agendamento que deseja cancelar.';

        await sendMessage(userId, texto);
        setUserState(userId, 'aguardando_confirmar_cancelamento');
      } catch (err) {
        console.error('Erro ao buscar agendamentos:', err.message);
        await sendMessage(userId, '❌ Erro ao buscar agendamentos.');
      }
      break;

    case 'aguardando_confirmar_cancelamento':
      const index = parseInt(text.trim()) - 1;
      const lista = userData[userId].agendamentos;
      const cpf = userData[userId].cpf;

      if (isNaN(index) || index < 0 || index >= lista.length) {
        await sendMessage(userId, '❌ Escolha inválida. Tente novamente.');
        return;
      }

      const agendamentoSelecionado = lista[index];
      try {
        await axios.delete(
          `http://localhost:3000/api/agendamentos/${cpf}/${agendamentoSelecionado.id}`
        );
        await sendMessage(userId, '✅ Agendamento cancelado com sucesso!');
        limparDados(userId);
      } catch (err) {
        console.error('Erro ao cancelar:', err.message);
        await sendMessage(userId, '❌ Falha ao cancelar. Tente novamente.');
      }
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
      await sendMessage(userId, 'Informe o seu CPF (somente os numeros)');
      setUserState(userId, 'cpf');
      break;

    case 'mais_sim':
      await botao.menuBotao(userId);
      setUserState(userId, 'menu');
      break;

    case 'mais_nao':
      
      // Converter a data string para Timestamp
      const [dia, mes, ano] = data.data.split('/');
      const dataAgendada = new Date(`${ano}-${mes}-${dia}`);
      data.data = admin.firestore.Timestamp.fromDate(dataAgendada);
      await registrarAgendamento(data.cpf, data);
      await sendMessage(userId, '✅ Agendado com sucesso. Obrigado por usar o PetShop!');
      limparDados(userId);
      break;

    case 'cancelar_agendamento':
      await sendMessage(userId, 'Informe o seu CPF (somente os números)');
      setUserState(userId, 'aguardando_cpf_cancelamento'); 
      break;

    
  }
}

module.exports = {
  handleText,
  handleButton,
  getUserState,
  setUserState,
  getUserData,
  limparDados,
};
