import * as XLSX from 'xlsx';

export enum TipoArquivo {
  SIAPS_NOMINAL = 'SIAPS_NOMINAL',
  ESUS_PEC = 'ESUS_PEC',
  SISAB_CADASTRO = 'SISAB_CADASTRO',
  SISAB_PRODUCAO = 'SISAB_PRODUCAO',
  DESCONHECIDO = 'DESCONHECIDO'
}

export async function detectarTipoArquivo(arquivo: File): Promise<TipoArquivo> {
  try {
    const buffer = await arquivo.arrayBuffer();
    const workbook = XLSX.read(buffer, { sheetRows: 50 }); // Ler apenas as primeiras 50 linhas para detecção
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    
    const content = rawData.map(row => (row || []).join('|').toUpperCase()).join('\n');

    // SIAPS Nominal
    if (content.includes('SIAPS') && content.includes('NOMINAL') && content.includes('CPF')) {
      return TipoArquivo.SIAPS_NOMINAL;
    }

    // e-SUS PEC (Lista de Cidadãos ou Relatórios)
    if (content.includes('E-SUS') && (content.includes('PEC') || content.includes('CIDADÃO') || content.includes('CIDADAO'))) {
      return TipoArquivo.ESUS_PEC;
    }
    
    // SISAB Cadastro
    if (content.includes('SISAB') && (content.includes('CADASTRO') || content.includes('INDIVIDUAL'))) {
      return TipoArquivo.SISAB_CADASTRO;
    }

    // SISAB Produção
    if (content.includes('SISAB') && (content.includes('PRODUÇÃO') || content.includes('PRODUCAO'))) {
      return TipoArquivo.SISAB_PRODUCAO;
    }

    // Fallback por cabeçalhos comuns
    const headers = content.split('\n').find(l => l.includes('CPF') || l.includes('CNS'));
    if (headers) {
      if (headers.includes('BOA PRÁTICA') || headers.includes('INDICADOR')) return TipoArquivo.SIAPS_NOMINAL;
      if (headers.includes('IDENTIDADE DE GÊNERO') || headers.includes('GENERO')) return TipoArquivo.ESUS_PEC;
    }

    return TipoArquivo.DESCONHECIDO;
  } catch (error) {
    console.error('Erro ao detectar tipo de arquivo:', error);
    return TipoArquivo.DESCONHECIDO;
  }
}
