const express = require('express');
const router = express.Router();
const { db, admin } = require('../database/Database');


router.get('/agendamentos/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const snapshot = await db
      .collection('agendamentos')
      .doc(userId)
      .collection('agendado')
      .orderBy('timestamp', 'desc')
      .get();

    if(snapshot.empty){
      return res.status(404).json({message: 'Nenhum agendamento encontrado para esse número'});
    }

    const agendamentos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));


    return res.status(200).json({agendamentos});


  } catch (error) {
    console.log('❌ Erro ao buscar agendamentos:', error.message);
    return res.status(500).json({error: "erro interno no servidor"});
  }
});

module.exports = router;