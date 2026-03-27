import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, MoreVertical, CheckCircle2, XCircle, AlertCircle, X, Loader2, FileText, User, Calendar, MapPin, Phone, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const mockPacientes: any[] = [];

export default function Pacientes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'gestantes' | 'hipertensos' | 'diabeticos'>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<any>(null);
  const [pacientesList, setPacientesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const itemsPerPage = 5;

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      if (!isSupabaseConfigured) {
        // Load from localStorage if available (demo mode)
        const stored = localStorage.getItem('demo_pacientes');
        if (stored) {
          setPacientesList(JSON.parse(stored));
        } else {
          setPacientesList([]);
        }
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('cidadaos')
          .select(`
            cpf, cns, nome, data_nascimento,
            vinculos ( equipe_ine, equipes (nome) ),
            siaps_nominal ( boas_praticas )
          `)
          .limit(100);

        if (error) throw error;

        if (data && data.length > 0) {
          const formatted = data.map((d: any) => {
            const age = d.data_nascimento ? new Date().getFullYear() - new Date(d.data_nascimento).getFullYear() : 0;
            const equipeNome = d.vinculos?.[0]?.equipes?.nome || d.vinculos?.[0]?.equipe_ine || 'Sem equipe';
            // Get the latest boas_praticas if multiple exist
            const boasPraticas = d.siaps_nominal?.[0]?.boas_praticas || {
              A: false, B: false, C: false, D: false, E: false, F: false, G: false, H: false, I: false, J: false, K: false
            };
            
            return {
              id: d.cpf,
              nome: d.nome,
              cpf: d.cpf,
              cns: d.cns || 'N/A',
              idade: age,
              equipe: equipeNome,
              ine: d.vinculos?.[0]?.equipe_ine || 'N/A',
              status: 'ativo',
              alertas: [],
              boas_praticas: boasPraticas
            };
          });
          setPacientesList(formatted);
        } else {
          setPacientesList([]);
        }
      } catch (error) {
        console.error('Erro ao carregar pacientes:', error);
        toast.error('Erro ao carregar dados do banco.');
        setPacientesList([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredPacientes = useMemo(() => {
    return pacientesList.filter(p => {
      const matchesSearch = (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.cpf || '').includes(searchTerm) ||
        (p.cns || '').includes(searchTerm);
      
      if (!matchesSearch) return false;

      if (filterType === 'gestantes') {
        return p.boas_praticas && (
          p.boas_praticas.A || p.boas_praticas.B || p.boas_praticas.G || p.boas_praticas.H || p.boas_praticas.K
        );
      }
      
      return true;
    });
  }, [searchTerm, filterType, pacientesList]);

  const totalPages = Math.ceil(filteredPacientes.length / itemsPerPage);
  const paginatedPacientes = filteredPacientes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleNovoPaciente = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Paciente cadastrado com sucesso!');
    setIsModalOpen(false);
  };

  const handleVerDetalhes = (paciente: any) => {
    setSelectedPaciente(paciente);
    setIsDetailsOpen(true);
  };

  const handleAcoes = (nome: string) => {
    toast.info(`Opções para ${nome} abertas.`);
  };

  const handleFiltros = () => {
    toast.info('Painel de filtros aberto.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Pacientes e Rastreabilidade</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
        >
          Novo Paciente
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome, CPF ou CNS..." 
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="flex bg-white border border-slate-300 rounded-md p-1">
              <button 
                onClick={() => setFilterType('todos')}
                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'todos' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                TODOS
              </button>
              <button 
                onClick={() => setFilterType('gestantes')}
                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'gestantes' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                GESTANTES
              </button>
            </div>
            <button 
              onClick={handleFiltros}
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 w-full sm:w-auto justify-center"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Documentos</th>
                {filterType === 'gestantes' ? (
                  <>
                    <th className="px-6 py-4 text-center">Ind. 1</th>
                    <th className="px-6 py-4 text-center">Ind. 2</th>
                    <th className="px-6 py-4 text-center">Ind. 3</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4">Idade</th>
                    <th className="px-6 py-4">Equipe Vinculada</th>
                  </>
                )}
                <th className="px-6 py-4">Status / Alertas</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                      <p>Carregando pacientes...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedPacientes.length > 0 ? (
                paginatedPacientes.map((paciente) => (
                  <tr key={paciente.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{paciente.nome}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div>CPF: {paciente.cpf}</div>
                      <div className="text-slate-400">CNS: {paciente.cns}</div>
                    </td>
                    {filterType === 'gestantes' ? (
                      <>
                        <td className="px-6 py-4 text-center">
                          {paciente.boas_praticas.A && paciente.boas_praticas.B ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-300 mx-auto" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {paciente.boas_praticas.G && paciente.boas_praticas.H ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-300 mx-auto" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {paciente.boas_praticas.K ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-300 mx-auto" />
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {paciente.idade} anos
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {paciente.equipe}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {paciente.status === 'ativo' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" title="Ativo" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-500" title="Inativo" />
                        )}
                        
                        {paciente.alertas.length > 0 && (
                          <div className="flex gap-1">
                            {paciente.alertas.map(alerta => (
                              <span key={alerta} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                {alerta.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleVerDetalhes(paciente)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50"
                        >
                          Ver Detalhes
                        </button>
                        <button 
                          onClick={() => handleAcoes(paciente.nome)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600 bg-slate-50/50">
          <div>
            Mostrando {filteredPacientes.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredPacientes.length)} de {filteredPacientes.length} pacientes
          </div>
          <div className="flex gap-1">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detalhes do Paciente */}
      {isDetailsOpen && selectedPaciente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedPaciente.nome}</h2>
                  <p className="text-xs text-slate-500">CPF: {selectedPaciente.cpf} | INE: {selectedPaciente.ine || 'Não informado'}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Idade</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{selectedPaciente.idade} anos</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Equipe</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{selectedPaciente.equipe}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <Phone className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Contato</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">(66) 99987-9053</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    CUIDADO NA GESTAÇÃO E PUERPÉRIO
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Pontuação:</span>
                    <span className={`text-sm font-bold ${
                      (Object.values(selectedPaciente.boas_praticas || {}).filter(v => v).length / 11) >= 0.7 ? 'text-emerald-600' :
                      (Object.values(selectedPaciente.boas_praticas || {}).filter(v => v).length / 11) >= 0.4 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {Math.round((Object.values(selectedPaciente.boas_praticas || {}).filter(v => v).length / 11) * 100)}%
                    </span>
                  </div>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-700 flex items-center gap-2 mb-4">
                      <ShieldCheck className="w-4 h-4" />
                      ✅ Boas práticas CUMPRIDAS:
                    </h4>
                    <ul className="space-y-2">
                      {Object.entries(selectedPaciente.boas_praticas || {}).map(([key, value]) => (
                        value && (
                          <li key={key} className="flex items-center gap-2 text-sm text-slate-700">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">✓</span>
                            <span>
                              {key === 'A' && 'A - 1ª consulta até 12ª semana'}
                              {key === 'B' && 'B - 7 ou mais consultas'}
                              {key === 'C' && 'C - 7 ou mais aferições de pressão'}
                              {key === 'D' && 'D - 7 ou mais registros peso+altura'}
                              {key === 'E' && 'E - 3 ou mais visitas ACS'}
                              {key === 'F' && 'F - Vacina dTpa'}
                              {key === 'G' && 'G - Testes 1º trimestre'}
                              {key === 'H' && 'H - Testes 3º trimestre'}
                              {key === 'I' && 'I - Consulta puerpério'}
                              {key === 'J' && 'J - Visita ACS puerpério'}
                              {key === 'K' && 'K - Atividade saúde bucal'}
                            </span>
                          </li>
                        )
                      ))}
                      {Object.values(selectedPaciente.boas_praticas || {}).every(v => !v) && (
                        <li className="text-sm text-slate-400 italic">Nenhuma prática cumprida</li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-rose-700 flex items-center gap-2 mb-4">
                      <ShieldAlert className="w-4 h-4" />
                      ❌ Boas práticas NÃO CUMPRIDAS:
                    </h4>
                    <ul className="space-y-2">
                      {Object.entries(selectedPaciente.boas_praticas || {}).map(([key, value]) => (
                        !value && (
                          <li key={key} className="flex items-center gap-2 text-sm text-slate-700">
                            <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-bold">✗</span>
                            <span>
                              {key === 'A' && 'A - 1ª consulta até 12ª semana'}
                              {key === 'B' && 'B - 7 ou mais consultas'}
                              {key === 'C' && 'C - 7 ou mais aferições de pressão'}
                              {key === 'D' && 'D - 7 ou mais registros peso+altura'}
                              {key === 'E' && 'E - 3 ou mais visitas ACS'}
                              {key === 'F' && 'F - Vacina dTpa'}
                              {key === 'G' && 'G - Testes 1º trimestre'}
                              {key === 'H' && 'H - Testes 3º trimestre'}
                              {key === 'I' && 'I - Consulta puerpério'}
                              {key === 'J' && 'J - Visita ACS puerpério'}
                              {key === 'K' && 'K - Atividade saúde bucal'}
                            </span>
                          </li>
                        )
                      ))}
                      {Object.values(selectedPaciente.boas_praticas || {}).every(v => v) && (
                        <li className="text-sm text-slate-400 italic">Todas as práticas cumpridas!</li>
                      )}
                    </ul>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      (Object.values(selectedPaciente.boas_praticas || {}).filter(v => v).length / 11) >= 0.7 ? 'bg-emerald-100 text-emerald-800' :
                      (Object.values(selectedPaciente.boas_praticas || {}).filter(v => v).length / 11) >= 0.4 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {(Object.values(selectedPaciente.boas_praticas || {}).filter(v => v).length / 11) >= 0.7 ? 'EXCELENTE' :
                       (Object.values(selectedPaciente.boas_praticas || {}).filter(v => v).length / 11) >= 0.4 ? 'REGULAR' : 'CRÍTICO'}
                    </span>
                  </div>
                  <button className="text-xs font-bold text-blue-600 hover:underline">Imprimir Relatório</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Paciente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Novo Paciente</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleNovoPaciente} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: João da Silva" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                  <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="000.000.000-00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CNS</label>
                  <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="700000000000000" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                  Salvar Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
