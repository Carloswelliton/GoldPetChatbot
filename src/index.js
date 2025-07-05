const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();
const db = require('./database/Database');
const admin = require('./database/Database').admin;
const app = express();

const VERIFY_TOKEN = process.env.MEU_TOKEN;
const TOKEN_META = process.env.TOKEN_DA_META;
const phoneNumberId = process.env.ID_NUMBER;
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

//endpoint para validar a API na META 
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

//Inicio da interação com o usuário
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

      // indica em qual estado o ususario está
      const userRef = db.collection('usuarios').doc(from);

      //armazena o que o usuario digitou
      const userDoc = await userRef.get();

      //inicia o estado para dar u
      let estado = userDoc.exists ? userDoc.data().estado : 'menu';

      let reply = '';

      // Controle de fluxo
      switch (estado) {
        case 'menu':
          if (["1", "um", "banho"].some(input => userText.includes(input))) {
            await userRef.set({ estado: 'banho_porte' });
            reply = '🐶 Qual o porte do seu pet? (pequeno, médio ou grande)';
          } 
          else if (userText.includes('2')) {
            await userRef.set({ estado: 'consulta_nome' });
            reply = '🩺 Qual o nome do seu pet para a consulta?';
          } 
          else if (userText.includes('3')) {
            reply = '👤 Encaminhando para um atendente humano...';
            break;
          } 
          else {
            reply =
              '🐾 Olá! Bem-vindo ao PetShop. Escolha uma opção:\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';
          }
          break;

        case 'banho_porte':
          reply = `✅ Banho agendado para pet de porte *${userText}*.\nDeseja algo mais?\n1️⃣ Sim\n2️⃣ Não`;
          await userRef.set({ estado: 'finalizacao' });
          break;

        case 'consulta_nome':
          reply = `✅ Consulta agendada para *${userText}*.\nDeseja algo mais?\n1️⃣ Sim\n2️⃣ Não`;
          await userRef.set({ estado: 'finalizacao' });
          break;

        case 'finalizacao':
          if (userText.includes('1')) {
            reply = '🔁 Voltando ao menu...\n1️⃣ Banho\n2️⃣ Consulta\n3️⃣ Falar com atendente';
            await userRef.set({ estado: 'menu' });
          } else {
            reply = '🛑 Atendimento encerrado. Obrigado por usar o PetShop!';
            await userRef.delete();
            break;
          }
          break;

        default:
          reply = '⚠️ Algo deu errado. Digite "oi" para reiniciar.';
          await userRef.set({ estado: 'menu' });
      }

      // Salva histórico da conversa
      const conversaRef = db.collection('conversas').doc(from);
      const novaMensagem = {
        texto: userText,
        tipo: 'usuario',
        timestamp: new Date(),
      };

      const conversaDoc = await conversaRef.get();

      //atualiza a conversa se o número de telefone ja existir no bd
      if (conversaDoc.exists) {
        await conversaRef.update({
          atualizadoEm: new Date(),
          mensagens: admin.firestore.FieldValue.arrayUnion(novaMensagem),
        });
      } else {
        await conversaRef.set({
          numero: from,
          atualizadoEm: new Date(),
          mensagens: [novaMensagem],
        });
      }

      // Envia a resposta ao WhatsApp
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

      await db.collection('conversas').doc(from).collection('mensagens').add({
        resposta: reply,
        tipo: 'bot',
        timestamp: new Date()
      });

      

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
