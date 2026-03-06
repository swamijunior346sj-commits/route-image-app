import { useEffect } from 'react';
import { clearAllUserData } from '../services/db';

interface SideNavProps {
    isOpen: boolean;
    onClose: () => void;
    currentTab: 'scanner' | 'map' | 'records' | 'dailyRoute';
    setTab: (tab: 'scanner' | 'map' | 'records' | 'dailyRoute') => void;
    userEmail?: string;
    isPro: boolean;
    onLogout: () => void;
    onNavigateToAdmin: () => void;
}

export const SideNav = ({ isOpen, onClose, currentTab, setTab, userEmail, isPro, onLogout, onNavigateToAdmin }: SideNavProps) => {
    const tabs = [
        { id: 'dailyRoute', icon: 'route', label: 'Rota do Dia' },
        { id: 'map', icon: 'map', label: 'Mapa de Entrega' },
        { id: 'scanner', icon: 'qr_code_scanner', label: 'Scan Inteligente' },
        { id: 'records', icon: 'format_list_bulleted', label: 'Histórico' },
    ] as const;

    // Handle pressing escape to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleClearData = async () => {
        if (confirm("ATENÇÃO: Isso apagará TODOS os seus endereços, rotas e configurações. O processo é irreversível. Deseja continuar?")) {
            await clearAllUserData();
            window.location.reload();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[12000] font-sans">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
                onClick={onClose}
            />

            {/* Sidebar Plate */}
            <div
                className="absolute top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-bg-start border-r border-white/5 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300"
            >
                {/* Header */}
                <div className="p-8 pb-6 border-b border-white/5 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined !text-[20px]">close</span>
                    </button>

                    <div className="size-16 rounded-[1.5rem] bg-gradient-to-tr from-primary to-accent flex items-center justify-center mb-4 shadow-premium">
                        <span className="material-symbols-outlined text-white !text-[32px]">local_shipping</span>
                    </div>
                    <h2 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Route<span className="text-primary">Vision</span>
                    </h2>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                        Logística Neural
                    </p>

                    {userEmail && (
                        <div className="mt-6 flex items-center gap-3">
                            <div className="size-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/20">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail}`} className="w-full h-full object-cover" alt="Avatar" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-white font-bold truncate">{userEmail}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <div className={`size-1.5 rounded-full ${isPro ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'}`}></div>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${isPro ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {isPro ? 'PRO' : 'Básico'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2 no-scrollbar">
                    <p className="px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 opacity-60">Navegação Principal</p>
                    {tabs.map((tab) => {
                        const isActive = currentTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setTab(tab.id);
                                    if (navigator.vibrate) navigator.vibrate(20);
                                    onClose();
                                }}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${isActive
                                    ? 'bg-primary/10 border border-primary/30 text-primary shadow-premium'
                                    : 'bg-transparent text-slate-400 hover:bg-white/5'
                                    }`}
                            >
                                <span className={`material-symbols-outlined !text-[24px] ${isActive ? 'text-primary' : 'text-slate-500'}`}>
                                    {tab.icon}
                                </span>
                                <span className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}

                    <div className="pt-4 space-y-2">
                        <p className="px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 opacity-60">Administração</p>
                        <button
                            onClick={() => { onNavigateToAdmin(); onClose(); }}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-red-400 hover:bg-red-400/5 transition-all"
                        >
                            <span className="material-symbols-outlined !text-[24px]">admin_panel_settings</span>
                            <span className="text-xs font-black uppercase tracking-widest">Painel Admin</span>
                        </button>
                    </div>

                    <div className="pt-4 space-y-2">
                        <p className="px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 opacity-60">Minha Conta</p>
                        <button
                            onClick={handleClearData}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-slate-500 hover:bg-white/5 transition-all"
                        >
                            <span className="material-symbols-outlined !text-[22px]">delete_sweep</span>
                            <span className="text-xs font-black uppercase tracking-widest">Limpar Todos Dados</span>
                        </button>
                        <button
                            onClick={() => { onLogout(); onClose(); }}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-slate-500 hover:bg-white/5 transition-all"
                        >
                            <span className="material-symbols-outlined !text-[22px]">logout</span>
                            <span className="text-xs font-black uppercase tracking-widest">Sair da Conta</span>
                        </button>
                    </div>
                </div>

                {/* Footer Link / Info */}
                <div className="p-6 border-t border-white/5 text-center mt-auto">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em]">
                        RouteVision Engine v2.5
                    </p>
                </div>
            </div>
        </div>
    );
};
