const express = require('express');
const router = express.Router();
const { db } = require('../database/Database');

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

    const agendamentos = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Garante que os campos de data estejam presentes
        data: data.data || null,
        dataString: data.dataString || null,
        timestamp: data.timestamp || null,
      };
    });

    return res.status(200).json({ agendamentos });
  } catch (error) {
    console.error('❌ Erro ao buscar agendamentos:', error);
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
      .orderBy('timestamp', 'desc') // mantém ordenação
      .get();

    const agendamentos = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((ag) => {
        const data = ag.data;

        if (!data) return false;

        if (typeof data.toDate === 'function') {
          return data.toDate() >= hoje;
        }

        if (typeof data === 'string') {
          const partes = data.split('/');
          if (partes.length !== 3) return false;
          const [dia, mes, ano] = partes;
          const dataObj = new Date(`${ano}-${mes}-${dia}`);
          return !isNaN(dataObj) && dataObj >= hoje;
        }

        // Tipo inesperado
        return false;
      });

    return res.status(200).json({ agendamentos });
  } catch (error) {
    console.error('❌ Erro ao buscar agendamentos futuros:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar agendamentos futuros' });
  }
});

router.delete('/agendamentos/:cpf/:id', async (req, res) => {
  const {cpf, id} = req.params;
  try{
    const agendamentoRef = db
      .collection('agendamentos')
      .doc(cpf)
      .collection('agendado')
      .doc(id);

      const agendamento = await agendamentoRef.get();

      if(!agendamento.exists){
        return res.status(404).json({message: 'Agendamento não encontrado'});
      }

      await agendamentoRef.delete();
      return res.status(200).json({message: 'Agendamento cancelado com sucesso'})
  }catch(error){
    console.log('❌ Erro ao deletar agendamento:', error.message);
    return res.status(500).json({message: 'Erro ao cancelar agendamento'})
  }
})

module.exports = router;
