import { useEffect, useState } from 'react';
import { clearAllUserData } from '../services/db';

interface SideNavProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
    onNavigateToAdmin: () => void;
    onNavigateToRecords: () => void;
    onAddStops: () => void;
    onNavigateToHome: () => void;
}

export const SideNav = ({ isOpen, onClose, onLogout, onNavigateToAdmin, onNavigateToRecords, onAddStops, onNavigateToHome }: SideNavProps) => {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Handle pressing escape to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (openMenuId && !(e.target as HTMLElement).closest('.route-menu-container')) {
                setOpenMenuId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousedown', handleClickOutside);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, openMenuId]);

    const handleClearData = async () => {
        if (confirm("ATENÇÃO: Isso apagará TODOS os seus endereços, rotas e configurações. O processo é irreversível. Deseja continuar?")) {
            await clearAllUserData();
            window.location.reload();
        }
    };

    const handleDeleteRoute = (date: string) => {
        if (confirm(`Deseja excluir a rota de ${date}?`)) {
            alert(`Rota de ${date} excluída com sucesso!`);
            setOpenMenuId(null);
        }
    };

    if (!isOpen) return null;

    const routes = [
        { id: 'r1', section: 'Próximas rotas', items: [{ date: '07 de mar.', day: 'sábado' }] },
        { id: 'r2', section: 'Hoje', items: [{ date: '06 de mar.', day: 'sexta-feira' }] },
        { id: 'r3', section: 'Início desta semana', items: [{ date: '04 de mar.', day: 'quarta-feira' }, { date: '02 de mar.', day: 'segunda-feira' }] },
        { id: 'r4', section: 'fev. de 2026', items: [{ date: '27 de fev.', day: 'sexta-feira' }, { date: '23 de fev.', day: 'segunda-feira' }, { date: '20 de fev.', day: 'sexta-feira Rota 4' }] },
    ];

    return (
        <div className="fixed inset-0 z-[12000] font-sans antialiased">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
                onClick={onClose}
            />

            {/* Sidebar Plate */}
            <div
                className="absolute top-0 left-0 bottom-0 w-[85%] max-w-[340px] bg-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
                {/* Header Section */}
                <div className="relative pt-6 px-6 pb-4 bg-gradient-to-b from-cyan-50/50 to-transparent">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button className="text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined !text-[24px]">help</span>
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onNavigateToRecords}
                                className="flex items-center gap-2 bg-[#f0f4ff] px-4 py-2 rounded-full text-blue-600 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined !text-[20px]">location_on</span>
                                <span className="text-[12px] font-bold uppercase tracking-tight">Endereços</span>
                            </button>
                            <button
                                onClick={onNavigateToAdmin}
                                className="text-gray-400 hover:text-gray-600 p-1"
                            >
                                <span className="material-symbols-outlined !text-[24px]">settings</span>
                            </button>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h1 className="text-[20px] font-black text-gray-900 tracking-tight">+5531995610728</h1>
                    </div>

                    {/* Team Selector Card */}
                    <div className="bg-[#f0f9f8] border border-[#e0f2f1] rounded-[1.25rem] p-4 flex items-center justify-between shadow-sm active:scale-[0.98] transition-transform cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-full bg-[#dcf2f0] flex items-center justify-center text-[#2d9e94]">
                                <span className="material-symbols-outlined !text-[28px]">group</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[15px] font-bold text-gray-800 leading-tight">Swm Transportes</span>
                                <span className="text-[13px] text-gray-400 font-medium leading-tight">Equipe</span>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-gray-300 !text-[20px]">unfold_more</span>
                    </div>
                </div>

                {/* Routes List */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 no-scrollbar pb-32">
                    {routes.map((group, idx) => (
                        <div key={idx} className="space-y-4">
                            <h3 className="text-[11px] font-black text-gray-300 uppercase tracking-[0.15em]">{group.section}</h3>
                            <div className="space-y-3">
                                {group.items.map((item, i) => {
                                    const menuId = `${idx}-${i}`;
                                    const isMenuOpen = openMenuId === menuId;

                                    return (
                                        <div
                                            key={i}
                                            onClick={() => { onNavigateToHome(); onClose(); }}
                                            className="flex items-center justify-between group cursor-pointer border-b border-gray-50 pb-3 last:border-0 relative active:opacity-70 transition-opacity"
                                        >
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-[15px] font-bold text-blue-500/80">{item.date}</span>
                                                <span className="text-[15px] font-bold text-gray-800">{item.day}</span>
                                            </div>

                                            <div
                                                className="route-menu-container"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(isMenuOpen ? null : menuId);
                                                    }}
                                                    className={`text-gray-300 group-hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-gray-100 ${isMenuOpen ? 'text-blue-500 bg-gray-100' : ''}`}
                                                >
                                                    <span className="material-symbols-outlined !text-[20px]">more_vert</span>
                                                </button>

                                                {isMenuOpen && (
                                                    <div className="absolute right-0 top-8 w-40 bg-white border border-gray-100 shadow-xl rounded-2xl p-2 z-[13000] animate-in fade-in zoom-in duration-200">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteRoute(item.date);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined !text-[18px]">delete</span>
                                                            <span className="text-[13px] font-bold">Excluir rota</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Footer Actions (Moved here from main menu but styled to fit) */}
                    <div className="pt-8 border-t border-gray-50 space-y-1 opacity-40 hover:opacity-100 transition-opacity">
                        <button onClick={handleClearData} className="w-full flex items-center gap-3 px-2 py-2 text-[12px] font-bold text-gray-400 hover:text-red-500 transition-colors">
                            <span className="material-symbols-outlined !text-[18px]">delete_forever</span>
                            Limpar Dados do App
                        </button>
                        <button onClick={onLogout} className="w-full flex items-center gap-3 px-2 py-2 text-[12px] font-bold text-gray-400 hover:text-gray-900 transition-colors">
                            <span className="material-symbols-outlined !text-[18px]">logout</span>
                            Sair da Conta
                        </button>
                    </div>
                </div>

                {/* Fixed Bottom Button */}
                <div className="p-6 bg-gradient-to-t from-white via-white to-transparent pt-8">
                    <button
                        onClick={() => { onAddStops(); onClose(); }}
                        className="w-full h-[56px] bg-[#2970ff] hover:bg-[#1a60f0] text-white font-bold rounded-[1rem] flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(41,112,255,0.3)] active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined !text-[24px]">add</span>
                        Criar rota
                    </button>
                </div>
            </div>
        </div>
    );
};
