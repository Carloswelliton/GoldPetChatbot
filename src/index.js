const express = require('express');
const axios = require('axios');
const {db, admin} = require('./database/Database');
require('dotenv').config();

const app = express();
app.use(express.json());

const userState = {};
const userTimers = {};
const userData = {};
const TIMEOUT_MS = 1*60*1000;

const VERIFY_TOKEN = process.env.MEU_TOKEN;
const TOKEN_META = process.env.TOKEN_DA_META;
const phoneNumberId = process.env.ID_NUMBER;
const PORT = process.env.PORT || 3000; 

//webhook para validar e conectar na meta
app.get('/webhook', async (req, res)=> {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if(mode ==='subscribe' && token === VERIFY_TOKEN){
    console.log('✅ Webhook verificado com sucesso!');
    res.status(200).send(challenge);
  }else{
    res.status(403);
  }
});

//função para enviar mensagens ao usuario
async function sendMessage(to, message) {

  if(!message || !message.trim()){
    console.warn('⚠️ Tentativa de enviar mensagem vazia evitada.');
    return;
  }

  try{
    await salvarConversa(to, 'bot', message);
    const response = await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {body: message},
    },
  {
    headers: {
      Authorization: `Bearer ${TOKEN_META}`,
      'Content-Type': 'application/json', 
    }
  });
  console.log('mensagem enviada', response.data);
  } catch(err){
    console.log(err.response?.data || err.message);
  }
}

//Inicia o ou reinicia o timer de inatividade
async function startInactivityTimer(userId, sendMessageCallback){
  clearTimeout(userTimers[userId]);
  userTimers[userId] = setTimeout(() => {
    sendMessageCallback('⏱️ Atendimento encerrado por inatividade. Se precisar, envie "oi" para começar novamente.');
    delete userState[userId];
    delete userData[userId];
    clearTimeout(userTimers[userId]);
    delete userTimers[userId];
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
    {merge: true}
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

app.post('/webhook', async (req, res) => {
  try{
    const change = req.body?.entry?.[0]?.changes?.[0];

    //identifica o evento messages (cliente enviou mensagem no whatsapp)
    if(change?.field === 'messages'){
      //pega a primeira mensagem enviada pelo cliente
      const message = change.value?.messages?.[0];
      //armazena o número de telefone do cliente
      const from = message?.from;
      //armazena a mensagem enviada pelo cliente
      const textRaw = message?.text?.body || '';
      //transforma e lowerCase e retira os acentos
      const clientText = textRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      //validações para garantir que o fluxo de messagens ocorra sem erros
      if(!message || !from || !clientText) return res.sendStatus(200);
      //se for o primeiro contato, redireciona para o incio
      if(!userState[from]) userState[from] = 'inicio';
      //se for o primeiro contato, inicializa os dados do cliente
      if(!userData[from]) userData[from] = {};
      //validações de cancelamento por parte do usuario
      if(clientText === 'voltar'){
        userState[from] = 'menu';
        delete userData[from];
        await sendMessage(from,'🔙 Voltando ao menu principal...\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente');
        startInactivityTimer(from, sendMessage.bind(null, from));
        return res.sendStatus(200);
      }
      if(clientText === 'cancelar'){
        await sendMessage(from, '❌ Atendimento cancelado.');
        delete userState[from];
        delete userData[from];
        clearTimeout(userTimers[from]);
        delete userTimers[from];
        return res.sendStatus(200);
      }

      let reply = '';
      await salvarConversa(from, 'usuario', clientText);

      //inicio do fluxo de mensagens no chatbot
      switch (userState[from]) {
        case 'inicio':
          reply = '🐾 Olá! Bem-vindo ao PetShop. Escolha uma opção:\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';
          userState[from] = 'menu';
          console.log('case inicio');
          break;
        case 'menu':
          if(["1", "um", "banho"].some(palavra => clientText.includes(palavra))){
            reply =  '🐶 Qual o porte do seu pet? (pequeno, médio ou grande)';
            userState[from] = 'banho_porte';
            userData[from].tipoServico = 'banho';
          }
          else if(["2", "dois", "consulta"].some(palavra => clientText.includes(palavra))){
            reply =  '🩺 Qual o nome do seu pet para a consulta?';
            userState[from] = 'consulta_nome';
            userData[from].tipoServico = 'consulta';
          }
          else if(["3", "tres", "falar com atendente", "falar", "atendente"].some(palavra => clientText.includes(palavra))){
            reply =  '👤 Encaminhando para um atendente humano...';
            userState[from] = 'atendimento_humano';
            delete userData[from];
            clearTimeout(userTimers[from]);
            delete userTimers[from];
            break;
          }
          else{
            reply = '❗ Opção inválida, por favor informe o serviço desejado';
          }
          break;
        case 'banho_porte':
          const porteAnimal = clientText.match(/\b(pequeno|medio|grande)\b/)
          if(porteAnimal){
            userData[from].portePet = porteAnimal[0];
            userState[from] = 'confirmacao';
            reply =  `🐾 Você escolheu Banho para pet de porte *${userData[from].portePet}*.\nConfirma o agendamento? (sim/não)`;
          }
          else{
            reply = '❗ Por favor digite o porte  do seu pet: pequeno, medio ou grande.';
          }
          break;
        case 'consulta_nome':
          userData[from].nomePet = clientText;
          console.log(userData[from].nomePet);
          userState[from] = 'confirmacao';
          reply = `🐾 Você escolheu Consulta para o pet *${userData[from].nomePet}*.\nConfirma o agendamento? (sim/não)`;
          break;
        case 'confirmacao':
          const respostaSim = clientText.match(/\b(sim|s|1)\b/);
          const respostaNao = clientText.match(/\b(nao|n|2)\b/);
          if(respostaSim){
            reply = `✅ ${userData[from].tipoServico} agendado com sucesso!\nDeseja mais alguma coisa?\n1️⃣ Sim\n2️⃣ Não`;
            userState[from] = 'finalizacao';
            await registrarAgendamento(from, userData[from]);
          }
          else if(respostaNao){
            reply = '❌ Agendamento cancelado. Voltando ao menu principal.\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';
            userState[from] = 'menu';
            delete userData[from];
            break;
          }
          else{
            reply = '❗ Por favor, responda com "sim" ou "não".';
          }
          break;
        case 'finalizacao':
          if(['1', 'sim','s'].includes(clientText)){
            reply = '🔁 Voltando ao menu principal...\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';
            delete userData[from];
          }
          else{
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
          break;
      }

      if(userState[from]){
        startInactivityTimer(from, sendMessage.bind(null, from));
      }

      if(reply && reply.trim()){
        await sendMessage(from, reply);
      } 

    }
    res.sendStatus(200);
  }catch(err){
    console.error('❌ Erro ao processar mensagem:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Bot rodando na porta http://localhost:${PORT}`);
});