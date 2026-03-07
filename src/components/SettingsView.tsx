import { clearAllUserData } from '../services/db';

interface SettingsViewProps {
    onBack: () => void;
    onNavigateToAdmin: () => void;
    onLogout: () => void;
}

export const SettingsView = ({ onBack, onNavigateToAdmin, onLogout }: SettingsViewProps) => {
    const handleClearData = async () => {
        if (confirm("ATENÇÃO: Isso apagará TODOS os seus endereços, rotas e configurações. O processo é irreversível. Deseja continuar?")) {
            await clearAllUserData();
            window.location.reload();
        }
    };

    return (
        <div className="fixed inset-0 z-[12000] bg-[#f8fafc] flex flex-col font-sans animate-in fade-in slide-in-from-right-5 duration-300">
            {/* Header */}
            <header className="px-6 pt-12 pb-6 flex items-center justify-between bg-white border-b border-gray-100 shadow-sm">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center size-10 rounded-full bg-gray-50 text-gray-400 active:scale-90 transition-all"
                >
                    <span className="material-symbols-outlined !text-[24px]">arrow_back</span>
                </button>
                <h1 className="text-[17px] font-bold text-gray-800">Ajustes</h1>
                <div className="size-10"></div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
                {/* Account Section */}
                <div className="space-y-4">
                    <h3 className="text-[11px] font-black text-gray-300 uppercase tracking-widest px-1">Conta & Sistema</h3>
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                        <button
                            onClick={onNavigateToAdmin}
                            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors border-b border-gray-50 group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="size-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                                    <span className="material-symbols-outlined !text-[22px]">admin_panel_settings</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-[15px] font-bold text-gray-800">Painel do Administrador</p>
                                    <p className="text-[12px] text-gray-400">Gerenciar usuários e permissões</p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-gray-300 group-hover:translate-x-1 transition-transform">chevron_right</span>
                        </button>

                        <button
                            onClick={handleClearData}
                            className="w-full flex items-center justify-between p-5 hover:bg-red-50 transition-colors border-b border-gray-50 group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="size-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
                                    <span className="material-symbols-outlined !text-[22px]">delete_sweep</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-[15px] font-bold text-gray-800">Limpar Dados do App</p>
                                    <p className="text-[12px] text-gray-400">Apagar todo o histórico e cache</p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-gray-300">chevron_right</span>
                        </button>

                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="size-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                                    <span className="material-symbols-outlined !text-[22px]">logout</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-[15px] font-bold text-gray-800 text-gray-600">Sair da Conta</p>
                                    <p className="text-[12px] text-gray-400">Fazer logoff do dispositivo</p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-gray-300">logout</span>
                        </button>
                    </div>
                </div>

                {/* About Section */}
                <div className="space-y-4">
                    <h3 className="text-[11px] font-black text-gray-300 uppercase tracking-widest px-1">Informações</h3>
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
                        <div className="size-16 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl flex items-center justify-center text-blue-500 mb-4 shadow-inner">
                            <span className="material-symbols-outlined !text-[32px]">rocket_launch</span>
                        </div>
                        <h4 className="text-[16px] font-bold text-gray-800">RouteVision Premium</h4>
                        <p className="text-[13px] text-gray-400 mb-4">Versão 2.4.0 (Build 2026)</p>
                        <div className="w-full pt-4 border-t border-gray-50 flex justify-around">
                            <div className="text-center">
                                <p className="text-[14px] font-bold text-gray-800">1.2k</p>
                                <p className="text-[10px] font-black text-gray-300 uppercase">Paradas</p>
                            </div>
                            <div className="text-center border-l border-gray-50 pl-8">
                                <p className="text-[14px] font-bold text-gray-800">48</p>
                                <p className="text-[10px] font-black text-gray-300 uppercase">Rotas</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="p-8 text-center">
                <p className="text-[11px] font-black text-gray-200 uppercase tracking-[0.3em]">Built by Antigravity AI</p>
            </footer>
        </div>
    );
};
