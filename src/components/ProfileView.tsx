import { LogOut, User, Bell, Shield, Settings, ChevronRight } from 'lucide-react';

interface ProfileViewProps {
    onLogout: () => void;
}

export const ProfileView = ({ onLogout }: ProfileViewProps) => {

    const handleLogout = () => {
        if (confirm("Deseja realmente sair da sua conta?")) {
            localStorage.removeItem('isAuthenticated');
            onLogout();
        }
    };

    return (
        <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 overflow-y-auto relative text-white">
            {/* Decoração de fundo */}
            <div className="absolute top-[10%] left-[-20%] w-72 h-72 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>

            {/* Cabeçalho do Perfil */}
            <div className="sticky top-0 z-20 w-full p-4 glass-panel border-b-0 flex flex-col gap-4 animate-fade-in">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Perfil & Ajustes</h1>

                <div className="flex items-center gap-4 mt-2 mb-2">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/20 flex items-center justify-center p-1 shadow-xl">
                        <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center">
                            <User size={28} className="text-blue-400" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold text-white tracking-wide">João Silva</h2>
                        <span className="text-sm text-zinc-400 font-medium">Entregador Nível 1</span>
                    </div>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-6 animate-slide-up mt-2">
                {/* Seção 1: Configurações Conta */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2">Configurações da Conta</h3>
                    <div className="glass-panel rounded-2xl flex flex-col divide-y divide-white/5 overflow-hidden border border-white/10">

                        <button className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3 text-zinc-300">
                                <div className="bg-blue-500/10 p-2 rounded-xl"><User size={18} className="text-blue-400" /></div>
                                <span className="font-medium text-sm">Dados Pessoais</span>
                            </div>
                            <ChevronRight size={18} className="text-zinc-500" />
                        </button>

                        <button className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3 text-zinc-300">
                                <div className="bg-purple-500/10 p-2 rounded-xl"><Shield size={18} className="text-purple-400" /></div>
                                <span className="font-medium text-sm">Privacidade e Senha</span>
                            </div>
                            <ChevronRight size={18} className="text-zinc-500" />
                        </button>

                    </div>
                </div>

                {/* Seção 2: Sistema */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2">Sistema do App</h3>
                    <div className="glass-panel rounded-2xl flex flex-col divide-y divide-white/5 overflow-hidden border border-white/10">

                        <button className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3 text-zinc-300">
                                <div className="bg-emerald-500/10 p-2 rounded-xl"><Bell size={18} className="text-emerald-400" /></div>
                                <span className="font-medium text-sm">Notificações e Alertas</span>
                            </div>
                            <ChevronRight size={18} className="text-zinc-500" />
                        </button>

                        <button className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3 text-zinc-300">
                                <div className="bg-orange-500/10 p-2 rounded-xl"><Settings size={18} className="text-orange-400" /></div>
                                <span className="font-medium text-sm">Preferências (Mapa, GPS)</span>
                            </div>
                            <ChevronRight size={18} className="text-zinc-500" />
                        </button>

                    </div>
                </div>

                {/* Logout Zone */}
                <div className="mt-8 px-2 flex flex-col items-center">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl py-4 font-bold transition-colors mb-4"
                    >
                        <LogOut size={20} />
                        Sair da Conta (Logout)
                    </button>
                    <span className="text-[10px] text-zinc-600 font-mono">Route Vision App • v1.0.0 (Beta)</span>
                </div>
            </div>
        </div>
    );
};
