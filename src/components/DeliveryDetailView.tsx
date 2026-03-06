import { Phone, MapPin, StickyNote, Package, CheckCircle2, MessageSquare, ChevronLeft } from 'lucide-react';
import type { LocationRecord } from '../services/db';

interface DeliveryDetailViewProps {
    record: LocationRecord | null;
    onClose: () => void;
    onConfirm?: () => void;
}

export const DeliveryDetailView = ({ record, onClose, onConfirm }: DeliveryDetailViewProps) => {
    if (!record) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-[#0F172A] flex flex-col font-sans animate-in fade-in slide-in-from-bottom-5 duration-500 overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A] to-[#1E293B] pointer-events-none"></div>

            {/* Header HUD */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 pt-14 pb-6 flex items-center justify-between bg-[#0F172A]/40 backdrop-blur-md border-b border-white/5">
                <button
                    onClick={onClose}
                    className="flex items-center justify-center size-12 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="text-center">
                    <h1 className="text-lg font-bold tracking-tight text-white/90">Detalhes da Entrega</h1>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-medium font-mono">ID #{record.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="size-12"></div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar pt-36 pb-44 px-6 space-y-6">
                {/* Profile Card */}
                <section className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[40px] rounded-full -mr-16 -mt-16"></div>

                    <div className="flex items-start justify-between mb-8 relative z-10">
                        <div className="space-y-2">
                            <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entrega Prioritária</span>
                            <h2 className="text-2xl font-bold text-white/90 tracking-tight leading-tight">{record.name}</h2>
                            <div className="flex items-center gap-2 text-slate-400">
                                <Phone size={14} className="text-primary" />
                                <span className="text-sm font-medium">+55 11 99823-4412</span>
                            </div>
                        </div>
                        <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/20 bg-white/5 shadow-xl">
                            {record.imageThumbnail ? (
                                <img src={record.imageThumbnail} alt="Etiqueta" className="w-full h-full object-cover opacity-90" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center opacity-20">
                                    <Package size={32} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-white/10 relative z-10">
                        <div className="flex gap-4">
                            <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                                <MapPin size={20} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Endereço de Entrega</p>
                                <p className="text-[15px] text-white/90 leading-relaxed font-medium">
                                    {record.name}<br />
                                    {record.neighborhood ? `${record.neighborhood}, ` : ''}{record.city || 'São Paulo'}, SP
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Instructions Section */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <StickyNote size={18} className="text-slate-400" />
                        <h3 className="text-xs font-bold text-white/90 uppercase tracking-[0.15em]">Instruções</h3>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 shadow-inner">
                        <p className="text-[15px] text-white/90 leading-relaxed font-normal opacity-80">
                            {record.notes || 'Nenhuma instrução adicional foi registrada para este endereço carregado via sistema.'}
                            {record.notes && <span className="text-blue-400 font-semibold ml-2">Cuidado: frágil.</span>}
                        </p>
                    </div>
                </section>

                {/* Order Items Section */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <Package size={18} className="text-slate-400" />
                        <h3 className="text-xs font-bold text-white/90 uppercase tracking-[0.15em]">Itens do Pedido</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group active:bg-white/10 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                    <span className="text-sm font-bold text-slate-400">01</span>
                                </div>
                                <div>
                                    <p className="text-[15px] font-semibold text-white/90">Pacote Logístico</p>
                                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">Identificado via Scan</p>
                                </div>
                            </div>
                            <CheckCircle2 size={20} className="text-emerald-500/40" />
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group active:bg-white/10 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                    <span className="text-sm font-bold text-slate-400">02</span>
                                </div>
                                <div>
                                    <p className="text-[15px] font-semibold text-white/90">Documentação Auxiliar</p>
                                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">Protocolo de Entrega</p>
                                </div>
                            </div>
                            <CheckCircle2 size={20} className="text-emerald-500/40" />
                        </div>
                    </div>
                </section>
            </main>

            {/* Sticky Footer */}
            <footer className="fixed bottom-0 left-0 right-0 p-6 pb-12 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/90 to-transparent z-[60]">
                <div className="flex gap-4">
                    <button className="flex items-center justify-center h-16 w-16 bg-white/5 border border-white/10 rounded-2xl active:scale-95 transition-all shadow-xl group">
                        <svg className="size-7 text-white/90" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"></path>
                        </svg>
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 h-16 rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#0A84FF] shadow-[0_8px_20px_rgba(0,122,255,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        <span className="text-white font-bold text-base tracking-wide">Confirmar Entrega</span>
                        <CheckCircle2 size={20} className="text-white" />
                    </button>
                </div>
            </footer>
        </div>
    );
};
