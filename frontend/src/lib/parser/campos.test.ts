import { describe, expect, it } from 'vitest';
import type { DesligamentoRecord } from '../../tipos';
import { inconsistencies, normalizarCampo, parseText, recalcular, statusFor } from './campos';

const TEXTO = [
  'MUNICÍPIO: CIDADE EXEMPLO',
  'CPF: 001.234.567-97',
  'NIS: 12345678919',
  'NIB: 0012345678',
  'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: MARIA DA SILVA',
  'MOTIVO DO DESLIGAMENTO',
  '( ) Mudança para outro Estado',
  '(X) OUTRO',
  'Mudança de renda da família',
].join('\n');

describe('parseText', () => {
  it('preserva identificadores e monta o motivo "OUTRO"', () => {
    const campos = parseText(TEXTO);
    expect(campos).toEqual({
      municipio: 'CIDADE EXEMPLO',
      cpf: '00123456797',
      nis: '12345678919',
      nib: '0012345678',
      nome: 'MARIA DA SILVA',
      motivo: 'OUTRO: Mudança de renda da família',
    });
    expect(statusFor(campos)).toBe('OK');
  });

  it('aceita quebras de linha CRLF', () => {
    expect(parseText(TEXTO.replace(/\n/g, '\r\n'))).toEqual(parseText(TEXTO));
  });

  it('remove o número no final do município', () => {
    expect(parseText('MUNICÍPIO: CIDADE EXEMPLO 12').municipio).toBe('CIDADE EXEMPLO');
  });

  it('remove ruído numérico no final do nome', () => {
    const texto = 'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: MARIA DA SILVA 123';
    expect(parseText(texto).nome).toBe('MARIA DA SILVA');
    expect(parseText('NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: ANA(2)').nome).toBe('ANA');
  });

  it('usa a linha seguinte quando o valor não está na linha do rótulo', () => {
    const texto = 'CPF:\n\n   \n123.456.789-09';
    expect(parseText(texto).cpf).toBe('12345678909');
  });

  it('mantém todos os dígitos do CPF, mesmo passando de 11, para a revisão apontar o erro', () => {
    const campos = parseText('CPF: 086378851312');
    expect(campos.cpf).toBe('086378851312');
    expect(inconsistencies({ ...campos, municipio: 'C', nis: '12345678919', nib: '1', nome: 'N', motivo: 'M' })).toEqual(['CPF inválido']);
  });

  it('lê o NIB sem engolir o NIS que vem na mesma linha', () => {
    const campos = parseText('NIB: 0863785131 NIS:16635480693');
    expect(campos.nib).toBe('0863785131');
    expect(campos.nis).toBe('16635480693');
  });

  it('junta o nome que quebra em duas linhas, mas para no próximo rótulo', () => {
    const texto = [
      'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: JOANA PEREIRA LIMA',
      'SOUZA',
      'NOME NO CARTÃO CMIC: JOANA P LIMA SOUZA',
    ].join('\n');
    expect(parseText(texto).nome).toBe('JOANA PEREIRA LIMA SOUZA');
    const semQuebra = 'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: ANA SILVA\nMOTIVO DO DESLIGAMENTO:';
    expect(parseText(semQuebra).nome).toBe('ANA SILVA');
  });

  it('OUTRO marcado sem detalhe não pega o texto de outro campo', () => {
    const texto = [
      'MOTIVO DO DESLIGAMENTO:',
      '( ) Processo de fiscalização;',
      '( X ) OUTRO:_______________',
      ' DATA EM QUE SAIU DO PERFIL DO CMIC: 01/07/2026',
    ].join('\n');
    expect(parseText(texto).motivo).toBe('OUTRO');
  });

  it('OUTRO marcado com o detalhe na mesma linha', () => {
    const texto = [
      'MOTIVO DO DESLIGAMENTO:',
      '( X ) OUTRO: mudou de cidade_______',
      ' DATA EM QUE SAIU DO PERFIL DO CMIC: 01/07/2026',
    ].join('\n');
    expect(parseText(texto).motivo).toBe('OUTRO: mudou de cidade');
  });

  it('lê um formulário no layout real (dados fictícios): marcador "( X )", campos lado a lado, nome em duas linhas', () => {
    const texto = [
      'FORMULÁRIO DE SOLICITAÇÃO DE DESLIGAMENTO DE BENEFICIÁRIOS',
      'MUNICÍPIO: CIDADE EXEMPLO',
      'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: JOANA PEREIRA LIMA',
      'SOUZA',
      'NOME NO CARTÃO CMIC: JOANA P LIMA SOUZA',
      'DATA NASC.: 10/08/1990 CPF: 123.456.789-09',
      'NIB: 1234567890 NIS:00012345678',
      'NOME DA MÃE: MARIA PEREIRA LIMA',
      'CADASTRO ATUALIZADO: ( X ) SIM ( ) NÃO DATA DA ÚLTIMA ATUALIZAÇÃO:10/09/2025',
      ' MOTIVO DO DESLIGAMENTO:',
      '( ) Renda familiar mensal per capita superior;',
      '( ) Processo de fiscalização;',
      '( X ) Mudança para outro Município;',
      '( ) OUTRO:_______________________________',
      ' DATA EM QUE SAIU DO PERFIL DO CMIC: 01/07/2026',
    ].join('\n');
    expect(parseText(texto)).toEqual({
      municipio: 'CIDADE EXEMPLO',
      cpf: '12345678909',
      nis: '00012345678',
      nib: '1234567890',
      nome: 'JOANA PEREIRA LIMA SOUZA',
      motivo: 'Mudança para outro Município',
    });
  });

  it('devolve o motivo marcado quando não é "outro"', () => {
    const texto = 'MOTIVO DO DESLIGAMENTO\n(X) Mudança para outro Estado\n( ) OUTRO';
    expect(parseText(texto).motivo).toBe('Mudança para outro Estado');
  });

  it('pula caixas de marcação ao procurar o detalhe de "outro"', () => {
    const texto = 'MOTIVO DO DESLIGAMENTO\n(X) Outro\n( ) Mudança\nDetalhe aqui';
    expect(parseText(texto).motivo).toBe('Outro: Detalhe aqui');
  });

  it('ignora marcações depois do fim da seção de motivo', () => {
    const texto = 'MOTIVO DO DESLIGAMENTO\n( ) Mudança\nASSINATURA\n(X) OUTRO\nfoo';
    expect(parseText(texto).motivo).toBe('');
  });

  it('devolve todos os campos vazios para texto vazio', () => {
    const campos = parseText('');
    expect(campos).toEqual({ municipio: '', cpf: '', nis: '', nib: '', nome: '', motivo: '' });
    expect(inconsistencies(campos)).toEqual(['MUNICIPIO', 'CPF', 'NIS', 'NIB', 'NOME', 'MOTIVO']);
  });
});

