import * as XLSX from 'xlsx';
import { normalizarCPF } from '../utils/cpf';
import { supabase, isSupabaseConfigured } from '../supabase';

export interface RegistroSISABCadastro {
  cpf: string;
  cns: string;
  nome: string;
  data_nascimento: Date;
  sexo: string;
  ine: string;
  cnes: string;
}

export async function processarArquivoSISABCadastro(
  arquivo: File,
  competencia: string
): Promise<{ total: number; inseridos: number; erros: number; unidade?: string; ine?: string; equipe?: string; registros?: RegistroSISABCadastro[] }> {
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
  const idxNome = findCol(['NOME', 'NOME DO CIDADÃO', 'NOME COMPLETO', 'CIDADÃO']);
  const idxNasc = findCol(['NASCIMENTO', 'DATA DE NASCIMENTO', 'DATA NASCIMENTO', 'NASC.']);
  const idxSexo = findCol(['SEXO', 'GÊNERO', 'GENERO']);
  const idxIne = findCol(['INE', 'CÓDIGO INE', 'EQUIPE']);
  const idxCnes = findCol(['CNES', 'UNIDADE', 'ESTABELECIMENTO']);

  const registros: RegistroSISABCadastro[] = [];
  let inseridos = 0;
  let erros = 0;

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length < 2) continue;

    try {
      const cpfRaw = idxCpf !== -1 ? String(row[idxCpf] || '') : '';
      if (!cpfRaw) continue;

      const cpf = normalizarCPF(cpfRaw);
      const nome = idxNome !== -1 ? String(row[idxNome] || '') : `Cidadão ${cpf}`;
      
      const reg: RegistroSISABCadastro = {
        cpf,
        cns: idxCns !== -1 ? String(row[idxCns] || '') : '',
        nome,
        data_nascimento: idxNasc !== -1 ? new Date(row[idxNasc]) : new Date(),
        sexo: idxSexo !== -1 ? String(row[idxSexo] || '') : '',
        ine: idxIne !== -1 ? String(row[idxIne] || '') : '',
        cnes: idxCnes !== -1 ? String(row[idxCnes] || '') : ''
      };

      if (isSupabaseConfigured) {
        const { error } = await supabase.from('esus_pec').upsert({
          cpf: reg.cpf,
          nome: reg.nome,
          ine: reg.ine,
          data_nascimento: reg.data_nascimento,
          sexo: reg.sexo,
          competencia
        }, { onConflict: 'cpf,ine,competencia' });
        if (error) throw error;
      }

      registros.push(reg);
      inseridos++;
    } catch (err) {
      console.error('Erro SISAB Cadastro:', err);
      erros++;
    }
  }

  return { total: rawData.length - headerRowIndex - 1, inseridos, erros, unidade, ine, equipe, registros };
}
