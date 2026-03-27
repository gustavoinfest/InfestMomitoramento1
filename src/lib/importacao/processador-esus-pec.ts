import * as XLSX from 'xlsx';
import { normalizarCPF } from '../utils/cpf';
import { supabase, isSupabaseConfigured } from '../supabase';

export interface RegistroESUSPEC {
  cpf: string;
  nome: string;
  ine: string;
  data_nascimento: Date;
  sexo: string;
  identidade_genero: string;
  telefone: string;
  endereco: string;
  data_atualizacao: Date;
}

export async function processarArquivoESUSPEC(
  arquivo: File,
  competencia: string
): Promise<{ total: number; inseridos: number; erros: number; unidade?: string; ine?: string; equipe?: string; registros?: RegistroESUSPEC[] }> {
  const buffer = await arquivo.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  // Ler como array de arrays para encontrar o cabeçalho e os dados
  const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  
  let inseridos = 0;
  let erros = 0;
  const registros: RegistroESUSPEC[] = [];
  
  let unidade = 'Não identificada';
  let ine = 'Não identificado';
  let equipe = 'Não identificada';

  // Encontrar o cabeçalho e info da unidade
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(100, rawData.length); i++) {
    const colunas = rawData[i];
    if (!colunas || !Array.isArray(colunas)) continue;
    const linhaStr = colunas.join('|').toUpperCase();
    
    const hasCpf = linhaStr.includes('CPF') || linhaStr.includes('DOCUMENTO') || linhaStr.includes('CNS');
    const hasOther = linhaStr.includes('NOME') || linhaStr.includes('NASCIMENTO') || linhaStr.includes('SEXO') || linhaStr.includes('CIDADÃO');
    
    if (hasCpf && hasOther) {
      headerRowIndex = i;
    }

    for (let j = 0; j < colunas.length; j++) {
      const colOriginal = String(colunas[j] || '').trim();
      const col = colOriginal.toUpperCase();
      if (!col) continue;

      const getVal = (keyword: string) => {
        let val = '';
        if (col.includes(':')) {
          val = colOriginal.substring(col.indexOf(':') + 1).trim();
        }
        if (!val && colunas[j + 1]) {
          val = String(colunas[j + 1]).trim();
        }
        val = val.replace(/^["']|["']$/g, '').trim();
        
        if (!val && col.length > keyword.length) {
          const idx = col.indexOf(keyword);
          val = colOriginal.substring(idx + keyword.length).trim();
          val = val.replace(/^[-=:]\s*/, '').trim();
        }
        return val;
      };

      if (col.includes('UNIDADE') || col.includes('UBS') || col.includes('USF') || col.includes('CNES')) {
        let keyword = col.includes('UNIDADE') ? 'UNIDADE' : col.includes('UBS') ? 'UBS' : col.includes('USF') ? 'USF' : 'CNES';
        let val = getVal(keyword);
        const m = val.match(/^\d+\s*-\s*(.+)$/);
        if (m) val = m[1].trim();
        if (val && unidade === 'Não identificada') unidade = val;
      }
      else if (col.includes('EQUIPE')) {
        let val = getVal('EQUIPE');
        const m = val.match(/^\d+\s*-\s*(.+)$/);
        if (m) val = m[1].trim();
        if (val && equipe === 'Não identificada') equipe = val;
      }
      else if (col.includes('INE')) {
        let val = getVal('INE');
        const m = val.match(/\d+/);
        if (m && ine === 'Não identificado') ine = m[0];
      }
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0; // Tentar a primeira linha se não achar
  }

  const headerRow = rawData[headerRowIndex];
  const colMap: Record<string, number> = {};
  headerRow.forEach((col: any, idx: number) => {
    const name = String(col || '').trim().toUpperCase().replace(/"/g, '');
    if (name) colMap[name] = idx;
  });

  // Helper to find column index by multiple possible names
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

  const idxCpf = findCol(['CPF', 'CPF/CNS', 'DOCUMENTO', 'CNS']);
  const idxNome = findCol(['NOME', 'NOME DO CIDADÃO', 'NOME COMPLETO', 'CIDADÃO']);
  const idxIne = findCol(['INE', 'CÓDIGO INE', 'EQUIPE (INE)', 'EQUIPE']);
  const idxNasc = findCol(['NASCIMENTO', 'DATA DE NASCIMENTO', 'DATA NASCIMENTO', 'NASC.', 'DATA DE NASC.']);
  const idxSexo = findCol(['SEXO']);
  const idxGenero = findCol(['IDENTIDADE DE GÊNERO', 'GÊNERO', 'GENERO', 'IDENTIDADE GÊNERO']);
  const idxTel = findCol(['TELEFONE', 'CELULAR', 'FONE', 'CONTATO']);
  const idxEnd = findCol(['ENDEREÇO', 'LOGRADOURO', 'ENDERECO', 'RUA']);
  const idxAtu = findCol(['DATA DE ATUALIZAÇÃO', 'ATUALIZAÇÃO', 'ÚLTIMA ATUALIZAÇÃO', 'ATUALIZADO EM']);

  // Pular cabeçalhos
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const colunas = rawData[i];
    if (!colunas || colunas.length < 2) continue;
    
    try {
      const cpfRaw = idxCpf !== -1 ? String(colunas[idxCpf] || '') : '';
      if (!cpfRaw) continue;

      const cpf = normalizarCPF(cpfRaw);
      const nome = idxNome !== -1 ? String(colunas[idxNome] || '').replace(/"/g, '') : '';
      const rowIne = idxIne !== -1 ? String(colunas[idxIne] || '').replace(/"/g, '') : ine;
      
      if (!cpf || !nome) continue;
      
      // Se não achou no cabeçalho, pega da primeira linha válida
      if (ine === 'Não identificado' && rowIne && rowIne !== 'Não identificado') ine = rowIne;
      
      registros.push({
        cpf,
        nome,
        ine: rowIne || ine,
        data_nascimento: idxNasc !== -1 ? new Date(colunas[idxNasc]) : new Date(),
        sexo: idxSexo !== -1 ? String(colunas[idxSexo] || '') : '',
        identidade_genero: idxGenero !== -1 ? String(colunas[idxGenero] || '') : '',
        telefone: idxTel !== -1 ? String(colunas[idxTel] || '') : '',
        endereco: idxEnd !== -1 ? String(colunas[idxEnd] || '') : '',
        data_atualizacao: idxAtu !== -1 ? new Date(colunas[idxAtu]) : new Date()
      });
      
    } catch (error) {
      console.error(`Erro ao processar linha ${i}:`, error);
      erros++;
    }
  }

  
  // Salvar no banco
  for (const registro of registros) {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('esus_pec')
          .upsert({
            ine: registro.ine,
            cpf: registro.cpf,
            nome: registro.nome,
            data_nascimento: registro.data_nascimento,
            sexo: registro.sexo,
            identidade_genero: registro.identidade_genero,
            telefone: registro.telefone,
            endereco: registro.endereco,
            data_atualizacao: registro.data_atualizacao,
            competencia
          }, { onConflict: 'cpf,ine,competencia' });
        
        if (error) throw error;
      } else {
        // Mock delay for demo mode
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      inseridos++;
      
    } catch (error) {
      console.error(`Erro ao salvar CPF ${registro.cpf}:`, error);
      erros++;
    }
  }
  
  // Registrar log
  if (isSupabaseConfigured) {
    await supabase.from('logs_importacao').insert({
      fonte: 'ESUS_PEC',
      competencia,
      registros_processados: registros.length,
      registros_inseridos: inseridos,
      registros_erro: erros,
      status: erros === 0 ? 'sucesso' : 'parcial'
    });
  }
  
  return { total: registros.length, inseridos, erros, unidade, ine, equipe, registros };
}
