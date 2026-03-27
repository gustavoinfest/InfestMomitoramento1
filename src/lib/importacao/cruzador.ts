import { supabase, isSupabaseConfigured } from '../supabase';

export async function cruzarDadosPorCPF(
  competencia: string
): Promise<{
  totalCruzados: number;
  naoCruzados: string[];
  atualizados: number;
}> {
  if (!isSupabaseConfigured) {
    // Mock for demo mode
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      totalCruzados: 150,
      naoCruzados: ['11122233344', '55566677788'],
      atualizados: 150
    };
  }

  // 1. Buscar todos registros do SIAPS nominal
  const { data: siapsRegistros, error: siapsError } = await supabase
    .from('siaps_nominal')
    .select('*')
    .eq('competencia', competencia);
  
  if (siapsError) throw siapsError;
  
  // 2. Buscar registros do e-SUS PEC
  const { data: esusRegistros, error: esusError } = await supabase
    .from('esus_pec')
    .select('*')
    .eq('competencia', competencia);
    
  if (esusError) throw esusError;

  let totalCruzados = 0;
  const naoCruzados: string[] = [];
  let atualizados = 0;

  const esusMap = new Map(esusRegistros?.map(r => [r.cpf, r]) || []);

  // 3. Processar cruzamento e inserir/atualizar cidadãos
  for (const esus of (esusRegistros || [])) {
    try {
      // Inserir ou atualizar na tabela mestre de cidadãos
      const { error: cidadaoError } = await supabase
        .from('cidadaos')
        .upsert({
          cpf: esus.cpf,
          nome: esus.nome,
          data_nascimento: esus.data_nascimento,
          sexo: esus.sexo,
          cns: esus.cns || null
        }, { onConflict: 'cpf' });

      if (cidadaoError) throw cidadaoError;

      // Atualizar vínculo com a equipe
      const { error: vinculoError } = await supabase
        .from('vinculos')
        .upsert({
          cpf: esus.cpf,
          equipe_ine: esus.ine,
          status: 'ativo',
          data_vinculo: new Date()
        }, { onConflict: 'cpf' });

      if (vinculoError) throw vinculoError;

      atualizados++;
    } catch (err) {
      console.error(`Erro ao processar cidadão ${esus.cpf}:`, err);
    }
  }

  for (const siaps of (siapsRegistros || [])) {
    if (esusMap.has(siaps.cpf)) {
      totalCruzados++;
      // O cidadão já foi atualizado acima pois está no e-SUS
    } else {
      naoCruzados.push(siaps.cpf);
      
      // Mesmo se não estiver no e-SUS, podemos tentar inserir o cidadão com os dados do SIAPS
      try {
        await supabase
          .from('cidadaos')
          .upsert({
            cpf: siaps.cpf,
            cns: siaps.cns,
            data_nascimento: siaps.data_nascimento,
            sexo: siaps.sexo
          }, { onConflict: 'cpf' });

        await supabase
          .from('vinculos')
          .upsert({
            cpf: siaps.cpf,
            equipe_ine: siaps.ine,
            status: 'ativo',
            data_vinculo: new Date()
          }, { onConflict: 'cpf' });
          
        atualizados++;
      } catch (err) {
        console.error(`Erro ao processar cidadão do SIAPS ${siaps.cpf}:`, err);
      }
    }
  }

  // Registrar log de cruzamento
  await supabase.from('logs_cruzamento').insert({
    competencia,
    total_siaps: siapsRegistros?.length || 0,
    total_esus: esusRegistros?.length || 0,
    cruzados: totalCruzados,
    nao_cruzados: naoCruzados.length,
    cpfs_nao_cruzados: naoCruzados,
    status: 'concluido'
  });

  return {
    totalCruzados,
    naoCruzados,
    atualizados
  };
}