describe('inconsistencies e statusFor', () => {
  const completo = { municipio: 'OUTRA CIDADE', cpf: '12345678909', nis: '12345678919', nib: '456', nome: 'ANA', motivo: 'Mudança' };

  it('campo ausente exige revisão', () => {
    const campos = { ...completo, municipio: '', nis: '', nib: '', nome: '', motivo: '', cpf: '123' };
    expect(statusFor(campos)).toBe('REVISAR');
  });

  it('CPF com tamanho diferente de 11 gera "CPF inválido" mesmo com os outros campos preenchidos', () => {
    const campos = { ...completo, cpf: '1234567890' };
    expect(inconsistencies(campos)).toContain('CPF inválido');
    expect(statusFor(campos)).toBe('REVISAR');
  });

  it('motivo OUTRO sem detalhe pede para o usuário digitar o detalhe', () => {
    for (const motivo of ['OUTRO', 'outro', ' Outro ']) {
      const campos = { ...completo, motivo };
      expect(inconsistencies(campos)).toEqual(['Digite o detalhe do OUTRO']);
      expect(statusFor(campos)).toBe('REVISAR');
    }
  });

  it('motivo OUTRO com detalhe segue OK, e outro motivo que só contém "outro" também', () => {
    expect(inconsistencies({ ...completo, motivo: 'OUTRO: mudou de cidade' })).toEqual([]);
    expect(inconsistencies({ ...completo, motivo: 'Mudança para outro Município' })).toEqual([]);
  });

  it('registro completo fica OK', () => {
    expect(inconsistencies(completo)).toEqual([]);
    expect(statusFor(completo)).toBe('OK');
  });
});

