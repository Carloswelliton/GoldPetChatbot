const request = require('supertest');
const app = require('../../index');
const stateHandler = require('../../handlers/statesHandler');
const botao = require('../../controller/Buttons');

jest.mock('../../handlers/statesHandler');
jest.mock('../../controller/Buttons');
jest.mock('../../utils/sendMessage');

describe('API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /webhook - deve validar webhook com token correto', async () => {
    process.env.MEU_TOKEN = 'test_token';

    const response = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'test_token',
      'hub.challenge': 'test_challenge',
    });

    expect(response.status).toBe(200);
    expect(response.text).toBe('test_challenge');
  });

  test('GET /webhook - deve rejeitar token inválido', async () => {
    process.env.MEU_TOKEN = 'test_token';

    const response = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong_token',
      'hub.challenge': 'test_challenge',
    });

    expect(response.status).toBe(403);
  });

  test('POST /webhook - deve processar mensagem de texto', async () => {
    const mockMessage = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: '123456789',
                    text: { body: 'oi' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const response = await request(app).post('/webhook').send(mockMessage);

    expect(response.status).toBe(200);
    expect(stateHandler.handleText).toHaveBeenCalledWith('123456789', 'oi');
  });

  test('POST /webhook - deve processar botão interativo', async () => {
    const mockMessage = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: '123456789',
                    interactive: { button_reply: { id: 'banho_btn' } },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const response = await request(app).post('/webhook').send(mockMessage);

    expect(response.status).toBe(200);
    expect(stateHandler.handleButton).toHaveBeenCalledWith('123456789', 'banho_btn');
  });

  test('POST /webhook - deve cancelar atendimento com comando "cancelar"', async () => {
    const mockMessage = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: '123456789',
                    text: { body: 'cancelar' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const response = await request(app).post('/webhook').send(mockMessage);

    expect(response.status).toBe(200);
    expect(require('../../utils/sendMessage')).toHaveBeenCalledWith(
      '123456789',
      '❌ Atendimento cancelado.'
    );
    expect(stateHandler.limparDados).toHaveBeenCalledWith('123456789');
  });

  test('POST /webhook - deve voltar ao menu com comando "voltar"', async () => {
    const mockMessage = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: '123456789',
                    text: { body: 'voltar' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const response = await request(app).post('/webhook').send(mockMessage);

    expect(response.status).toBe(200);
    expect(stateHandler.setUserState).toHaveBeenCalledWith('123456789', 'menu');
    expect(require('../../utils/sendMessage')).toHaveBeenCalledWith(
      '123456789',
      '🔙 Voltando ao menu principal...'
    );
    expect(botao.menuBotao).toHaveBeenCalledWith('123456789');
  });
});
