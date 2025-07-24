// const request = require('supertest');
// const express = require('express');
// const agendamentosRouter = require('../../controller/agendamento');
// const admin = require('firebase-admin');

// jest.mock('../../database/Database', () => ({
//   db: {
//     collection: jest.fn(() => ({
//       doc: jest.fn(() => ({
//         collection: jest.fn(() => ({
//           orderBy: jest.fn(() => ({
//             get: jest.fn(),
//             limit: jest.fn(() => ({
//               get: jest.fn()
//             }))
//           }))
//         }))
//       }))
//     })
//   )}
// }));

// jest.mock('firebase-admin');

// describe('Agendamentos Router', () => {
//   let app;
  
//   beforeAll(() => {
//     app = express();
//     app.use(express.json());
//     app.use('/api', agendamentosRouter);

//     admin.firestore.Timestamp = {
//       fromDate: jest.fn().mockImplementation(date => ({
//         toDate: () => date,
//         _seconds: Math.floor(date.getTime() / 1000)
//       }))
//     };
//   });

//   beforeEach(() => {
//     jest.clearAllMocks();
//   });

//   describe('GET /api/agendamentos/:cpf', () => {
//     test('deve retornar agendamentos para um CPF', async () => {
//       const mockAgendamentos = [
//         { id: '1', tipoServico: 'banho', nome_pet: 'Rex', data: { seconds: 1620000000 } }
//       ];
      
//       const mockGet = {
//         empty: false,
//         docs: mockAgendamentos.map(ag => ({
//           id: ag.id,
//           data: jest.fn().mockReturnValue(ag)
//         }))
//       };

//       require('../../database/Database').db.collection()
//         .doc().collection().orderBy().get.mockResolvedValue(mockGet);

//       const response = await request(app)
//         .get('/api/agendamentos/05672466125');
      
//       expect(response.status).toBe(200);
//       expect(response.body.agendamentos).toHaveLength(1);
//       expect(response.body.agendamentos[0].tipoServico).toBe('banho');
//     });

//     test('deve retornar 404 quando não há agendamentos', async () => {
//       require('../../database/Database').db.collection()
//         .doc().collection().orderBy().get.mockResolvedValue({ empty: true });

//       const response = await request(app)
//         .get('/api/agendamentos/05672466125');
      
//       expect(response.status).toBe(404);
//       expect(response.body.message).toBe('Nenhum agendamento encontrado para esse número');
//     });
//   });

//   describe('GET /api/agendamentos/existe/:cpf', () => {
//     test('deve retornar true quando CPF existe', async () => {
//       const mockDados = {
//         nome: 'Fulano',
//         cep: '12345-678',
//         endereco: 'Rua ABC, 123'
//       };
      
//       const mockGet = {
//         empty: false,
//         docs: [{
//           data: jest.fn().mockReturnValue(mockDados)
//         }]
//       };

//       require('../../database/Database').db.collection()
//         .doc().collection().orderBy().limit().get.mockResolvedValue(mockGet);

//       const response = await request(app)
//         .get('/api/agendamentos/existe/05672466125');
      
//       expect(response.status).toBe(200);
//       expect(response.body.existe).toBe(true);
//       expect(response.body.dados.nome).toBe('Fulano');
//     });

//     test('deve retornar false quando CPF não existe', async () => {
//       require('../../database/Database').db.collection()
//         .doc().collection().orderBy().limit().get.mockResolvedValue({ empty: true });

//       const response = await request(app)
//         .get('/api/agendamentos/existe/05672466125');
      
//       expect(response.status).toBe(200);
//       expect(response.body.existe).toBe(false);
//     });
//   });

//   describe('GET /api/agendamentos/futuros/:cpf', () => {
//     test('deve retornar apenas agendamentos futuros', async () => {
//       const hoje = new Date();
//       const futuro = new Date(hoje.getTime() + 86400000); // Amanhã
//       const passado = new Date(hoje.getTime() - 86400000); // Ontem
      
//       const mockAgendamentos = [
//         { 
//           id: '1', 
//           tipoServico: 'banho', 
//           nome_pet: 'Rex',
//           data: admin.firestore.Timestamp.fromDate(futuro)
//         },
//         { 
//           id: '2', 
//           tipoServico: 'consulta', 
//           nome_pet: 'Bela',
//           data: admin.firestore.Timestamp.fromDate(passado)
//         }
//       ];
      
//       const mockGet = {
//         empty: false,
//         docs: mockAgendamentos.map(ag => ({
//           id: ag.id,
//           data: jest.fn().mockReturnValue(ag)
//         }))
//       };

//       require('../../database/Database').db.collection()
//         .doc().collection().orderBy().get.mockResolvedValue(mockGet);

//       const response = await request(app)
//         .get('/api/agendamentos/futuros/05672466125');
      
//       expect(response.status).toBe(200);
//       expect(response.body.agendamentos).toHaveLength(1);
//       expect(response.body.agendamentos[0].id).toBe('1');
//     });

//     test('deve retornar array vazio quando não há agendamentos futuros', async () => {
//       require('../../database/Database').db.collection()
//         .doc().collection().orderBy().get.mockResolvedValue({ empty: true });

//       const response = await request(app)
//         .get('/api/agendamentos/futuros/05672466125');
      
//       expect(response.status).toBe(200);
//       expect(response.body.agendamentos).toHaveLength(0);
//     });
//   });
// });