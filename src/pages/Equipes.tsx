import React, { useState, useEffect, useMemo } from 'react';
import { Users, Activity, CheckCircle2, XCircle, X, Loader2, Search, Filter, MoreVertical, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const mockEquipes: any[] = [];

export default function Equipes() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedEquipe, setSelectedEquipe] = useState<any>(null);
  const [equipesList, setEquipesList] = useState<any[]>([]);
  const [pacientesList, setPacientesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      
      // Load patients for the details view
      if (!isSupabaseConfigured) {
        const storedPacientes = localStorage.getItem('demo_pacientes');
        if (storedPacientes) {
          setPacientesList(JSON.parse(storedPacientes));
        }
      } else {
        const { data: pData } = await supabase.from('cidadaos').select('*, vinculos(equipe_ine)');
        if (pData) setPacientesList(pData);
      }

      if (!isSupabaseConfigured) {
        const stored = localStorage.getItem('demo_equipes');
        if (stored) {
          setEquipesList(JSON.parse(stored));
        } else {
          setEquipesList([]);
        }
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('equipes')
          .select('*');

        if (error) throw error;

        if (data && data.length > 0) {
          const formatted = data.map((d: any) => ({
            id: d.ine,
            ine: d.ine,
            nome: d.nome,
            tipo: d.tipo_equipe,
            cnes: d.cnes,
            municipio: 'Município',
            ativa: d.ativa,
            pacientes: 0,
            isf: 0
          }));
          setEquipesList(formatted);
        } else {
          setEquipesList([]);
        }
      } catch (error) {
        console.error('Erro ao carregar equipes:', error);
        toast.error('Erro ao carregar dados do banco.');
        setEquipesList([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const handleNovaEquipe = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Equipe cadastrada com sucesso!');
    setIsModalOpen(false);
  };

  const handleVerDetalhes = (equipe: any) => {
    setSelectedEquipe(equipe);
    setIsDetailsOpen(true);
  };

  const filteredPacientes = useMemo(() => {
    if (!selectedEquipe) return [];
    return pacientesList.filter(p => 
      (p.equipe === selectedEquipe.nome || p.ine === selectedEquipe.ine || p.vinculos?.[0]?.equipe_ine === selectedEquipe.ine) &&
      ((p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.cpf || '').includes(searchTerm))
    );
  }, [selectedEquipe, pacientesList, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Gestão de Equipes</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
        >
          Nova Equipe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
            <p>Carregando equipes...</p>
          </div>
        ) : equipesList.length > 0 ? (
          equipesList.map((equipe) => (
            <div key={equipe.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{equipe.nome}</h3>
                  <p className="text-sm text-slate-500">INE: {equipe.ine}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  equipe.ativa ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {equipe.ativa ? 'Ativa' : 'Inativa'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Tipo</span>
                  <span className="font-medium text-slate-900">{equipe.tipo}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">CNES</span>
                  <span className="font-medium text-slate-900">{equipe.cnes}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Município</span>
                  <span className="font-medium text-slate-900">{equipe.municipio}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1 text-slate-500 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Pacientes</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900">{equipe.pacientes.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-slate-500 mb-1">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">ISF Atual</span>
                  </div>
                  <p className="text-xl font-bold text-blue-600">{equipe.isf.toFixed(1)}</p>
                </div>
              </div>
              
              <div className="mt-6">
                <button 
                  onClick={() => handleVerDetalhes(equipe)}
                  className="w-full py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Ver Detalhes
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-500">
            Nenhuma equipe encontrada.
          </div>
        )}
      </div>

      {/* Modal Detalhes da Equipe */}
      {isDetailsOpen && selectedEquipe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedEquipe.nome}</h2>
                  <p className="text-xs text-slate-500">INE: {selectedEquipe.ine} | CNES: {selectedEquipe.cnes}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar pacientes nesta equipe..." 
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="text-sm text-slate-500 font-medium">
                {filteredPacientes.length} pacientes encontrados
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold sticky top-0 z-10">
                    <th className="px-6 py-3">Paciente</th>
                    <th className="px-6 py-3">CPF</th>
                    <th className="px-6 py-3">Idade</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredPacientes.length > 0 ? (
                    filteredPacientes.map((paciente) => (
                      <tr key={paciente.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{paciente.nome}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {paciente.cpf}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {paciente.idade} anos
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-blue-600 hover:underline text-sm font-medium">Ver Prontuário</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                        Nenhum paciente vinculado a esta equipe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Equipe */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Nova Equipe</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleNovaEquipe} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Equipe</label>
                <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: Equipe Esperança" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">INE</label>
                  <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="0000000000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CNES</label>
                  <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="0000000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Equipe</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
                  <option>eSF - Equipe de Saúde da Família</option>
                  <option>eAP - Equipe de Atenção Primária</option>
                  <option>eSB - Equipe de Saúde Bucal</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                  Salvar Equipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
