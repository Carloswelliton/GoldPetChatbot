const { db, admin } = require('../database/Database');

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

async function registrarAgendamento(userId, dados) {
  try {
    // Garante que dataString está no formato correto
    if (!dados.dataString || !dados.dataString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      throw new Error('Formato de dataString inválido');
    }

    // Garante que o timestamp de registro está presente
    if (!dados.timestamp || !dados.timestamp.seconds) {
      dados.timestamp = admin.firestore.FieldValue.serverTimestamp();
    }

    const docRef = await db
      .collection('agendamentos')
      .doc(userId)
      .collection('agendado')
      .add(dados);

    console.log('✅ Agendamento registrado com ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('❌ Erro ao registrar agendamento:', error);
    return false;
  }
}

module.exports = {
  salvarConversa,
  registrarAgendamento,
};
