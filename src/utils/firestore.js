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
  const docRef = db.collection('agendamentos').doc(userId).collection('agendado').doc();
  await docRef.set({ ...dados, timestamp: new Date() });
}

module.exports = {
  salvarConversa,
  registrarAgendamento,
};
