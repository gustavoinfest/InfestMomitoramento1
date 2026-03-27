import * as XLSX from 'xlsx';
import { normalizarCPF } from '../utils/cpf';
import { supabase, isSupabaseConfigured } from '../supabase';

export interface RegistroSIAPSNominal {
  cpf: string;
  cns: string;
  data_nascimento: Date;
  sexo: string;
  raca_cor: number;
  cnes: string;
  ine: string;
  boas_praticas: {
    A: boolean; // 1ª consulta até 12ª semana
    B: boolean; // 7 ou mais consultas
    C: boolean; // 7 ou mais aferições de pressão
    D: boolean; // 7 ou mais registros peso+altura
    E: boolean; // 3 ou mais visitas ACS
    F: boolean; // Vacina dTpa
    G: boolean; // Testes 1º trimestre
    H: boolean; // Testes 3º trimestre
    I: boolean; // Consulta puerpério
    J: boolean; // Visita ACS puerpério
    K: boolean; // Atividade saúde bucal
  };
  nm: boolean;
  dn: boolean;
}

export async function processarArquivoSIAPSNominal(
  arquivo: File,
  competencia: string
): Promise<{ total: number; inseridos: number; erros: number; unidade?: string; ine?: string; equipe?: string; registros?: RegistroSIAPSNominal[] }> {
  const buffer = await arquivo.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  // Ler como array de arrays para encontrar o cabeçalho e os dados
  const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  
  let unidade = 'Não identificada';
  let ine = 'Não identificado';
  let equipe = 'Não identificada';
  let headerRowIndex = -1;

  // Procurar o cabeçalho (linha que contém "CPF") e extrair info da unidade/equipe
  for (let i = 0; i < Math.min(100, rawData.length); i++) {
    const row = rawData[i];
    if (!row || !Array.isArray(row)) continue;
    
    const rowString = row.join('|').toUpperCase();
    
    // Critério mais flexível para identificar o cabeçalho
    const hasCpf = rowString.includes('CPF') || rowString.includes('DOCUMENTO') || rowString.includes('CNS');
    const hasOther = rowString.includes('NOME') || rowString.includes('NASCIMENTO') || rowString.includes('SEXO') || rowString.includes('INDICADOR');
    
    if (hasCpf && hasOther) {
      headerRowIndex = i;
      // Não damos break aqui porque queremos continuar procurando info de unidade/equipe que pode estar acima ou abaixo
    }

    for (let j = 0; j < row.length; j++) {
      const cellOriginal = String(row[j] || '').trim();
      const cell = cellOriginal.toUpperCase();
      if (!cell) continue;
      
      const getVal = (keyword: string) => {
        let val = '';
        if (cell.includes(':')) {
          val = cellOriginal.substring(cell.indexOf(':') + 1).trim();
        }
        if (!val && row[j + 1]) {
          val = String(row[j + 1]).trim();
        }
        val = val.replace(/^["']|["']$/g, '').trim();
        
        if (!val && cell.length > keyword.length) {
          const idx = cell.indexOf(keyword);
          val = cellOriginal.substring(idx + keyword.length).trim();
          val = val.replace(/^[-=:]\s*/, '').trim();
        }
        return val;
      };

      if (cell.includes('UNIDADE') || cell.includes('UBS') || cell.includes('USF') || cell.includes('CNES')) {
        let keyword = cell.includes('UNIDADE') ? 'UNIDADE' : cell.includes('UBS') ? 'UBS' : cell.includes('USF') ? 'USF' : 'CNES';
        let val = getVal(keyword);
        const m = val.match(/^\d+\s*-\s*(.+)$/);
        if (m) val = m[1].trim();
        if (val && unidade === 'Não identificada') unidade = val;
      }
      else if (cell.includes('EQUIPE')) {
        let val = getVal('EQUIPE');
        const m = val.match(/^\d+\s*-\s*(.+)$/);
        if (m) val = m[1].trim();
        if (val && equipe === 'Não identificada') equipe = val;
      }
      else if (cell.includes('INE')) {
        let val = getVal('INE');
        const m = val.match(/\d+/);
        if (m && ine === 'Não identificado') ine = m[0];
      }
    }
  }

  if (headerRowIndex === -1) {
    // Se não encontrou um cabeçalho claro, tenta a primeira linha que parece ter dados
    for (let i = 0; i < Math.min(50, rawData.length); i++) {
      const row = rawData[i];
      if (row && Array.isArray(row) && row.length > 5) {
        const hasNumbers = row.some(cell => /\d{3}/.test(String(cell)));
        if (hasNumbers) {
          headerRowIndex = i - 1 >= 0 ? i - 1 : 0;
          break;
        }
      }
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 0;

  // Mapear as colunas baseadas no cabeçalho encontrado
  const headerRow = rawData[headerRowIndex];
  const colMap: Record<string, number> = {};
  headerRow.forEach((col: any, index: number) => {
    if (col) {
      const name = String(col).trim().toUpperCase().replace(/"/g, '');
      colMap[name] = index;
    }
  });

  // Helper para encontrar colunas por múltiplos nomes
  const findCol = (names: string[]) => {
    for (const name of names) {
      if (colMap[name] !== undefined) return colMap[name];
      // Busca parcial
      for (const key in colMap) {
        if (key.includes(name) || name.includes(key)) return colMap[key];
      }
    }
    return -1;
  };

  const idxCpf = findCol(['CPF', 'DOCUMENTO', 'CPF/CNS', 'CNS']);
  const idxCns = findCol(['CNS', 'CARTÃO SUS', 'CARTAO SUS']);
  const idxNasc = findCol(['NASCIMENTO', 'DATA DE NASCIMENTO', 'DATA NASCIMENTO', 'NASC.']);
  const idxSexo = findCol(['SEXO', 'GÊNERO', 'GENERO']);
  const idxRaca = findCol(['RAÇA COR', 'RAÇA/COR', 'COR', 'RAÇA']);
  const idxIne = findCol(['INE', 'CÓDIGO INE', 'EQUIPE']);
  const idxCnes = findCol(['CNES', 'UNIDADE', 'ESTABELECIMENTO']);

  let inseridos = 0;
  let erros = 0;
  const registrosProcessados: RegistroSIAPSNominal[] = [];
  
  // Processar dados a partir da linha após o cabeçalho
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length < 2) continue;

    try {
      const cpfRaw = idxCpf !== -1 ? String(row[idxCpf] || '').trim() : '';
      if (!cpfRaw) continue;

      const cpf = normalizarCPF(cpfRaw);
      if (!cpf || cpf.length < 3) continue;
      
      const rowIne = idxIne !== -1 ? row[idxIne]?.toString() || '' : '';
      const rowCnes = idxCnes !== -1 ? row[idxCnes]?.toString() || '' : '';
      
      if (ine === 'Não identificado' && rowIne) ine = rowIne;
      if (unidade === 'Não identificada' && rowCnes) unidade = rowCnes;
      
      const getCheck = (key: string) => {
        const possibleKeys = [
          key,
          `INDICADOR ${key}`,
          `IND ${key}`,
          `BOA PRÁTICA ${key}`,
          `BOA PRATICA ${key}`
        ];
        
        for (const k of possibleKeys) {
          if (colMap[k] !== undefined) {
            const val = String(row[colMap[k]] || '').trim().toUpperCase();
            return val === 'X' || val === 'SIM' || val === '1' || val === 'S';
          }
        }
        return false;
      };

      const registro: RegistroSIAPSNominal = {
        cpf,
        cns: idxCns !== -1 ? String(row[idxCns] || '').trim() : '',
        data_nascimento: idxNasc !== -1 ? new Date(row[idxNasc]) : new Date(),
        sexo: idxSexo !== -1 ? String(row[idxSexo] || '').trim() : '',
        raca_cor: idxRaca !== -1 ? parseInt(row[idxRaca]) || 0 : 0,
        cnes: rowCnes,
        ine: rowIne,
        boas_praticas: {
          A: getCheck('A'),
          B: getCheck('B'),
          C: getCheck('C'),
          D: getCheck('D'),
          E: getCheck('E'),
          F: getCheck('F'),
          G: getCheck('G'),
          H: getCheck('H'),
          I: getCheck('I'),
          J: getCheck('J'),
          K: getCheck('K')
        },
        nm: getCheck('NM'),
        dn: getCheck('DN')
      };
      
      registrosProcessados.push(registro);

      // Salvar no banco
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('siaps_nominal')
          .upsert({
            competencia,
            cpf: registro.cpf,
            cns: registro.cns,
            data_nascimento: registro.data_nascimento,
            sexo: registro.sexo,
            raca_cor: registro.raca_cor,
            cnes: registro.cnes,
            ine: registro.ine,
            boas_praticas: registro.boas_praticas,
            nm: registro.nm,
            dn: registro.dn
          }, { onConflict: 'cpf,competencia' });
        
        if (error) throw error;
      } else {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      inseridos++;
      
    } catch (error) {
      console.error(`Erro ao processar linha ${i}:`, error);
      erros++;
    }
  }
  
  // Registrar log
  if (isSupabaseConfigured) {
    await supabase.from('logs_importacao').insert({
      fonte: 'SIAPS_NOMINAL',
      competencia,
      registros_processados: rawData.length - headerRowIndex - 1,
      registros_inseridos: inseridos,
      registros_erro: erros,
      status: erros === 0 ? 'sucesso' : 'parcial'
    });
  }
  
  return { total: rawData.length - headerRowIndex - 1, inseridos, erros, unidade, ine, equipe, registros: registrosProcessados };
}
