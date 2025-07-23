const stateHandler = require('../../handlers/statesHandler');
const botao = require('../../controller/Buttons');
const axios = require('axios');
const admin = require('firebase-admin');

jest.mock('../../controller/Buttons');
jest.mock('axios');
jest.mock('firebase-admin');
jest.mock('../../utils/sendMessage');
jest.mock('../../utils/firestore');
jest.mock('../../utils/cpfCheck');

describe('stateHandler', () => {
  const userId = '123456789';

  beforeEach(() => {
    stateHandler.limparDados(userId);
    jest.clearAllMocks();
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
      expect(botao.menuBotao).toHaveBeenCalledWith(userId);
      expect(stateHandler.getUserState(userId)).toBe('menu');
    });

    test('deve validar CPF e avançar para nome se não existir cadastro', async () => {
      stateHandler.setUserState(userId, 'cpf');
      require('../../utils/cpfCheck').validarCpf.mockReturnValue(true);
      axios.get.mockRejectedValue(new Error('CPF não encontrado'));

      await stateHandler.handleText(userId, '12345678901');

      expect(axios.get).toHaveBeenCalled();
      expect(require('../../utils/sendMessage')).toHaveBeenCalledWith(
        userId,
        '⚠️ CPF não encontrado na base de dados, vamos prosseguir com o seu cadastro.'
      );
      expect(stateHandler.getUserState(userId)).toBe('nome');
    });

    test('deve rejeitar CPF inválido', async () => {
      stateHandler.setUserState(userId, 'cpf');
      require('../../utils/cpfCheck').validarCpf.mockReturnValue(false);

      await stateHandler.handleText(userId, '05672466125');

      expect(require('../../utils/sendMessage')).toHaveBeenCalledWith(
        userId,
        '❌ CPF inválido. Tente novamente.'
      );
      expect(stateHandler.getUserState(userId)).toBe('cpf'); // Mantém no mesmo estado
    });

    test('deve avançar pelo fluxo de cadastro completo', async () => {
      // Simula o fluxo completo de cadastro
      stateHandler.setUserState(userId, 'nome');
      await stateHandler.handleText(userId, 'Fulano de Tal');
      expect(stateHandler.getUserState(userId)).toBe('cep');

      await stateHandler.handleText(userId, '12345-678');
      expect(stateHandler.getUserState(userId)).toBe('endereco');

      await stateHandler.handleText(userId, 'Rua ABC, 123');
      expect(stateHandler.getUserState(userId)).toBe('entre_ruas');

      await stateHandler.handleText(userId, 'Entre as ruas X e Y');
      expect(stateHandler.getUserState(userId)).toBe('referencia');

      await stateHandler.handleText(userId, 'Próximo ao mercado');
      expect(stateHandler.getUserState(userId)).toBe('nome_pet');

      await stateHandler.handleText(userId, 'Rex');
      expect(stateHandler.getUserState(userId)).toBe('nascimento_pet');

      await stateHandler.handleText(userId, '01/01/2020');
      expect(stateHandler.getUserState(userId)).toBe('raca');

      await stateHandler.handleText(userId, 'Vira-lata');
      expect(stateHandler.getUserState(userId)).toBe('pelagem');

      await stateHandler.handleText(userId, 'Preto');
      expect(stateHandler.getUserState(userId)).toBe('data_agendamento');

      await stateHandler.handleText(userId, '15/07/2025');
      expect(botao.finalizaBotao).toHaveBeenCalled();
      expect(stateHandler.getUserState(userId)).toBe('aguardando_confirmacao');
    });
  });

  describe('handleButton', () => {
    test('deve iniciar fluxo de agendamento para banho', async () => {
      stateHandler.setUserState(userId, 'menu');
      await stateHandler.handleButton(userId, 'banho_btn');

      expect(stateHandler.getUserState(userId)).toBe('cpf');
      expect(require('../../utils/sendMessage')).toHaveBeenCalledWith(
        userId,
        'Informe o seu CPF (somente os numeros)'
      );
      expect(stateHandler.getUserData(userId).tipoServico).toBe('banho');
    });

    test('deve confirmar agendamento com sucesso', async () => {
      stateHandler.setUserState(userId, 'aguardando_confirmacao');
      const userData = stateHandler.getUserData(userId);
      userData.cpf = '12345678901';
      userData.data = '15/07/2025';

      await stateHandler.handleButton(userId, 'mais_nao');

      expect(require('../../utils/firestore').registrarAgendamento).toHaveBeenCalled();
      expect(require('../../utils/sendMessage')).toHaveBeenCalledWith(
        userId,
        '✅ Agendado com sucesso. Obrigado por usar o PetShop!'
      );
      expect(stateHandler.getUserState(userId)).toBe('inicio');
    });

    test('deve iniciar fluxo de cancelamento', async () => {
      stateHandler.setUserState(userId, 'menu');
      await stateHandler.handleButton(userId, 'cancelar_agendamento');

      expect(stateHandler.getUserState(userId)).toBe('aguardando_cpf_cancelamento');
      expect(require('../../utils/sendMessage')).toHaveBeenCalledWith(
        userId,
        'Informe o seu CPF (somente os números)'
      );
    });

    test('deve processar cancelamento corretamente', async () => {
      stateHandler.setUserState(userId, 'aguardando_confirmar_cancelamento');
      const userData = stateHandler.getUserData(userId);
      userData.cpf = '12345678901';
      userData.agendamentos = [
        { id: '1', tipoServico: 'banho', data: { _seconds: Date.now() / 1000 }, nome_pet: 'Rex' },
      ];

      axios.delete.mockResolvedValue({});

      await stateHandler.handleText(userId, '1');

      expect(axios.delete).toHaveBeenCalled();
      expect(require('../../utils/sendMessage')).toHaveBeenCalledWith(
        userId,
        '✅ Agendamento cancelado com sucesso!'
      );
      expect(stateHandler.getUserState(userId)).toBe('inicio');
    });
  });
});
