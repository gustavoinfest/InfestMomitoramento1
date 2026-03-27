import * as XLSX from 'xlsx';
import { normalizarCPF } from '../utils/cpf';
import { supabase, isSupabaseConfigured } from '../supabase';

export interface RegistroSISABProducao {
  cpf: string;
  cns: string;
  data_nascimento: Date;
  sexo: string;
  ine: string;
  cnes: string;
  boas_praticas: {
    A: boolean; B: boolean; C: boolean; D: boolean; E: boolean; F: boolean; G: boolean; H: boolean; I: boolean; J: boolean; K: boolean;
  };
}

export async function processarArquivoSISABProducao(
  arquivo: File,
  competencia: string
): Promise<{ total: number; inseridos: number; erros: number; unidade?: string; ine?: string; equipe?: string; registros?: RegistroSISABProducao[] }> {
  const buffer = await arquivo.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  
  let unidade = 'Não identificada';
  let ine = 'Não identificado';
  let equipe = 'Não identificada';
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(100, rawData.length); i++) {
    const row = rawData[i];
    if (!row || !Array.isArray(row)) continue;
    const rowStr = row.join('|').toUpperCase();
    
    const hasCpf = rowStr.includes('CPF') || rowStr.includes('DOCUMENTO') || rowStr.includes('CNS');
    const hasOther = rowStr.includes('NOME') || rowStr.includes('NASCIMENTO') || rowStr.includes('SEXO') || rowStr.includes('CIDADÃO');
    
    if (hasCpf && hasOther) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 0;

  const headerRow = rawData[headerRowIndex];
  const colMap: Record<string, number> = {};
  headerRow.forEach((col: any, idx: number) => {
    const name = String(col || '').trim().toUpperCase();
    if (name) colMap[name] = idx;
  });

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

  const idxCpf = findCol(['CPF', 'CPF_CNS', 'DOCUMENTO']);
  const idxCns = findCol(['CNS', 'CARTÃO SUS', 'CARTAO SUS']);
  const idxNasc = findCol(['NASCIMENTO', 'DATA DE NASCIMENTO', 'DATA NASCIMENTO', 'NASC.']);
  const idxSexo = findCol(['SEXO', 'GÊNERO', 'GENERO']);
  const idxIne = findCol(['INE', 'CÓDIGO INE', 'EQUIPE']);
  const idxCnes = findCol(['CNES', 'UNIDADE', 'ESTABELECIMENTO']);

  const getCheck = (row: any[], key: string) => {
    const possibleKeys = [key, `INDICADOR ${key}`, `IND ${key}`, `BOA PRÁTICA ${key}`, `BOA PRATICA ${key}`];
    for (const k of possibleKeys) {
      if (colMap[k] !== undefined) {
        const val = String(row[colMap[k]] || '').trim().toUpperCase();
        return val === 'X' || val === 'SIM' || val === '1' || val === 'S';
      }
    }
    return false;
  };

  const registros: RegistroSISABProducao[] = [];
  let inseridos = 0;
  let erros = 0;

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length < 2) continue;

    try {
      const cpfRaw = idxCpf !== -1 ? String(row[idxCpf] || '') : '';
      if (!cpfRaw) continue;

      const cpf = normalizarCPF(cpfRaw);
      
      const reg: RegistroSISABProducao = {
        cpf,
        cns: idxCns !== -1 ? String(row[idxCns] || '') : '',
        data_nascimento: idxNasc !== -1 ? new Date(row[idxNasc]) : new Date(),
        sexo: idxSexo !== -1 ? String(row[idxSexo] || '') : '',
        ine: idxIne !== -1 ? String(row[idxIne] || '') : '',
        cnes: idxCnes !== -1 ? String(row[idxCnes] || '') : '',
        boas_praticas: {
          A: getCheck(row, 'A'),
          B: getCheck(row, 'B'),
          C: getCheck(row, 'C'),
          D: getCheck(row, 'D'),
          E: getCheck(row, 'E'),
          F: getCheck(row, 'F'),
          G: getCheck(row, 'G'),
          H: getCheck(row, 'H'),
          I: getCheck(row, 'I'),
          J: getCheck(row, 'J'),
          K: getCheck(row, 'K')
        }
      };

      if (isSupabaseConfigured) {
        const { error } = await supabase.from('siaps_nominal').upsert({
          cpf: reg.cpf,
          cns: reg.cns,
          ine: reg.ine,
          data_nascimento: reg.data_nascimento,
          sexo: reg.sexo,
          boas_praticas: reg.boas_praticas,
          competencia
        }, { onConflict: 'cpf,competencia' });
        if (error) throw error;
      }

      registros.push(reg);
      inseridos++;
    } catch (err) {
      console.error('Erro SISAB Produção:', err);
      erros++;
    }
  }

  return { total: rawData.length - headerRowIndex - 1, inseridos, erros, unidade, ine, equipe, registros };
}
