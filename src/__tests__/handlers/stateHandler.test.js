const stateHandler = require('../../handlers/statesHandler');
const { sendMessage } = require('../../utils/sendMessage');
const axios = require('axios');
const admin = require('firebase-admin');

jest.mock('../../controller/Buttons', () => ({
  menuBotao: jest.fn(),
  agendamentoBotao: jest.fn(),
  consultaBotao: jest.fn(),
  finalizaBotao: jest.fn(),
}));

jest.mock('axios');
jest.mock('firebase-admin');
jest.mock('../../utils/sendMessage', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../utils/cpfCheck', () => ({
  validarCpf: jest.fn(),
}));

jest.mock('../../utils/firestore', () => ({
  registrarAgendamento: jest.fn().mockResolvedValue(true),
}));

describe('stateHandler', () => {
  const userId = '123456789';

  beforeEach(() => {
    jest.clearAllMocks();
    stateHandler.limparDados(userId);
    stateHandler.getUserData = jest.fn().mockReturnValue({});
  });

  describe('Gerenciamento de Estado', () => {
    test('deve retornar "inicio" como estado padrão', () => {
      expect(stateHandler.getUserState(userId)).toBe('inicio');
    });

    test('deve alterar e recuperar o estado corretamente', () => {
      stateHandler.setUserState(userId, 'menu');
      expect(stateHandler.getUserState(userId)).toBe('menu');
    });

    test('deve limpar os dados do usuário corretamente', () => {
      stateHandler.setUserState(userId, 'menu');
      stateHandler.limparDados(userId);
      expect(stateHandler.getUserState(userId)).toBe('inicio');
    });
  });

  describe('handleText', () => {
    test('deve iniciar o fluxo mostrando o menu', async () => {
      await stateHandler.handleText(userId, 'oi');
      expect(stateHandler.getUserState(userId)).toBe('menu');
      expect(require('../../controller/Buttons').menuBotao).toHaveBeenCalledWith(userId);
    });

    test('deve validar CPF e avançar para nome se não existir cadastro', async () => {
      stateHandler.setUserState(userId, 'cpf');
      require('../../utils/cpfCheck').validarCpf.mockReturnValue(true);
      axios.get.mockRejectedValue(new Error('CPF não encontrado'));

      await stateHandler.handleText(userId, '05672466125');

      expect(axios.get).toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(
        userId,
        '⚠️ CPF não encontrado na base de dados, vamos prosseguir com o seu cadastro.'
      );
      expect(stateHandler.getUserState(userId)).toBe('nome');
    });

    test('deve rejeitar CPF inválido', async () => {
      stateHandler.setUserState(userId, 'cpf');
      require('../../utils/cpfCheck').validarCpf.mockReturnValue(false);

      await stateHandler.handleText(userId, '123');

      expect(sendMessage).toHaveBeenCalledWith(userId, '❌ CPF inválido. Tente novamente.');
      expect(stateHandler.getUserState(userId)).toBe('cpf');
    });

    test('deve avançar pelo fluxo de cadastro completo', async () => {
      const states = [
        { state: 'nome', text: 'Fulano de Tal', nextState: 'cep' },
        { state: 'cep', text: '12345-678', nextState: 'endereco' },
        { state: 'endereco', text: 'Rua ABC, 123', nextState: 'entre_ruas' },
        { state: 'entre_ruas', text: 'Entre X e Y', nextState: 'referencia' },
        { state: 'referencia', text: 'Próximo ao mercado', nextState: 'nome_pet' },
        { state: 'nome_pet', text: 'Rex', nextState: 'nascimento_pet' },
        { state: 'nascimento_pet', text: '01/01/2020', nextState: 'raca' },
        { state: 'raca', text: 'Vira-lata', nextState: 'pelagem' },
        { state: 'pelagem', text: 'Preto', nextState: 'data_agendamento' },
        { state: 'data_agendamento', text: '15/07/2025', nextState: 'aguardando_confirmacao' },
      ];

      for (const { state, text, nextState } of states) {
        stateHandler.setUserState(userId, state);
        await stateHandler.handleText(userId, text);
        expect(stateHandler.getUserState(userId)).toBe(nextState);
      }

      expect(require('../../controller/Buttons').finalizaBotao).toHaveBeenCalled();
    });
  });

  describe('handleButton', () => {
    test('deve iniciar fluxo de agendamento para banho', async () => {
      stateHandler.setUserState(userId, 'menu');
      await stateHandler.handleButton(userId, 'banho_btn');

      expect(stateHandler.getUserState(userId)).toBe('cpf');
      expect(sendMessage).toHaveBeenCalledWith(userId, 'Informe o seu CPF (somente os numeros)');
      expect(stateHandler.getUserData(userId)).toEqual({ tipoServico: 'banho' });
    });

    test('deve confirmar agendamento com sucesso', async () => {
      const mockUserData = {
        cpf: '12345678901',
        data: '15/07/2025',
        tipoServico: 'banho',
      };

      stateHandler.getUserData.mockReturnValue(mockUserData);
      stateHandler.setUserState(userId, 'aguardando_confirmacao');

      await stateHandler.handleButton(userId, 'mais_nao');

      expect(require('../../utils/firestore').registrarAgendamento).toHaveBeenCalledWith(
        mockUserData.cpf,
        expect.any(Object)
      );
      expect(sendMessage).toHaveBeenCalledWith(
        userId,
        '✅ Agendado com sucesso. Obrigado por usar o PetShop!'
      );
      expect(stateHandler.getUserState(userId)).toBe('inicio');
    });

    test('deve iniciar fluxo de cancelamento', async () => {
      stateHandler.setUserState(userId, 'menu');
      await stateHandler.handleButton(userId, 'cancelar_agendamento');

      expect(stateHandler.getUserState(userId)).toBe('aguardando_cpf_cancelamento');
      expect(sendMessage).toHaveBeenCalledWith(userId, 'Informe o seu CPF (somente os números)');
    });

    test('deve processar cancelamento corretamente', async () => {
      const mockAgendamentos = [
        {
          id: '1',
          tipoServico: 'banho',
          data: { _seconds: Date.now() / 1000 },
          nome_pet: 'Rex',
        },
      ];

      const mockUserData = {
        cpf: '12345678901',
        agendamentos: mockAgendamentos,
      };

      stateHandler.getUserData.mockReturnValue(mockUserData);
      stateHandler.setUserState(userId, 'aguardando_confirmar_cancelamento');

      axios.delete.mockResolvedValue({});

      await stateHandler.handleText(userId, '1');

      expect(axios.delete).toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(userId, '✅ Agendamento cancelado com sucesso!');
      expect(stateHandler.getUserState(userId)).toBe('inicio');
    });
  });
});
