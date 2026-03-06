import { useState, useEffect } from 'react';
import { getRecords, deleteRecord } from '../services/db';
import type { LocationRecord } from '../services/db';
import { DeliveryDetailView } from './DeliveryDetailView';

interface RecordsViewProps {
    onNavigateToMap?: () => void;
    onBack?: () => void;
}

export const RecordsView = ({ onNavigateToMap, onBack }: RecordsViewProps) => {
    const [records, setRecords] = useState<LocationRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<LocationRecord | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'recent'>('all');

    useEffect(() => {
        loadRecords();
    }, []);

    const loadRecords = async () => {
        const data = await getRecords();
        setRecords(data);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Deseja excluir este registro?')) {
            await deleteRecord(id);
            setRecords(records.filter(r => r.id !== id));
        }
    };

    const filteredRecords = records.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.neighborhood || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (selectedRecord) {
        return (
            <DeliveryDetailView
                delivery={{
                    id: selectedRecord.id,
                    name: selectedRecord.name,
                    neighborhood: selectedRecord.neighborhood || 'Bairro ñ info.',
                    address: selectedRecord.city || 'Endereço ñ info.',
                    isDelivered: false,
                    distance: 'N/A',
                    eta: 'N/A',
                    lat: selectedRecord.lat?.toString(),
                    lng: selectedRecord.lng?.toString(),
                    img: selectedRecord.imageThumbnail,
                    notes: selectedRecord.notes
                }}
                onBack={() => setSelectedRecord(null)}
                onNavigateToMap={() => {
                    setSelectedRecord(null);
                    onNavigateToMap?.();
                }}
            />
        );
    }

    return (
        <div className="relative w-full h-full bg-bg-start overflow-hidden flex flex-col font-sans">
            <header className="pt-14 px-6 pb-4 bg-transparent z-10">
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={onBack}
                        className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90"
                    >
                        <span className="material-symbols-outlined !text-[24px]">arrow_back_ios_new</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90">
                            <span className="material-symbols-outlined !text-[24px]">more_vert</span>
                        </button>
                    </div>
                </div>

                <div className="flex justify-between items-end mb-8">
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase opacity-60">Base de Dados</span>
                        <h1 className="text-3xl font-black tracking-tight text-white/90 italic">Meus Endereços</h1>
                    </div>
                    <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 border-white/5 shadow-lg">
                        <span className="material-symbols-outlined text-[14px] text-primary animate-pulse">database</span>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">{records.length}</span>
                    </div>
                </div>

                <div className="relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center text-slate-500 group-focus-within:text-primary transition-colors">
                        <span className="material-symbols-outlined !text-[20px]">search</span>
                    </div>
                    <input
                        type="text"
                        placeholder="Pesquisar por nome ou bairro..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-3xl py-4 pl-14 pr-6 outline-none transition-all duration-300 placeholder:text-slate-600 focus:border-primary/50 focus:bg-white/10 text-white font-medium"
                    />
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
                <div className="flex items-center gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-500'}`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setActiveTab('recent')}
                        className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'recent' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-500'}`}
                    >
                        Recentes
                    </button>
                </div>

                <div className="space-y-4">
                    {filteredRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                            <div className="size-20 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined !text-[32px]">folder_open</span>
                            </div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white">Nenhum Registro</h3>
                            <p className="text-[10px] uppercase mt-2 font-medium text-slate-500">A sua base de dados está vazia no momento</p>
                        </div>
                    ) : (
                        filteredRecords.map((record, idx) => (
                            <div
                                key={record.id}
                                onClick={() => setSelectedRecord(record)}
                                className="glass-card rounded-[2.5rem] p-5 active:scale-[0.98] transition-all group animate-slide-up"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="size-16 rounded-[1.5rem] bg-white/5 border border-white/5 overflow-hidden p-1">
                                        {record.imageThumbnail ? (
                                            <img src={record.imageThumbnail} className="w-full h-full object-cover rounded-[1.2rem]" alt="Local" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                <span className="material-symbols-outlined !text-[24px]">image</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 pt-1">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-[17px] text-white/90 tracking-tight truncate pr-4">
                                                {record.name}
                                            </h3>
                                            <button
                                                onClick={(e) => handleDelete(record.id, e)}
                                                className="text-slate-600 hover:text-red-500 transition-colors"
                                            >
                                                <span className="material-symbols-outlined !text-[20px]">delete</span>
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1 opacity-60">
                                            <span className="material-symbols-outlined !text-[14px] text-primary">location_on</span>
                                            <p className="text-[12px] text-slate-400 font-medium truncate">
                                                {record.neighborhood ? `${record.neighborhood}, ` : ''}{record.city || 'Cidade ñ info.'}
                                            </p>
                                        </div>
                                        <div className="mt-4 flex items-center gap-3">
                                            <div className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                Protocolo {record.id.slice(0, 4).toUpperCase()}
                                            </div>
                                            <span className="material-symbols-outlined text-[16px] text-slate-700">arrow_forward</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>

            {/* Scroll Indicator Overlay */}
            <div className="fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-bg-start via-bg-start/90 to-transparent pointer-events-none z-10"></div>
        </div>
    );
};
