import { useState, useEffect, useRef } from 'react';
import { getRecords, deleteRecord, updateRecord, saveRecord, getDailyRoute, updateDailyRoute } from '../services/db';
import type { LocationRecord } from '../services/db';
import { DeliveryDetailView } from './DeliveryDetailView';
import { EditAddressView } from './EditAddressView';
import { LoadingOverlay } from './LoadingOverlay';
import { ConfirmationModal } from './ConfirmationModal';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface RecordsViewProps {
    onNavigateToMap?: () => void;
    onBack?: () => void;
}

export const RecordsView = ({ onNavigateToMap, onBack }: RecordsViewProps) => {
    const [records, setRecords] = useState<LocationRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<LocationRecord | null>(null);
    const [editingRecord, setEditingRecord] = useState<LocationRecord | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'recent'>('all');
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationLog, setOptimizationLog] = useState('');
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'info'
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const longPressTimer = useRef<any>(null);

    useEffect(() => {
        loadRecords();
    }, []);

    const loadRecords = async () => {
        const data = await getRecords();
        setRecords(data);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredRecords.length) {
            setSelectedIds([]);
            setIsSelectionMode(false);
        } else {
            setSelectedIds(filteredRecords.map(r => r.id));
            setIsSelectionMode(true);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        setModalConfig({
            isOpen: true,
            title: "Excluir Selecionados",
            message: `Deseja excluir permanentemente os ${selectedIds.length} registros selecionados?`,
            type: 'danger',
            onConfirm: async () => {
                for (const id of selectedIds) {
                    await deleteRecord(id);
                }
                setRecords(records.filter(r => !selectedIds.includes(r.id)));
                setSelectedIds([]);
                setIsSelectionMode(false);
            }
        });
    };

    const handleLongPress = (id: string) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedIds([id]);
            if (navigator.vibrate) navigator.vibrate(50);
        }
    };

    const handleTouchStart = (id: string) => {
        longPressTimer.current = setTimeout(() => handleLongPress(id), 600);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setModalConfig({
            isOpen: true,
            title: "Excluir Registro",
            message: "Tem certeza que deseja excluir este endereço? Esta ação não pode ser desfeita.",
            type: 'danger',
            onConfirm: async () => {
                await deleteRecord(id);
                setRecords(records.filter(r => r.id !== id));
            }
        });
    };

    const handleEdit = (record: LocationRecord, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingRecord(record);
    };

    const handleSaveEdit = async (updatedFields: Partial<LocationRecord>) => {
        if (!editingRecord) return;
        const updated = await updateRecord(editingRecord.id, updatedFields);
        if (updated) {
            setRecords(records.map(r => r.id === editingRecord.id ? updated : r));
        }
        setEditingRecord(null);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportStatus('Lendo arquivo...');
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                let data: any[] = [];
                const extension = file.name.split('.').pop()?.toLowerCase();

                setImportStatus('Decodificando dados...');
                if (extension === 'csv') {
                    const text = evt.target?.result as string;
                    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
                    data = result.data;
                } else {
                    const bstr = evt.target?.result;
                    const workbook = XLSX.read(bstr, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    data = XLSX.utils.sheet_to_json(worksheet);
                }

                if (data.length === 0) {
                    alert('Nenhum dado encontrado na planilha.');
                    setIsImporting(false);
                    return;
                }

                const geocoder = new google.maps.Geocoder();
                const newRecords: LocationRecord[] = [];

                let count = 0;
                for (const row of data) {
                    count++;
                    const name = row.Nome || row.Destinatario || row.name || 'Sem Nome';
                    setImportStatus(`Geocodificando: ${count} de ${data.length}\n${name}`);

                    const address = row.Endereco || row.Address || row.address || '';
                    const neighborhood = row.Bairro || row.neighborhood || '';
                    const city = row.Cidade || row.city || '';
                    const fullAddress = `${address}, ${neighborhood}, ${city}`.trim();

                    let lat: number | null = null;
                    let lng: number | null = null;

                    if (fullAddress) {
                        try {
                            const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
                                geocoder.geocode({ address: fullAddress }, (results, status) => {
                                    if (status === 'OK' && results) resolve(results);
                                    else reject(status);
                                });
                            });
                            lat = result[0].geometry.location.lat();
                            lng = result[0].geometry.location.lng();
                        } catch (e) {
                            console.warn(`Erro geocoding: ${fullAddress}`, e);
                        }
                    }

                    const rec = await saveRecord(name, lat, lng, '', [], {
                        neighborhood,
                        city: address || city,
                        notes: row.Notas || row.Notes || ''
                    });
                    newRecords.push(rec);
                }

                setImportStatus('Sincronizando base de dados...');
                setRecords(prev => [...newRecords, ...prev]);
                await new Promise(r => setTimeout(r, 800));
                alert(`${newRecords.length} endereços importados e geolocalizados com sucesso!`);
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

            } catch (err) {
                console.error(err);
                alert('Erro ao processar arquivo.');
            } finally {
                setIsImporting(false);
                setImportStatus('');
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsBinaryString(file);
        }
    };

    const handleSmartSnap = async () => {
        if (selectedIds.length < 2) {
            alert('Selecione pelo menos 2 endereços para otimizar.');
            return;
        }

        setIsOptimizing(true);
        setOptimizationLog('Iniciando Motores de IA...');

        try {
            const selectedRecords = records.filter(r => selectedIds.includes(r.id));

            setOptimizationLog('Localizando seu dispositivo...');
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
            });
            const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };

            const pointsToOptimize = selectedRecords.filter(p => p.lat !== null && p.lng !== null);

            if (pointsToOptimize.length === 0) {
                setOptimizationLog('Nenhum ponto válido para otimizar.');
                await new Promise(r => setTimeout(r, 1000));
                setIsOptimizing(false);
                return;
            }

            setOptimizationLog('Processando Matriz de Distância...');
            const service = new google.maps.DistanceMatrixService();
            const response = await service.getDistanceMatrix({
                origins: [origin],
                destinations: pointsToOptimize.map(p => ({ lat: p.lat!, lng: p.lng! })),
                travelMode: google.maps.TravelMode.DRIVING,
            });

            if (response.rows[0].elements) {
                setOptimizationLog('IA calculando melhor trajetória...');
                const distances = response.rows[0].elements.map((el, idx) => ({
                    index: idx,
                    distance: el.distance?.value || 999999
                }));

                const sortedPoints = [...pointsToOptimize].sort((a, b) => {
                    if (a.isReturnPoint) return 1;
                    if (b.isReturnPoint) return -1;
                    if (a.deadline && !b.deadline) return -1;
                    if (!a.deadline && b.deadline) return 1;
                    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);

                    const distA = distances.find(d => pointsToOptimize[d.index].id === a.id)?.distance || 0;
                    const distB = distances.find(d => pointsToOptimize[d.index].id === b.id)?.distance || 0;
                    return distA - distB;
                });

                // Update sequence in state (just visual feedback for now or we could save a 'defaultSequence')
                // For now, let's just select them in order
                setSelectedIds(sortedPoints.map(p => p.id));
                setOptimizationLog('Protocolos reordenados com sucesso!');
                if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (error) {
            console.error(error);
            alert('Falha na otimização.');
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleSendToRoute = async () => {
        if (selectedIds.length === 0) return;

        setIsOptimizing(true);
        setOptimizationLog('Enviando para o Roteiro do Dia...');

        try {
            const selectedRecords = records.filter(r => selectedIds.includes(r.id));
            const dailyPoints = await getDailyRoute();

            const newPoints = selectedRecords.map(r => ({
                id: r.id,
                name: r.name,
                lat: r.lat,
                lng: r.lng,
                scannedAt: Date.now(),
                neighborhood: r.neighborhood,
                city: r.city,
                deadline: r.deadline,
                isReturnPoint: r.isReturnPoint,
                notes: r.notes
            }));

            // Merge avoiding duplicates
            const currentIds = new Set(dailyPoints.map(p => p.id));
            const filteredNewPoints = newPoints.filter(p => !currentIds.has(p.id));

            await updateDailyRoute([...dailyPoints, ...filteredNewPoints]);

            setOptimizationLog('Sucesso! Redirecionando...');
            await new Promise(r => setTimeout(r, 800));
            setIsSelectionMode(false);
            setSelectedIds([]);
            if (onNavigateToMap) onNavigateToMap(); // Assuming map has access to daily route or we trigger change tab

        } catch (error) {
            console.error(error);
            alert('Falha ao enviar rota.');
        } finally {
            setIsOptimizing(false);
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

    if (editingRecord) {
        return (
            <EditAddressView
                item={editingRecord}
                onSave={handleSaveEdit}
                onBack={() => setEditingRecord(null)}
            />
        );
    }

    return (
        <div className="relative w-full h-full bg-bg-start overflow-hidden flex flex-col font-sans">
            <header className="pt-14 px-6 pb-4 bg-transparent z-10">
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={isSelectionMode ? () => { setIsSelectionMode(false); setSelectedIds([]); } : onBack}
                        className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90"
                    >
                        <span className="material-symbols-outlined !text-[24px]">{isSelectionMode ? 'close' : 'arrow_back_ios_new'}</span>
                    </button>

                    <div className="flex items-center gap-2 overflow-hidden">
                        {isSelectionMode ? (
                            <div className="flex items-center gap-2 animate-slide-left transition-all duration-500">
                                <button
                                    onClick={toggleSelectAll}
                                    className="px-4 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all whitespace-nowrap"
                                >
                                    {selectedIds.length === filteredRecords.length ? 'Desmarcar' : 'Tudo'}
                                </button>

                                <button
                                    onClick={handleSmartSnap}
                                    className="flex items-center justify-center size-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 active:scale-95 transition-all shadow-lg"
                                    title="Otimizar Percurso (Smart Snap)"
                                >
                                    <span className="material-symbols-outlined !text-[22px]">auto_fix_high</span>
                                </button>

                                <button
                                    onClick={handleSendToRoute}
                                    className="flex items-center justify-center h-10 px-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 active:scale-95 transition-all flex gap-2"
                                >
                                    <span className="material-symbols-outlined !text-[20px]">send</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Enviar</span>
                                </button>

                                <button
                                    onClick={handleDeleteSelected}
                                    className="flex items-center justify-center size-10 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 active:scale-95 transition-all"
                                >
                                    <span className="material-symbols-outlined !text-[22px]">delete</span>
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsSelectionMode(true)}
                                    className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90"
                                >
                                    <span className="material-symbols-outlined !text-[22px]">checklist</span>
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".csv, .xlsx, .xls"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isImporting}
                                    className="flex items-center justify-center size-10 rounded-full bg-primary/10 border border-primary/20 active:scale-95 transition-all text-primary shadow-lg shadow-primary/10"
                                >
                                    <span className="material-symbols-outlined !text-[24px]">{isImporting ? 'sync' : 'upload_file'}</span>
                                </button>
                            </>
                        )}
                        <button className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90">
                            <span className="material-symbols-outlined !text-[24px]">more_vert</span>
                        </button>
                    </div>
                </div>

                <div className="flex justify-between items-end mb-8">
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase opacity-60">
                            {isSelectionMode ? `${selectedIds.length} Selecionados` : 'Base de Dados'}
                        </span>
                        <h1 className="text-3xl font-black tracking-tight text-white/90 italic">
                            {isSelectionMode ? 'Multi-Seleção' : 'Meus Endereços'}
                        </h1>
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
                        filteredRecords.map((record, idx) => {
                            const isSelected = selectedIds.includes(record.id);

                            return (
                                <div
                                    key={record.id}
                                    onClick={() => isSelectionMode ? toggleSelection(record.id) : setSelectedRecord(record)}
                                    onMouseDown={() => handleTouchStart(record.id)}
                                    onMouseUp={handleTouchEnd}
                                    onMouseLeave={handleTouchEnd}
                                    onTouchStart={() => handleTouchStart(record.id)}
                                    onTouchEnd={handleTouchEnd}
                                    className={`glass-card rounded-[2.5rem] p-5 active:scale-[0.98] transition-all group animate-slide-up relative overflow-hidden ${isSelected ? 'border-primary/50 bg-primary/5' : 'border-white/5'}`}
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    {isSelected && (
                                        <div className="absolute top-4 right-4 z-20 size-6 bg-primary rounded-full flex items-center justify-center border-2 border-[#0F172A] shadow-lg animate-in zoom-in duration-200">
                                            <span className="material-symbols-outlined text-white !text-[16px] font-black">check</span>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-4">
                                        <div className={`size-16 rounded-[1.5rem] bg-white/5 border border-white/5 overflow-hidden p-1 transition-all ${isSelected ? 'scale-90 opacity-50' : ''}`}>
                                            {record.imageThumbnail ? (
                                                <img src={record.imageThumbnail} className="w-full h-full object-cover rounded-[1.2rem]" alt="Local" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                    <span className="material-symbols-outlined !text-[24px]">image</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 pt-1">
                                            <div className="flex justify-between items-start pr-8">
                                                <h3 className={`font-bold text-[17px] tracking-tight truncate transition-all ${isSelected ? 'text-primary' : 'text-white/90'}`}>
                                                    {record.name}
                                                </h3>
                                                {!isSelectionMode && (
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={(e) => handleEdit(record, e)}
                                                            className="text-slate-600 hover:text-primary transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined !text-[20px]">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDelete(record.id, e)}
                                                            className="text-slate-600 hover:text-red-500 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined !text-[20px]">delete</span>
                                                        </button>
                                                    </div>
                                                )}
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
                            );
                        })
                    )}
                </div>
            </main>

            {/* Scroll Indicator Overlay */}
            <div className="fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-bg-start via-bg-start/90 to-transparent pointer-events-none z-10"></div>

            {/* Cinematic Import Overlay */}
            {(isImporting || isOptimizing) && (
                <LoadingOverlay
                    title={isImporting ? "Importador de Protocolos" : "IA Smart Snap"}
                    subtitle={isImporting ? importStatus : optimizationLog}
                    icon={<span className="material-symbols-outlined !text-[32px] animate-spin text-primary shadow-glow">{isImporting ? 'sync' : 'auto_fix_high'}</span>}
                />
            )}
            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                onConfirm={modalConfig.onConfirm}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                confirmText="Sim, excluir"
                cancelText="Cancelar"
            />
        </div>
    );
};
