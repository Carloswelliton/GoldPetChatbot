// controller/agendamento.js
const express = require('express');
const router = express.Router();
const { db } = require('../database/Database');

// Retorna todos os agendamentos de um cliente
router.get('/agendamentos/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const snapshot = await db
      .collection('agendamentos')
      .doc(userId)
      .collection('agendado')
      .orderBy('timestamp', 'desc')
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: 'Nenhum agendamento encontrado para esse número' });
    }

    const agendamentos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ agendamentos });
  } catch (error) {
    console.log('❌ Erro ao buscar agendamentos:', error.message);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Verifica se existe pelo menos um agendamento para o CPF
router.get('/agendamentos/existe/:cpf', async (req, res) => {
  const cpf = req.params.cpf;

  try {
    const docRef = db.collection('agendamentos').doc(cpf).collection('agendado');
    const snapshot = await docRef.orderBy('timestamp', 'desc').limit(1).get();

    if (snapshot.empty) {
      return res.json({ existe: false });
    }

    const doc = snapshot.docs[0].data();

    const dados = {
      nome: doc.nome || '',
      cep: doc.cep || '',
      endereco: doc.endereco || '',
      entreRuas: doc.entreRuas || '',
      referencia: doc.referencia || '',
    };

    return res.json({
      existe: true,
      dados,
    });
  } catch (error) {
    console.error('❌ Erro ao verificar CPF:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao buscar CPF' });
  }
});


router.get('/agendamentos/:cpf', async (req, res) => {
  const { cpf } = req.params;

  try {
    const agendamentoRef = db.collection('agendamentos').doc(cpf).collection('agendado');
    const snapshot = await agendamentoRef.orderBy('timestamp', 'desc').get();

    if (snapshot.empty) {
      return res.status(404).json({ mensagem: 'Nenhum agendamento encontrado' });
    }

    const agendamentos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ agendamentos });
  } catch (error) {
    console.error('❌ Erro ao buscar agendamentos:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao buscar agendamentos' });
  }
});

router.get('/agendamentos/futuros/:cpf', async (req, res) => {
  const { cpf } = req.params;
  try {
    const hoje = new Date();
    const snapshot = await db
      .collection('agendamentos')
      .doc(cpf)
      .collection('agendado')
      .orderBy('data')
      .get();

    const agendamentos = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((ag) => ag.data && ag.data.toDate && ag.data.toDate() >= hoje);

    return res.status(200).json({ agendamentos });
  } catch (error) {
    console.error('❌ Erro ao buscar agendamentos futuros:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar agendamentos futuros' });
  }
});

module.exports = router;