describe('recalcular', () => {
  it('troca status e inconsistências depois de uma edição', () => {
    const registro: DesligamentoRecord = {
      id: 1,
      arquivo: 'a.pdf',
      referencia: '09/10/2026',
      municipio: '',
      cpf: '12345678909',
      nis: '12345678919',
      nib: '456',
      nome: 'ANA',
      motivo: 'Mudança',
      municipioConfere: false,
      validado: false,
      recebeCmic: false,
      status: 'REVISAR',
      inconsistencias: ['PDF sem texto selecionável (escaneado)'],
    };
    const corrigido = recalcular({ ...registro, municipio: 'CIDADE' });
    expect(corrigido.status).toBe('OK');
    expect(corrigido.inconsistencias).toEqual([]);
    expect(recalcular(registro).inconsistencias).toEqual(['MUNICIPIO']);
  });
});

describe('normalizarCampo', () => {
  it('cpf: remove pontuação e espaços e mantém todos os dígitos', () => {
    expect(normalizarCampo('cpf', '123.456.789-09')).toBe('12345678909');
    expect(normalizarCampo('cpf', '123456789-0')).toBe('1234567890');
    expect(normalizarCampo('cpf', ' 12345678901')).toBe('12345678901');
    expect(normalizarCampo('cpf', '123.456.789-01 2')).toBe('123456789012');
  });

  it('nib: mantém só os dígitos', () => {
    expect(normalizarCampo('nib', ' 0863-785131 ')).toBe('0863785131');
  });

  it('nis: mantém só os dígitos', () => {
    expect(normalizarCampo('nis', '123.45678.90-1')).toBe('12345678901');
  });

  it('os demais campos ficam como digitados', () => {
    expect(normalizarCampo('nome', ' Ana  Maria ')).toBe(' Ana  Maria ');
    expect(normalizarCampo('motivo', '(X) outro')).toBe('(X) outro');
  });
});

describe('dígitos verificadores de CPF e NIS', () => {
  const valido = { municipio: 'C', cpf: '52998224725', nis: '12345678919', nib: '1', nome: 'N', motivo: 'M' };

  it('aceita CPF e NIS com dígitos corretos, inclusive CPF com zeros à esquerda', () => {
    expect(inconsistencies(valido)).toEqual([]);
    expect(inconsistencies({ ...valido, cpf: '00123456797' })).toEqual([]);
  });

  it('aponta CPF com dígito verificador errado', () => {
    expect(inconsistencies({ ...valido, cpf: '52998224724' })).toEqual(['CPF com dígito verificador inválido']);
  });

  it('aponta CPF com todos os dígitos iguais, que passa na conta mas não existe', () => {
    expect(inconsistencies({ ...valido, cpf: '11111111111' })).toEqual(['CPF com dígito verificador inválido']);
  });

  it('CPF com tamanho errado aponta só o tamanho', () => {
    expect(inconsistencies({ ...valido, cpf: '086378851312' })).toEqual(['CPF inválido']);
  });

  it('aponta NIS com dígito verificador errado', () => {
    expect(inconsistencies({ ...valido, nis: '12345678918' })).toEqual(['NIS com dígito verificador inválido']);
  });

  it('aponta NIS que não tem 11 dígitos', () => {
    expect(inconsistencies({ ...valido, nis: '123' })).toEqual(['NIS inválido']);
  });

  it('o status reflete os dígitos verificadores', () => {
    expect(statusFor({ ...valido, cpf: '52998224724' })).toBe('REVISAR');
    expect(statusFor(valido)).toBe('OK');
  });
});

describe('NIS só com zeros', () => {
  it('não é um NIS válido, mesmo passando na conta do dígito', () => {
    const campos = { municipio: 'C', cpf: '52998224725', nis: '00000000000', nib: '1', nome: 'N', motivo: 'M' };
    expect(inconsistencies(campos)).toEqual(['NIS com dígito verificador inválido']);
  });
});
