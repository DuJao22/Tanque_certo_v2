import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { HistoryTable } from './components/HistoryTable';
import { UserManagement } from './components/UserManagement';
import { MeasurementModal } from './components/MeasurementModal';
import { Intro } from './components/Intro';
import { TANKS } from './constants';
import { TankDef } from './types';
import { Toaster } from '@/components/ui/sonner';
import { LayoutDashboard, History, Users, LogOut, Menu, X, UserCircle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AnimatePresence } from 'motion/react';

// Shell Logo Component (SVG)
export const ShellLogo = React.memo(() => (
  <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
    <path d="M15 45C15 25 30 10 50 10C70 10 85 25 85 45C85 55 80 85 50 85C20 85 15 55 15 45Z" fill="#FBCE07" stroke="#DD1D21" strokeWidth="6" />
    <path d="M50 10V45" stroke="#DD1D21" strokeWidth="6" strokeLinecap="round" />
    <path d="M30 16L42 45" stroke="#DD1D21" strokeWidth="5" strokeLinecap="round" />
    <path d="M70 16L58 45" stroke="#DD1D21" strokeWidth="5" strokeLinecap="round" />
    <path d="M18 35L34 50" stroke="#DD1D21" strokeWidth="5" strokeLinecap="round" />
    <path d="M82 35L66 50" stroke="#DD1D21" strokeWidth="5" strokeLinecap="round" />
  </svg>
));

const AppContent: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'users'>('dashboard');
  const [selectedTank, setSelectedTank] = useState<TankDef | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = useCallback(async () => {
    logout();
    toast.success("Logout realizado com sucesso.");
  }, [logout]);

  const handleSelectTank = useCallback((code: string) => {
    const tank = TANKS.find(t => t.code === code);
    if (tank) {
      setSelectedTank(tank);
      setIsModalOpen(true);
    }
  }, []);

  const roleLabels = {
    'SUPERADMIN': 'Super Administrador',
    'GERENTE': 'Gerente de Posto',
    'OPERADOR': 'Operador de Pista'
  };

  const roleColors = {
    'SUPERADMIN': 'bg-red-100 text-red-700 border-red-200',
    'GERENTE': 'bg-purple-100 text-purple-700 border-purple-200',
    'OPERADOR': 'bg-blue-100 text-blue-700 border-blue-200'
  };

  return (
    <>
      <AnimatePresence>
        {showIntro && <Intro />}
      </AnimatePresence>

      {!showIntro && (
        <>
          {!user ? (
            <Login />
          ) : (
            <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
              {/* Mobile Header */}
              <header className="md:hidden bg-white border-b border-zinc-200 p-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8">
                    <ShellLogo />
                  </div>
                  <span className="font-black tracking-tighter text-xl">TANQUE CERTO</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                  {isSidebarOpen ? <X /> : <Menu />}
                </Button>
              </header>

              {/* Sidebar Overlay */}
              {isSidebarOpen && (
                <div 
                  className="fixed inset-0 bg-black/50 z-30 md:hidden" 
                  onClick={() => setIsSidebarOpen(false)}
                />
              )}

              {/* Sidebar */}
              <aside className={`
                fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-zinc-200 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              `}>
                <div className="h-full flex flex-col p-6">
                  <div className="hidden md:flex items-center gap-3 mb-10">
                    <ShellLogo />
                    <div className="flex flex-col">
                      <span className="font-black tracking-tighter text-2xl leading-none">TANQUE CERTO</span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Volumetria v3.0</span>
                    </div>
                  </div>

                  <div className="space-y-1 flex-1">
                    <Button 
                      variant={activeTab === 'dashboard' ? 'default' : 'ghost'} 
                      className="w-full justify-start gap-3 h-12 font-bold"
                      onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
                    >
                      <LayoutDashboard className="w-5 h-5" />
                      Dashboard
                    </Button>
                    
                    {(user?.role === 'SUPERADMIN' || user?.role === 'GERENTE') && (
                      <Button 
                        variant={activeTab === 'history' ? 'default' : 'ghost'} 
                        className="w-full justify-start gap-3 h-12 font-bold"
                        onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}
                      >
                        <History className="w-5 h-5" />
                        Relatórios
                      </Button>
                    )}

                    {(user?.role === 'SUPERADMIN' || user?.role === 'GERENTE') && (
                      <Button 
                        variant={activeTab === 'users' ? 'default' : 'ghost'} 
                        className="w-full justify-start gap-3 h-12 font-bold"
                        onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
                      >
                        <Users className="w-5 h-5" />
                        Gestão
                      </Button>
                    )}
                  </div>

                  <div className="mt-auto pt-6 space-y-4">
                    <Separator />
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <UserCircle className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{user?.name}</div>
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase px-1.5 py-0 ${roleColors[user?.role || 'OPERADOR']}`}>
                          {roleLabels[user?.role || 'OPERADOR']}
                        </Badge>
                      </div>
                    </div>
                    
                    <Button variant="outline" className="w-full justify-start gap-3 h-12 font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100" onClick={handleLogout}>
                      <LogOut className="w-5 h-5" />
                      Sair do Sistema
                    </Button>
                  </div>
                </div>
              </aside>

              {/* Main Content */}
              <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
                <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
                        {activeTab === 'dashboard' ? 'Painel de Controle' : 
                         activeTab === 'history' ? 'Histórico de Medições' : 'Gestão de Acesso'}
                      </h1>
                      <p className="text-sm md:text-base text-zinc-500 font-medium">
                        {activeTab === 'dashboard' ? 'Monitoramento em tempo real dos tanques de combustível.' : 
                         activeTab === 'history' ? 'Visualize e exporte o histórico completo de volumetria.' : 'Gerencie permissões e papéis dos usuários.'}
                      </p>
                    </div>
                    
                    {activeTab === 'dashboard' && (
                      <div className="flex items-center gap-2 text-sm font-bold text-zinc-400 bg-white px-4 py-2 rounded-full border border-zinc-200 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        SISTEMA ONLINE
                      </div>
                    )}
                  </div>

                  {activeTab === 'dashboard' && <Dashboard onSelectTank={handleSelectTank} />}
                  {activeTab === 'history' && <HistoryTable />}
                  {activeTab === 'users' && <UserManagement />}
                </div>
              </main>

              <MeasurementModal 
                tank={selectedTank}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                userName={user?.name || 'Usuário'}
              />
              
              <Toaster position="top-center" richColors />
            </div>
          )}
        </>
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
