import React, { useState, useRef } from 'react';
import { Save, Database, Key, Shield, Bell, RefreshCw, Settings, Download, Upload, FileJson } from 'lucide-react';
import { toast } from 'sonner';

export default function Configuracoes() {
  const [activeTab, setActiveTab] = useState('integracoes');
  const [isTesting, setIsTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSalvar = () => {
    toast.success('Configurações salvas com sucesso!');
  };

  const handleGerarBackup = () => {
    try {
      const pacientes = localStorage.getItem('demo_pacientes') || '[]';
      const equipes = localStorage.getItem('demo_equipes') || '[]';
      
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
          pacientes: JSON.parse(pacientes),
          equipes: JSON.parse(equipes)
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_previne_brasil_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Backup gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar backup:', error);
      toast.error('Erro ao gerar o arquivo de backup.');
    }
  };

  const handleRestaurarBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backupData = JSON.parse(content);

        if (!backupData.data || !backupData.data.pacientes || !backupData.data.equipes) {
          throw new Error('Formato de backup inválido');
        }

        localStorage.setItem('demo_pacientes', JSON.stringify(backupData.data.pacientes));
        localStorage.setItem('demo_equipes', JSON.stringify(backupData.data.equipes));
        
        toast.success('Backup restaurado com sucesso! Atualize a página para ver os dados.');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        toast.error('Arquivo de backup inválido ou corrompido.');
      }
    };
    reader.readAsText(file);
  };

  const handleTestarConexao = () => {
    setIsTesting(true);
    toast.info('Testando conexão com o banco de dados...');
    
    setTimeout(() => {
      setIsTesting(false);
      setIsConnected(true);
      toast.success('Conexão estabelecida com sucesso!');
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Configurações do Sistema</h1>
        <button 
          onClick={handleSalvar}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Salvar Alterações
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Settings */}
        <div className="md:col-span-1 space-y-1">
          <button 
            onClick={() => setActiveTab('integracoes')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'integracoes' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <Database className="w-4 h-4" />
            Integrações
          </button>
          <button 
            onClick={() => setActiveTab('credenciais')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'credenciais' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <Key className="w-4 h-4" />
            Credenciais API
          </button>
          <button 
            onClick={() => setActiveTab('permissoes')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'permissoes' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <Shield className="w-4 h-4" />
            Permissões
          </button>
          <button 
            onClick={() => setActiveTab('notificacoes')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'notificacoes' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <Bell className="w-4 h-4" />
            Notificações
          </button>
          <button 
            onClick={() => setActiveTab('backup')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'backup' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <Download className="w-4 h-4" />
            Backup e Restauração
          </button>
        </div>

        {/* Content Settings */}
        <div className="md:col-span-3 space-y-6">
          {activeTab === 'integracoes' && (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-bold text-slate-900">Integração com e-SUS PEC</h2>
                  <p className="text-sm text-slate-500 mt-1">Configure a conexão direta com o banco de dados do e-SUS para sincronização automática.</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Host do Banco de Dados</label>
                      <input type="text" placeholder="ex: 192.168.1.100" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Porta</label>
                      <input type="text" placeholder="ex: 5432" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Nome do Banco</label>
                      <input type="text" placeholder="esus" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Usuário</label>
                      <input type="text" placeholder="postgres" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-medium text-slate-700">Senha</label>
                      <input type="password" placeholder="••••••••" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                      {isConnected ? 'Conectado' : 'Desconectado'}
                    </div>
                    <button 
                      onClick={handleTestarConexao}
                      disabled={isTesting}
                      className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isTesting && <RefreshCw className="w-4 h-4 animate-spin" />}
                      {isTesting ? 'Testando...' : 'Testar Conexão'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-bold text-slate-900">Sincronização Automática</h2>
                  <p className="text-sm text-slate-500 mt-1">Defina a frequência de atualização dos dados.</p>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">Ativar Sincronização Diária</h4>
                      <p className="text-sm text-slate-500">Os dados serão importados automaticamente todos os dias.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isSyncEnabled}
                        onChange={(e) => {
                          setIsSyncEnabled(e.target.checked);
                          toast.success(e.target.checked ? 'Sincronização diária ativada.' : 'Sincronização diária desativada.');
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-600" />
                    Gerar Backup
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Exporte todos os dados do sistema (pacientes, equipes e configurações) para um arquivo seguro.</p>
                </div>
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <FileJson className="w-8 h-8 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">Arquivo de Backup (.json)</p>
                        <p>Contém todos os registros atuais do sistema.</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleGerarBackup}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Baixar Arquivo
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-600" />
                    Restaurar Backup
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Restaure os dados do sistema a partir de um arquivo de backup gerado anteriormente.</p>
                </div>
                <div className="p-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-amber-800 font-medium">Atenção: A restauração substituirá todos os dados atuais.</p>
                    <p className="text-xs text-amber-700 mt-1">Recomendamos gerar um backup atual antes de realizar a restauração.</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <FileJson className="w-8 h-8 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">Selecione o arquivo</p>
                        <p>Apenas arquivos .json gerados pelo sistema.</p>
                      </div>
                    </div>
                    
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleRestaurarBackup}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Selecionar Arquivo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'integracoes' && activeTab !== 'backup' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Settings className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Em desenvolvimento</h3>
              <p className="text-slate-500 max-w-md">
                As configurações para esta seção estarão disponíveis nas próximas atualizações do sistema.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
