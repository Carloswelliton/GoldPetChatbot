const request = require('supertest');
const express = require('express');
const agendamentosRouter = require('../../controller/agendamento');
const { db } = require('../../database/Database');

jest.mock('../../database/Database');

describe('Agendamentos Router', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', agendamentosRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/agendamentos/:cpf', () => {
    test('deve retornar agendamentos para um CPF', async () => {
      const mockAgendamentos = [
        { id: '1', tipoServico: 'banho', nome_pet: 'Rex', data: { seconds: 1620000000 } },
      ];

      db.collection.mockReturnValue({
        doc: jest.fn().mockReturnThis(),
        collection: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: mockAgendamentos.map((ag) => ({
            id: ag.id,
            data: jest.fn().mockReturnValue(ag),
          })),
        }),
      });

      const response = await request(app).get('/api/agendamentos/12345678901');

      expect(response.status).toBe(200);
      expect(response.body.agendamentos).toHaveLength(1);
      expect(response.body.agendamentos[0].tipoServico).toBe('banho');
    });

    test('deve retornar 404 quando não há agendamentos', async () => {
      db.collection.mockReturnValue({
        doc: jest.fn().mockReturnThis(),
        collection: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true }),
      });

      const response = await request(app).get('/api/agendamentos/12345678901');

      expect(response.status).toBe(404);
      expect(response.body.mensagem).toBe('Nenhum agendamento encontrado');
    });
  });

  describe('GET /api/agendamentos/existe/:cpf', () => {
    test('deve retornar true quando CPF existe', async () => {
      const mockDados = {
        nome: 'Fulano',
        cep: '12345-678',
        endereco: 'Rua ABC, 123',
      };

      db.collection.mockReturnValue({
        doc: jest.fn().mockReturnThis(),
        collection: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [
            {
              data: jest.fn().mockReturnValue(mockDados),
            },
          ],
        }),
      });

      const response = await request(app).get('/api/agendamentos/existe/12345678901');

      expect(response.status).toBe(200);
      expect(response.body.existe).toBe(true);
      expect(response.body.dados.nome).toBe('Fulano');
    });

    test('deve retornar false quando CPF não existe', async () => {
      db.collection.mockReturnValue({
        doc: jest.fn().mockReturnThis(),
        collection: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true }),
      });

      const response = await request(app).get('/api/agendamentos/existe/12345678901');

      expect(response.status).toBe(200);
      expect(response.body.existe).toBe(false);
    });
  });

  describe('GET /api/agendamentos/futuros/:cpf', () => {
    test('deve retornar apenas agendamentos futuros', async () => {
      const hoje = new Date();
      const futuro = new Date(hoje.getTime() + 86400000); // Amanhã
      const passado = new Date(hoje.getTime() - 86400000); // Ontem

      const mockAgendamentos = [
        {
          id: '1',
          tipoServico: 'banho',
          nome_pet: 'Rex',
          data: admin.firestore.Timestamp.fromDate(futuro),
        },
        {
          id: '2',
          tipoServico: 'consulta',
          nome_pet: 'Bela',
          data: admin.firestore.Timestamp.fromDate(passado),
        },
      ];

      db.collection.mockReturnValue({
        doc: jest.fn().mockReturnThis(),
        collection: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: mockAgendamentos.map((ag) => ({
            id: ag.id,
            data: jest.fn().mockReturnValue(ag),
          })),
        }),
      });

      const response = await request(app).get('/api/agendamentos/futuros/12345678901');

      expect(response.status).toBe(200);
      expect(response.body.agendamentos).toHaveLength(1);
      expect(response.body.agendamentos[0].id).toBe('1');
    });

    test('deve retornar array vazio quando não há agendamentos futuros', async () => {
      db.collection.mockReturnValue({
        doc: jest.fn().mockReturnThis(),
        collection: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true }),
      });

      const response = await request(app).get('/api/agendamentos/futuros/12345678901');

      expect(response.status).toBe(200);
      expect(response.body.agendamentos).toHaveLength(0);
    });
  });
});
