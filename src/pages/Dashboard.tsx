import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Activity, 
  AlertCircle,
  Stethoscope
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Dashboard() {
  const [municipio, setMunicipio] = useState('todos');
  const [equipe, setEquipe] = useState('todas');
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const storedP = localStorage.getItem('demo_pacientes');
      const storedE = localStorage.getItem('demo_equipes');
      if (storedP) setPacientes(JSON.parse(storedP));
      if (storedE) setEquipes(JSON.parse(storedE));
    }
  }, []);

  const stats = useMemo(() => {
    const totalPacientes = pacientes.length;
    const gestantes = pacientes.filter(p => 
      p.boas_praticas?.A || p.boas_praticas?.B || p.boas_praticas?.G || p.boas_praticas?.H || p.boas_praticas?.K
    ).length;
    
    const ind1 = gestantes > 0 ? (pacientes.filter(p => p.boas_praticas?.A && p.boas_praticas?.B).length / gestantes) * 100 : 0;
    const ind2 = gestantes > 0 ? (pacientes.filter(p => p.boas_praticas?.G && p.boas_praticas?.H).length / gestantes) * 100 : 0;
    const ind3 = gestantes > 0 ? (pacientes.filter(p => p.boas_praticas?.K).length / gestantes) * 100 : 0;

    return {
      totalPacientes,
      gestantes,
      ind1: Math.round(ind1),
      ind2: Math.round(ind2),
      ind3: Math.round(ind3)
    };
  }, [pacientes]);

  const chartData = useMemo(() => {
    // In a real app, this would be grouped by month from the database
    // For now, returning empty to respect "leave all data blank"
    return [];
  }, []);

  const indicadores = [
    { id: 1, nome: 'Pré-Natal (6 consultas)', valor: `${stats.ind1}%`, meta: '45%', status: stats.ind1 >= 45 ? 'success' : 'warning' },
    { id: 2, nome: 'Pré-Natal (Sífilis/HIV)', valor: `${stats.ind2}%`, meta: '60%', status: stats.ind2 >= 60 ? 'success' : 'warning' },
    { id: 3, nome: 'Gestantes Odonto', valor: `${stats.ind3}%`, meta: '60%', status: stats.ind3 >= 60 ? 'success' : 'warning' },
    { id: 4, nome: 'Cobertura Citopatológico', valor: '0%', meta: '40%', status: 'danger' },
    { id: 5, nome: 'Vacinação (Polio/Penta)', valor: '0%', meta: '95%', status: 'danger' },
    { id: 6, nome: 'Hipertensão (PA aferida)', valor: '0%', meta: '50%', status: 'danger' },
    { id: 7, nome: 'Diabetes (Hemoglobina)', valor: '0%', meta: '50%', status: 'danger' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Visão Geral - Saúde Brasil 360º</h1>
        <div className="flex gap-2">
          <select 
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 rounded-md px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="todos">Todos os Municípios</option>
            <option value="sao_paulo">São Paulo</option>
            <option value="rio">Rio de Janeiro</option>
          </select>
          <select 
            value={equipe}
            onChange={(e) => setEquipe(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 rounded-md px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="todas">Todas as Equipes</option>
            <option value="alpha">Equipe Alpha</option>
            <option value="beta">Equipe Beta</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Pacientes Vinculados</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalPacientes.toLocaleString('pt-BR')}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
            <span className="text-emerald-500 font-medium">+0%</span>
            <span className="text-slate-500 ml-2">vs mês anterior</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">ISF Médio</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">0.0</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
              <Activity className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
            <span className="text-emerald-500 font-medium">+0.0</span>
            <span className="text-slate-500 ml-2">vs quadrimestre ant.</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Atendimentos (Mês)</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">0</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
            <span className="text-emerald-500 font-medium">+0%</span>
            <span className="text-slate-500 ml-2">vs mês anterior</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Pacientes em Alerta</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">0</p>
            </div>
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-slate-500 font-medium italic">Nenhum alerta pendente</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Evolução dos Indicadores</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <Line type="monotone" dataKey="preNatal" stroke="#3b82f6" strokeWidth={2} name="Pré-Natal" />
                <Line type="monotone" dataKey="hipertensao" stroke="#10b981" strokeWidth={2} name="Hipertensão" />
                <Line type="monotone" dataKey="diabetes" stroke="#8b5cf6" strokeWidth={2} name="Diabetes" />
                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" vertical={false} />
                <XAxis dataKey="name" tick={{fill: '#64748b'}} tickLine={false} axisLine={false} />
                <YAxis tick={{fill: '#64748b'}} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Desempenho Atual vs Meta</h2>
          <div className="space-y-4">
            {indicadores.map((ind) => (
              <div key={ind.id} className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-700">{ind.nome}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Meta: {ind.meta}</span>
                    <span className={`font-bold ${
                      ind.status === 'success' ? 'text-emerald-600' : 
                      ind.status === 'warning' ? 'text-amber-500' : 'text-rose-500'
                    }`}>
                      {ind.valor}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      ind.status === 'success' ? 'bg-emerald-500' : 
                      ind.status === 'warning' ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                    style={{ width: ind.valor }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
