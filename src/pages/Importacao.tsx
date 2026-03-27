import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { processarArquivoSIAPSNominal } from '../lib/importacao/processador-siaps-nominal';
import { processarArquivoESUSPEC } from '../lib/importacao/processador-esus-pec';
import { processarArquivoSISABCadastro } from '../lib/importacao/processador-sisab-cadastro';
import { processarArquivoSISABProducao } from '../lib/importacao/processador-sisab-producao';
import { detectarTipoArquivo, TipoArquivo } from '../lib/importacao/detector';
import { cruzarDadosPorCPF } from '../lib/importacao/cruzador';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Importacao() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resultados, setResultados] = useState<any>(null);

  const [isClearing, setIsClearing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
    setUploadStatus('idle');
    setResultados(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDrop as any,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv']
    },
    maxFiles: 5
  } as any);

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setUploadStatus('idle');
    
    try {
      const competencia = '202403';
      let totalInseridos = 0;
      let totalErros = 0;
      let infoUnidade = 'Não identificada';
      let infoIne = 'Não identificado';
      let infoEquipe = 'Não identificada';

      const esusMap = new Map<string, any>();
      const siapsMap = new Map<string, any>();
      const teamInfoMap = new Map<string, { unidade: string; ine: string; equipe: string }>();

      console.log('Iniciando processamento de arquivos...', files.map(f => f.name));
      
      for (const file of files) {
        let res;
        const tipo = await detectarTipoArquivo(file);
        
        console.log(`Processando arquivo: ${file.name} (Tipo detectado: ${tipo})`);
        
        if (tipo === TipoArquivo.SIAPS_NOMINAL) {
          res = await processarArquivoSIAPSNominal(file, competencia);
          if (res.registros && res.registros.length > 0) {
            console.log(`SIAPS: ${res.registros.length} registros encontrados.`);
            res.registros.forEach(reg => {
              siapsMap.set(reg.cpf, reg);
              if (reg.ine) {
                teamInfoMap.set(reg.ine, { 
                  unidade: reg.cnes || res.unidade || 'Não identificada', 
                  ine: reg.ine, 
                  equipe: res.equipe || 'Não identificada' 
                });
              }
            });
          }
        } else if (tipo === TipoArquivo.ESUS_PEC) {
          res = await processarArquivoESUSPEC(file, competencia);
          if (res.registros && res.registros.length > 0) {
            console.log(`e-SUS: ${res.registros.length} registros encontrados.`);
            res.registros.forEach(reg => {
              esusMap.set(reg.cpf, reg);
              if (reg.ine) {
                teamInfoMap.set(reg.ine, { 
                  unidade: res.unidade || 'Não identificada', 
                  ine: reg.ine, 
                  equipe: res.equipe || 'Não identificada' 
                });
              }
            });
          }
        } else if (tipo === TipoArquivo.SISAB_CADASTRO) {
          res = await processarArquivoSISABCadastro(file, competencia);
          if (res.registros && res.registros.length > 0) {
            console.log(`SISAB Cadastro: ${res.registros.length} registros encontrados.`);
            res.registros.forEach(reg => {
              esusMap.set(reg.cpf, reg);
              if (reg.ine) {
                teamInfoMap.set(reg.ine, { 
                  unidade: res.unidade || 'Não identificada', 
                  ine: reg.ine, 
                  equipe: res.equipe || 'Não identificada' 
                });
              }
            });
          }
        } else if (tipo === TipoArquivo.SISAB_PRODUCAO) {
          res = await processarArquivoSISABProducao(file, competencia);
          if (res.registros && res.registros.length > 0) {
            console.log(`SISAB Produção: ${res.registros.length} registros encontrados.`);
            res.registros.forEach(reg => {
              siapsMap.set(reg.cpf, reg);
              if (reg.ine) {
                teamInfoMap.set(reg.ine, { 
                  unidade: reg.cnes || res.unidade || 'Não identificada', 
                  ine: reg.ine, 
                  equipe: res.equipe || 'Não identificada' 
                });
              }
            });
          }
        } else {
          // Fallback: tentar SIAPS se o tipo for desconhecido
          console.warn(`Tipo de arquivo desconhecido para ${file.name}. Tentando processar como SIAPS.`);
          res = await processarArquivoSIAPSNominal(file, competencia);
          if (res.registros && res.registros.length > 0) {
            res.registros.forEach(reg => {
              siapsMap.set(reg.cpf, reg);
              if (reg.ine) {
                teamInfoMap.set(reg.ine, { 
                  unidade: reg.cnes || res.unidade || 'Não identificada', 
                  ine: reg.ine, 
                  equipe: res.equipe || 'Não identificada' 
                });
              }
            });
          }
        }
        
        if (res) {
          totalInseridos += res.inseridos;
          totalErros += res.erros;
          
          if (res.unidade && res.unidade !== 'Não identificada') infoUnidade = res.unidade;
          if (res.ine && res.ine !== 'Não identificado') infoIne = res.ine;
          if (res.equipe && res.equipe !== 'Não identificada') infoEquipe = res.equipe;
        }
      }

      console.log('Iniciando cruzamento de dados...');
      const cruzamento = await cruzarDadosPorCPF(competencia);
      console.log('Cruzamento concluído:', cruzamento);
      
      if (!isSupabaseConfigured) {
        const allCpfs = new Set([...esusMap.keys(), ...siapsMap.keys()]);
        console.log(`Total de CPFs únicos para importar (demo mode): ${allCpfs.size}`);
        
        if (allCpfs.size === 0) {
          toast.warning('Nenhum registro válido foi encontrado nos arquivos para importação.');
        }

        const importedPacientes: any[] = [];

        allCpfs.forEach(cpf => {
          const esus = esusMap.get(cpf);
          const siaps = siapsMap.get(cpf);
          
          const reg = esus || siaps;
          const age = reg.data_nascimento ? new Date().getFullYear() - new Date(reg.data_nascimento).getFullYear() : 0;
          
          const patientIne = siaps?.ine || esus?.ine || infoIne;
          const teamInfo = teamInfoMap.get(patientIne);
          
          importedPacientes.push({
            id: cpf,
            nome: esus?.nome || `Paciente ${cpf}`,
            cpf: cpf,
            cns: siaps?.cns || esus?.cns || 'N/A',
            idade: age,
            equipe: teamInfo?.equipe || infoEquipe,
            ine: patientIne,
            status: 'ativo',
            alertas: siaps?.boas_praticas?.A ? [] : ['pre_natal'],
            boas_praticas: siaps?.boas_praticas || {
              A: false, B: false, C: false, D: false, E: false, F: false, G: false, H: false, I: false, J: false, K: false
            }
          });
        });

        const existingPacientes = JSON.parse(localStorage.getItem('demo_pacientes') || '[]');
        const mergedPacientes = [...existingPacientes];
        importedPacientes.forEach(imp => {
          const idx = mergedPacientes.findIndex(p => p.cpf === imp.cpf);
          if (idx >= 0) {
            // Merge carefully: don't overwrite with "N/A" or default name if we have better info
            const existing = mergedPacientes[idx];
            mergedPacientes[idx] = { 
              ...existing, 
              ...imp,
              nome: imp.nome.startsWith('Paciente ') && !existing.nome.startsWith('Paciente ') ? existing.nome : imp.nome,
              cns: imp.cns === 'N/A' && existing.cns !== 'N/A' ? existing.cns : imp.cns,
              boas_praticas: imp.boas_praticas.A || imp.boas_praticas.B ? imp.boas_praticas : existing.boas_praticas
            };
          } else {
            mergedPacientes.push(imp);
          }
        });

        localStorage.setItem('demo_pacientes', JSON.stringify(mergedPacientes));

        // Update teams
        const existingEquipes = JSON.parse(localStorage.getItem('demo_equipes') || '[]');
        const updatedEquipes = [...existingEquipes];

        teamInfoMap.forEach((info, ineKey) => {
          const idx = updatedEquipes.findIndex(e => e.ine === ineKey);
          const count = mergedPacientes.filter(p => p.ine === ineKey).length;
          
          if (idx >= 0) {
            updatedEquipes[idx] = {
              ...updatedEquipes[idx],
              nome: info.equipe !== 'Não identificada' ? info.equipe : updatedEquipes[idx].nome,
              cnes: info.unidade !== 'Não identificada' ? info.unidade : updatedEquipes[idx].cnes,
              pacientes: count
            };
          } else {
            updatedEquipes.push({
              id: ineKey,
              ine: ineKey,
              nome: info.equipe !== 'Não identificada' ? info.equipe : 'Equipe Nova',
              tipo: 'eSF',
              cnes: info.unidade !== 'Não identificada' ? info.unidade : '1234567',
              municipio: 'Demo',
              ativa: true,
              pacientes: count,
              isf: 8.5
            });
          }
        });

        localStorage.setItem('demo_equipes', JSON.stringify(updatedEquipes));
      }

      setResultados({
        inseridos: totalInseridos,
        erros: totalErros,
        cruzados: cruzamento.totalCruzados,
        naoCruzados: cruzamento.naoCruzados.length,
        unidade: infoUnidade,
        ine: infoIne,
        equipe: infoEquipe,
        breakdown: {
          gestantes: Array.from(siapsMap.values()).filter(r => 
            r.boas_praticas.A || r.boas_praticas.B || r.boas_praticas.G || r.boas_praticas.H || r.boas_praticas.K
          ).length,
          ind1: Array.from(siapsMap.values()).filter(r => r.boas_praticas.A && r.boas_praticas.B).length,
          ind2: Array.from(siapsMap.values()).filter(r => r.boas_praticas.G && r.boas_praticas.H).length,
          ind3: Array.from(siapsMap.values()).filter(r => r.boas_praticas.K).length,
        }
      });

      setUploadStatus('success');
      setFiles([]);
    } catch (error) {
      console.error('Erro na importação:', error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLimparDados = async () => {
    const confirmMsg = isSupabaseConfigured 
      ? 'Tem certeza que deseja excluir TODOS os dados do banco de dados (pacientes, vínculos e equipes)? Esta ação é IRREVERSÍVEL.'
      : 'Tem certeza que deseja excluir todos os dados de demonstração (equipes e pacientes)?';

    if (window.confirm(confirmMsg)) {
      setIsClearing(true);
      try {
        if (!isSupabaseConfigured) {
          localStorage.removeItem('demo_pacientes');
          localStorage.removeItem('demo_equipes');
          toast.success('Dados de demonstração excluídos com sucesso.');
        } else {
          const { supabase } = await import('../lib/supabase');
          
          // Delete in order to respect foreign keys if any
          await supabase.from('vinculos').delete().neq('id', -1);
          await supabase.from('equipe_indicadores').delete().neq('id', -1);
          await supabase.from('cidadaos').delete().neq('id', '00000000000');
          await supabase.from('equipes').delete().neq('ine', '0');
          
          toast.success('Banco de dados limpo com sucesso.');
        }
        setResultados(null);
        setUploadStatus('idle');
      } catch (error) {
        console.error('Erro ao limpar dados:', error);
        toast.error('Erro ao limpar os dados.');
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Importação de Dados</h1>
          <p className="text-slate-500 mt-1">Faça o upload dos relatórios do e-SUS PEC ou SIAPS para atualizar os indicadores.</p>
        </div>
        <button 
          onClick={handleLimparDados}
          disabled={isClearing}
          className="flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md text-sm font-bold transition-colors disabled:opacity-50"
        >
          {isClearing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          LIMPAR TODOS OS DADOS
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}
          `}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {isDragActive ? 'Solte os arquivos aqui...' : 'Arraste e solte arquivos aqui'}
          </h3>
          <p className="text-slate-500 mb-6">ou clique para selecionar arquivos do seu computador</p>
          <div className="flex justify-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)</span>
            <span className="flex items-center gap-1"><FileSpreadsheet className="w-4 h-4" /> CSV (.csv)</span>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-8">
            <h4 className="font-medium text-slate-900 mb-4">Arquivos Selecionados</h4>
            <ul className="space-y-3">
              {files.map((file, index) => (
                <li key={index} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles(files.filter((_, i) => i !== index));
                    }}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={handleUpload}
                disabled={isUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5" />
                    Iniciar Importação
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {uploadStatus === 'success' && resultados && (
          <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div className="w-full">
              <h4 className="text-sm font-medium text-emerald-800">Importação concluída com sucesso!</h4>
              <p className="text-sm text-emerald-600 mt-1 mb-3">Os dados foram processados e os indicadores atualizados.</p>
              
              <div className="bg-white rounded border border-emerald-100 p-4 mb-4">
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Identificação do Arquivo</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Unidade (CNES)</p>
                    <p className="text-sm font-medium text-slate-800">{resultados.unidade}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Equipe</p>
                    <p className="text-sm font-medium text-slate-800">{resultados.equipe}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">INE</p>
                    <p className="text-sm font-medium text-slate-800">{resultados.ine}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded border border-emerald-100">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Inseridos</p>
                  <p className="text-lg font-bold text-emerald-700">{resultados.inseridos}</p>
                </div>
                <div className="bg-white p-3 rounded border border-emerald-100">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Erros</p>
                  <p className="text-lg font-bold text-rose-600">{resultados.erros}</p>
                </div>
                <div className="bg-white p-3 rounded border border-emerald-100">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Cruzados</p>
                  <p className="text-lg font-bold text-blue-600">{resultados.cruzados}</p>
                </div>
                <div className="bg-white p-3 rounded border border-emerald-100">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Não Cruzados</p>
                  <p className="text-lg font-bold text-amber-600">{resultados.naoCruzados}</p>
                </div>
              </div>

              {resultados.breakdown && resultados.breakdown.gestantes > 0 && (
                <div className="mt-6 pt-6 border-t border-emerald-200">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Detalhamento de Gestantes (Previne Brasil)</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Identificadas</p>
                      <p className="text-2xl font-black text-slate-800">{resultados.breakdown.gestantes}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                      <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Indicador 1</p>
                      <p className="text-2xl font-black text-blue-700">{resultados.breakdown.ind1}</p>
                      <p className="text-[9px] text-slate-400 mt-1">6+ Consultas + 1ª até 12ª sem.</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Indicador 2</p>
                      <p className="text-2xl font-black text-emerald-700">{resultados.breakdown.ind2}</p>
                      <p className="text-[9px] text-slate-400 mt-1">Exames Sífilis e HIV realizados</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                      <p className="text-[10px] font-bold text-purple-500 uppercase mb-1">Indicador 3</p>
                      <p className="text-2xl font-black text-purple-700">{resultados.breakdown.ind3}</p>
                      <p className="text-[9px] text-slate-400 mt-1">Atendimento Odontológico</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="mt-8 bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-rose-800">Erro na importação</h4>
              <p className="text-sm text-rose-600 mt-1">Ocorreu um erro ao processar o arquivo. Verifique o formato e tente novamente no console.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
