function validarCpf(cpf) {
  const dados = cpf.replace(/[^0-9]/g, '');
  if (dados.length !== 11 || new Set(dados).size === 1) return false;

  const calcDig = (base) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i]) * (base.length + 1 - i);
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const dig1 = calcDig(dados.slice(0, 9));
  const dig2 = calcDig(dados.slice(0, 9) + dig1);

  return dados === dados.slice(0, 9) + dig1 + dig2;
}

module.exports = {
  validarCpf,
};
