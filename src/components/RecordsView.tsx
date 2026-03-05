import { useState, useEffect, useRef } from 'react';
import { getRecords, deleteRecord, updateRecord, getActiveRoute, updateActiveRoute, saveRecord } from '../services/db';
import type { LocationRecord } from '../services/db';
import { Download, Upload, Trash2, Database, Image as ImageIcon, Edit2, LocateFixed, X, Camera, Trash, Search, CheckSquare, Square, CheckCircle2, MapPinned, Plus, FileText, FileSpreadsheet, FileJson, ChevronDown, ChevronUp } from 'lucide-react';
import { exportAsCSV, exportAsJSON, exportAsXLS, exportAsPDF, importRecords as processImport } from '../services/importExport';
import { extractFeatures } from '../services/imageProcessing';
import { analyzeAddressImage } from '../services/geminiService';
import { LoadingOverlay } from './LoadingOverlay';

interface RecordsViewProps {
    onNavigateToMap?: () => void;
}

export const RecordsView = ({ onNavigateToMap }: RecordsViewProps) => {
    const [records, setRecords] = useState<LocationRecord[]>([]);

    const [editingRecord, setEditingRecord] = useState<LocationRecord | null>(null);
    const [editName, setEditName] = useState('');
    const [editLat, setEditLat] = useState('');
    const [editLng, setEditLng] = useState('');
    const [editMainImage, setEditMainImage] = useState<string | null>(null);
    const [editMainFeatures, setEditMainFeatures] = useState<number[] | null>(null);
    const [editAdditionalImages, setEditAdditionalImages] = useState<{ id: string, image: string, features: number[] }[]>([]);
    const [editNotes, setEditNotes] = useState('');
    const [editNeighborhood, setEditNeighborhood] = useState('');
    const [editCity, setEditCity] = useState('');
    const [photoActionTarget, setPhotoActionTarget] = useState<'main' | 'extra' | null>(null);

    // Multi-selection and Search
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [sheetExpandedDetail, setSheetExpandedDetail] = useState(false);
    const [sheetExpandedEdit, setSheetExpandedEdit] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // AI/Vision Loading states
    const [isExtracting, setIsExtracting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const displayRecords = searchQuery.length >= 3
        ? records.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : records;

    const loadRecords = async () => {
        const data = await getRecords();
        setRecords(data);
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir este registro?')) {
            await deleteRecord(id);
            loadRecords();
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`Tem certeza que deseja excluir ${selectedIds.size} registros selecionados?`)) {
            for (const id of Array.from(selectedIds)) {
                await deleteRecord(id);
            }
            setSelectedIds(new Set());
            loadRecords();
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === displayRecords.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(displayRecords.map(r => r.id)));
        }
    };

    const handlePressStart = (id: string) => {
        if (selectedIds.size > 0) return; // Se já está em modo de seleção, o clique normal resolve
        timerRef.current = setTimeout(() => {
            toggleSelection(id);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500); // 500ms long press
    };

    const handlePressEnd = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };


    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsImporting(true);
            await processImport(file);
            alert('Registros importados com sucesso!');
            await loadRecords();
        } catch (err: any) {
            alert(`Erro ao importar: ${err?.message || err}`);
        } finally {
            setIsImporting(false);
        }
        e.target.value = '';
    };

    const [selectedDetail, setSelectedDetail] = useState<LocationRecord | null>(null);



    const openDetail = (record: LocationRecord) => {
        setSelectedDetail(record);
        // setIsDetailModalOpen(true); // No longer needed
        setSheetExpandedDetail(false); // Reset to collapsed state
    };

    const openEdit = (record: LocationRecord, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        // setIsEditModalOpen(true); // No longer needed
        setEditingRecord(record);
        setEditName(record.name);
        setEditLat(record.lat ? String(record.lat) : '');
        setEditLng(record.lng ? String(record.lng) : '');
        setEditMainImage(record.imageThumbnail);
        setEditMainFeatures(record.featureVector);
        setEditAdditionalImages(record.additionalImages || []);
        setEditNotes(record.notes || '');
        setEditNeighborhood(record.neighborhood || '');
        setEditCity(record.city || '');
        setSheetExpandedEdit(false); // Reset to collapsed state
    };

    const openCreate = () => {
        // setIsEditModalOpen(true); // No longer needed
        setEditingRecord({
            id: 'new',
            name: '',
            lat: null,
            lng: null,
            imageThumbnail: '',
            featureVector: [],
            additionalImages: [],
            notes: '',
            neighborhood: '',
            city: '',
            createdAt: Date.now(),
        });
        setEditName('');
        setEditLat('');
        setEditLng('');
        setEditMainImage(null);
        setEditMainFeatures(null);
        setEditAdditionalImages([]);
        setEditNotes('');
        setEditNeighborhood('');
        setEditCity('');
        setSheetExpandedEdit(false); // Reset to collapsed state
    };

    const handleSaveEdit = async () => {
        const lat = parseFloat(editLat);
        const lng = parseFloat(editLng);

        if (editingRecord && editingRecord.id !== 'new') { // Existing record
            await updateRecord(editingRecord.id, {
                name: editName,
                lat: isNaN(lat) ? null : lat,
                lng: isNaN(lng) ? null : lng,
                additionalImages: editAdditionalImages,
                imageThumbnail: editMainImage || editingRecord.imageThumbnail,
                featureVector: editMainFeatures || editingRecord.featureVector,
                notes: editNotes.trim(),
                neighborhood: editNeighborhood.trim(),
                city: editCity.trim()
            });
        } else { // New record
            if (!editName.trim()) {
                alert('Por favor, informe um nome para o registro.');
                return;
            }
            const newRec = await saveRecord(
                editName,
                isNaN(lat) ? null : lat,
                isNaN(lng) ? null : lng,
                editMainImage || '',
                editMainFeatures || [],
                {
                    notes: editNotes.trim(),
                    neighborhood: editNeighborhood.trim(),
                    city: editCity.trim()
                }
            );
            if (editAdditionalImages.length > 0) {
                await updateRecord(newRec.id, { additionalImages: editAdditionalImages });
            }
        }

        // setIsEditModalOpen(false); // No longer needed
        setEditingRecord(null);
        setEditNotes('');
        setEditNeighborhood('');
        setEditCity('');
        loadRecords();
    };

    const handleUseCurrentLocationForEdit = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setEditLat(String(pos.coords.latitude));
                    setEditLng(String(pos.coords.longitude));
                },
                (err) => {
                    console.error(err);
                    alert('Não foi possível obter sua localização. Verifique as permissões de GPS.');
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else {
            alert('Geolocalização não suportada no seu navegador.');
        }
    };

    const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhotoActionTarget(null);
        const file = e.target.files?.[0];
        if (!file) return;
        setIsExtracting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageSrc = event.target?.result as string;
            if (!imageSrc) { setIsExtracting(false); return; }
            try {
                const img = new Image();
                img.src = imageSrc;
                await new Promise(r => { img.onload = r; });
                const features = await extractFeatures(img);

                setEditAdditionalImages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    image: imageSrc,
                    features
                }]);
            } catch (err) {
                console.error(err);
                alert('Erro ao processar imagem para reconhecimento');
            } finally {
                setIsExtracting(false);
            }
        };
        reader.readAsDataURL(file);
        // Reset input
        e.target.value = '';
    };

    const handleReplaceMainImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhotoActionTarget(null);
        const file = e.target.files?.[0];
        if (!file) return;
        setIsExtracting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageSrc = event.target?.result as string;
            if (!imageSrc) { setIsExtracting(false); return; }
            try {
                const img = new Image();
                img.src = imageSrc;
                await new Promise(r => { img.onload = r; });
                const features = await extractFeatures(img);
                setEditMainImage(imageSrc);
                setEditMainFeatures(features);

                try {
                    const aiReading = await analyzeAddressImage(imageSrc);
                    if (aiReading) {
                        if (aiReading.address) setEditName(aiReading.address);
                        if (aiReading.neighborhood) setEditNeighborhood(aiReading.neighborhood);
                        if (aiReading.city) setEditCity(aiReading.city);
                        if (aiReading.notes) setEditNotes(aiReading.notes);
                    }
                } catch (aiErr) {
                    console.warn('AI auto-analysis failed:', aiErr);
                }
            } catch (err) {
                console.error(err);
                alert('Erro ao processar a nova foto principal.');
            } finally {
                setIsExtracting(false);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };



    const handleRemoveAdditionalImage = (idx: string) => {
        setEditAdditionalImages(prev => prev.filter(img => img.id !== idx));
    };

    const handleSendToMap = async () => {
        if (selectedIds.size === 0) return;

        const selectedRecords = records.filter(r => selectedIds.has(r.id));

        if (selectedRecords.length === 0) {
            alert("Nenhum local selecionado válido.");
            return;
        }

        const currentRoute = await getActiveRoute();
        const newPoints = selectedRecords.map(r => ({
            id: r.id,
            name: r.name,
            lat: r.lat,
            lng: r.lng,
            scannedAt: Date.now(),
            notes: r.notes,
            neighborhood: r.neighborhood,
            city: r.city
        }));

        const finalRoute = [...currentRoute.filter(p => p.id !== 'current'), ...newPoints];

        try {
            await updateActiveRoute(finalRoute);
            setSelectedIds(new Set());
            if (onNavigateToMap) onNavigateToMap();
        } catch (err) {
            console.error("Erro ao enviar rota:", err);
            alert("Houve um problema ao sincronizar o servidor. Verifique sua conexão.");
        }
    };

    return (
        <div className="relative w-full h-full bg-black overflow-y-auto pt-safe pb-32">
            {/* Header HUD - Gaming style */}
            <div className="sticky top-0 z-30 w-full p-6 animate-fade-in flex flex-col gap-4 pointer-events-none">
                <div className="bg-zinc-950/40 backdrop-blur-2xl border-b border-white/5 p-6 -m-6 mb-2 pointer-events-auto">
                    {selectedIds.size > 0 ? (
                        <div className="flex justify-between items-center w-full animate-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setSelectedIds(new Set())} className="text-zinc-500 hover:text-white p-2 bg-white/5 rounded-full transition-all">
                                    <X size={20} />
                                </button>
                                <div className="space-y-0.5">
                                    <h2 className="text-xl font-black italic tracking-tighter text-white uppercase leading-none">Seleção Ativa</h2>
                                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">{selectedIds.size} ALVOS MARCADOS</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={handleSendToMap} className="w-12 h-12 flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition-all shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                    <MapPinned size={22} />
                                </button>
                                <button onClick={toggleSelectAll} className="w-12 h-12 flex items-center justify-center bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-2xl hover:bg-blue-500/20 transition-all">
                                    {selectedIds.size === displayRecords.length ? <CheckSquare size={22} /> : <Square size={22} />}
                                </button>
                                <button onClick={handleBulkDelete} className="w-12 h-12 flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-500/20 transition-all">
                                    <Trash2 size={22} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-fade-in">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">Meus Endereços</h1>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,1)]" />
                                        <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em]">{records.length} Entradas</p>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={(e) => e.preventDefault()} className="relative flex items-center">
                                <div className="absolute inset-0 bg-blue-500/5 blur-xl rounded-2xl" />
                                <input
                                    type="text"
                                    placeholder="FILTRAR REGISTROS..."
                                    className="w-full bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl py-4 pl-5 pr-12 text-xs text-white focus:border-blue-500/50 focus:outline-none placeholder:text-zinc-600 font-bold tracking-widest uppercase transition-all shadow-2xl"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <div className="absolute right-4 text-zinc-600">
                                    <Search size={18} />
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>

            {/* Utility Bar */}
            {!selectedIds.size && (
                <div className="px-6 my-6 space-y-3">
                    {/* EXPORT MENU */}
                    <div className="relative">
                        <button
                            onClick={() => setShowExportMenu(prev => !prev)}
                            className="w-full bg-zinc-950/40 backdrop-blur-xl border border-white/5 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/[0.03] transition-all group"
                        >
                            <Download size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black italic uppercase tracking-widest text-zinc-400 group-hover:text-white">Exportar Endereços</span>
                            <ChevronDown size={14} className={`text-zinc-600 transition-transform duration-300 ${showExportMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Options */}
                        {showExportMenu && (
                            <div className="mt-2 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-top-2 duration-200">
                                <button onClick={async () => { await exportAsCSV(); setShowExportMenu(false); }}
                                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04] transition-all text-left border-b border-white/5">
                                    <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                                        <FileSpreadsheet size={16} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-wider">CSV</p>
                                        <p className="text-[9px] text-zinc-500">Compatível com Excel e Google Sheets</p>
                                    </div>
                                </button>
                                <button onClick={async () => { await exportAsXLS(); setShowExportMenu(false); }}
                                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04] transition-all text-left border-b border-white/5">
                                    <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                                        <FileSpreadsheet size={16} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-wider">XLS (Excel)</p>
                                        <p className="text-[9px] text-zinc-500">Planilha Excel formatada</p>
                                    </div>
                                </button>
                                <button onClick={async () => { await exportAsPDF(); setShowExportMenu(false); }}
                                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04] transition-all text-left border-b border-white/5">
                                    <div className="w-9 h-9 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center">
                                        <FileText size={16} className="text-red-400" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-wider">PDF</p>
                                        <p className="text-[9px] text-zinc-500">Relatório visual para impressão</p>
                                    </div>
                                </button>
                                <button onClick={async () => { await exportAsJSON(); setShowExportMenu(false); }}
                                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04] transition-all text-left">
                                    <div className="w-9 h-9 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center">
                                        <FileJson size={16} className="text-violet-400" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-wider">JSON (Backup)</p>
                                        <p className="text-[9px] text-zinc-500">Backup completo para reimportar</p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* IMPORT */}
                    <label className="w-full bg-zinc-950/40 backdrop-blur-xl border border-white/5 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/[0.03] transition-all cursor-pointer group">
                        <Upload size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black italic uppercase tracking-widest text-zinc-400 group-hover:text-white">Importar Endereços</span>
                        <span className="text-[8px] text-zinc-700 font-black uppercase">.json .csv .xls .xlsx</span>
                        <input type="file" accept=".json,.csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
                    </label>
                </div>
            )}

            {/* Grid display */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5 px-6 pb-20 mt-4">
                {displayRecords.map(record => {
                    const isSelected = selectedIds.has(record.id);
                    const isSelectionMode = selectedIds.size > 0;

                    return (
                        <div
                            key={record.id}
                            className={`relative group overflow-hidden rounded-[2rem] bg-zinc-950 border transition-all duration-500 cursor-pointer select-none aspect-square flex flex-col p-5 ${isSelected
                                ? 'border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.3)] scale-[0.97]'
                                : 'border-white/5 hover:border-white/10 shadow-2xl'
                                }`}
                            onTouchStart={() => handlePressStart(record.id)}
                            onTouchEnd={handlePressEnd}
                            onTouchMove={handlePressEnd}
                            onMouseDown={() => handlePressStart(record.id)}
                            onMouseUp={handlePressEnd}
                            onMouseLeave={handlePressEnd}
                            onClick={() => {
                                if (isSelectionMode) toggleSelection(record.id);
                                else openDetail(record);
                            }}
                        >
                            {/* Decorative Elements */}
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-50" />
                            <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-[60px] group-hover:bg-blue-500/20 transition-all duration-700" />

                            {/* Selection HUD UI */}
                            {isSelectionMode && (
                                <div className="absolute top-4 right-4 z-20 animate-in zoom-in-90 duration-300">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${isSelected
                                        ? 'bg-blue-500 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,1)]'
                                        : 'bg-white/5 border-white/10'
                                        }`}>
                                        {isSelected && <CheckCircle2 size={14} className="text-white" />}
                                    </div>
                                </div>
                            )}

                            {/* Hover Actions */}
                            {!isSelectionMode && (
                                <div className="absolute top-4 right-4 z-20 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                                    <button
                                        onClick={(e) => openEdit(record, e)}
                                        className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-500 hover:text-white hover:border-blue-500/50 transition-all"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(record.id, e)}
                                        className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-500 hover:text-red-500 hover:border-red-500/50 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Content Layout */}
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all duration-700">
                                        <MapPinned size={22} className="text-blue-500/60 group-hover:text-blue-500" />
                                    </div>
                                    <h3 className="font-black text-white text-base md:text-lg tracking-tighter line-clamp-2 uppercase italic leading-[0.9] group-hover:text-blue-400 transition-colors">
                                        {record.name}
                                    </h3>
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-2 opacity-60">
                                        {record.neighborhood || 'SETOR DESCONHECIDO'}
                                    </p>
                                </div>

                                <div className="mt-auto space-y-3">
                                    <div className="flex gap-2">
                                        <div className="bg-white/[0.03] px-2.5 py-1 rounded-xl border border-white/5 flex items-center gap-2">
                                            <span className="text-[7px] font-black text-blue-500/50">LAT</span>
                                            <span className="text-[9px] font-bold text-zinc-400 group-hover:text-white transition-colors">
                                                {record.lat ? record.lat.toFixed(3) : '---'}
                                            </span>
                                        </div>
                                        <div className="bg-white/[0.03] px-2.5 py-1 rounded-xl border border-white/5 flex items-center gap-2">
                                            <span className="text-[7px] font-black text-blue-500/50">LNG</span>
                                            <span className="text-[9px] font-bold text-zinc-400 group-hover:text-white transition-colors">
                                                {record.lng ? record.lng.toFixed(3) : '---'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {displayRecords.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-32 text-zinc-600">
                        <Database size={64} className="mb-6 opacity-20" />
                        <h4 className="text-lg font-black italic uppercase tracking-widest opacity-40">Nenhum Registro Localizado</h4>
                    </div>
                )}
            </div>

            {/* Fab Create */}
            <button
                onClick={openCreate}
                className="fixed bottom-[110px] right-8 z-40 w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] shadow-[0_15px_40px_rgba(37,99,235,0.4)] flex items-center justify-center hover:bg-blue-500 hover:scale-110 active:scale-90 transition-all animate-in slide-in-from-bottom-8 duration-500"
            >
                <Plus size={32} />
            </button>

            {/* EDIT PANEL (Standardized Bottom Sheet) */}
            {editingRecord && (
                <div className="absolute inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-md pointer-events-none">
                    <div className={`w-full bg-[#09090b] border-t border-white/10 rounded-t-[3.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 pointer-events-auto flex flex-col ${sheetExpandedEdit ? 'h-[90vh]' : 'h-[600px]'}`}>
                        {/* Drag Handle */}
                        <div onClick={() => setSheetExpandedEdit(!sheetExpandedEdit)} className="py-6 flex flex-col items-center gap-1 cursor-pointer">
                            <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
                            <ChevronUp size={20} className={`text-zinc-600 transition-transform duration-500 ${sheetExpandedEdit ? 'rotate-180' : ''}`} />
                        </div>

                        <div className="px-8 pb-12 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter">Modificar Registro</h3>
                                <button onClick={() => setEditingRecord(null)} className="p-3 bg-white/5 rounded-full text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Identificação Visual</label>
                                    <input
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-5 text-sm text-white font-bold focus:border-blue-500 transition-all outline-none"
                                        placeholder="NOME DO PONTO..."
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Setor/Bairro</label>
                                        <input
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-5 text-sm text-white font-bold focus:border-blue-500 transition-all outline-none"
                                            placeholder="BAIRRO..."
                                            value={editNeighborhood}
                                            onChange={(e) => setEditNeighborhood(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Cidade</label>
                                        <input
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-5 text-sm text-white font-bold focus:border-blue-500 transition-all outline-none"
                                            placeholder="CIDADE..."
                                            value={editCity}
                                            onChange={(e) => setEditCity(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-600/5 border border-blue-500/10 rounded-3xl p-5 relative cursor-pointer active:scale-95 transition-all" onClick={handleUseCurrentLocationForEdit}>
                                        <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest block mb-2">Latitude GPS</label>
                                        <input
                                            className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                            value={editLat}
                                            onChange={(e) => setEditLat(e.target.value)}
                                        />
                                        <LocateFixed size={14} className="absolute top-5 right-5 text-blue-500 opacity-40" />
                                    </div>
                                    <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-3xl p-5 relative cursor-pointer active:scale-95 transition-all" onClick={handleUseCurrentLocationForEdit}>
                                        <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-2">Longitude GPS</label>
                                        <input
                                            className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                            value={editLng}
                                            onChange={(e) => setEditLng(e.target.value)}
                                        />
                                        <LocateFixed size={14} className="absolute top-5 right-5 text-indigo-500 opacity-40" />
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        if (!editLat || !editLng) return alert('Insira as coordenadas primeiro.');
                                        setIsExtracting(true);
                                        try {
                                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${editLat}&lon=${editLng}`);
                                            const data = await res.json();
                                            if (data?.address) {
                                                const addr = data.address;
                                                setEditName(`${addr.road || addr.pedestrian || ''} ${addr.house_number ? ',' + addr.house_number : ''}`.trim());
                                                setEditNeighborhood(addr.suburb || addr.neighbourhood || '');
                                                setEditCity(addr.city || addr.town || '');
                                            }
                                        } finally { setIsExtracting(false); }
                                    }}
                                    disabled={isExtracting}
                                    className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-5 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-emerald-500/20 active:scale-95 transition-all"
                                >
                                    <LocateFixed size={18} className={isExtracting ? 'animate-spin' : ''} />
                                    Geocodificação Direta
                                </button>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Observações Operacionais</label>
                                    <textarea
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-6 text-sm text-zinc-400 h-28 resize-none focus:border-blue-500 outline-none italic"
                                        placeholder="PONTOS DE REFERÊNCIA..."
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Reconhecimento Multi-Ângulo</label>
                                    <div className="flex flex-wrap gap-4 bg-white/5 p-6 rounded-[2.5rem] border border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setPhotoActionTarget('extra')}
                                            className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center text-zinc-600 hover:text-blue-500 hover:border-blue-500/50 transition-all active:scale-90"
                                        >
                                            <Camera size={24} />
                                        </button>
                                        {editAdditionalImages.map((img) => (
                                            <div key={img.id} className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 group shadow-lg">
                                                <img src={img.image} className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 group-hover:brightness-100 transition-all" />
                                                <button
                                                    onClick={() => handleRemoveAdditionalImage(img.id)}
                                                    className="absolute inset-0 bg-red-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-white scale-110"
                                                >
                                                    <Trash size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveEdit}
                                    className="w-full bg-blue-600 text-white font-black uppercase tracking-[0.2em] py-6 rounded-[2.5rem] shadow-xl shadow-blue-600/20 active:scale-95 transition-all text-[11px] mb-4"
                                    disabled={isExtracting}
                                >
                                    {editingRecord && editingRecord.id !== 'new' ? 'ATUALIZAR MATRIZ DE DADOS' : 'INICIAR NOVO REGISTRO'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Action Sub-modal */}
            {photoActionTarget && (
                <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-8 animate-fade-in">
                    <div className="w-full max-w-sm flex flex-col gap-5">
                        <div className="text-center mb-6">
                            <h4 className="text-3xl font-black italic uppercase tracking-tighter text-white">Capturar Mídia</h4>
                            <p className="text-blue-500/60 font-black uppercase tracking-widest text-[10px] mt-2">Selecione a fonte de entrada</p>
                        </div>

                        <label className="w-full bg-blue-600 text-white py-6 rounded-[2rem] flex items-center justify-center gap-4 cursor-pointer font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-blue-500 transition-all active:scale-95">
                            <Camera size={24} />
                            <span>Tirar Nova Foto</span>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={photoActionTarget === 'main' ? handleReplaceMainImage : handleAddImage}
                            />
                        </label>

                        <label className="w-full bg-zinc-900 border border-white/10 text-white py-6 rounded-[2rem] flex items-center justify-center gap-4 cursor-pointer font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all active:scale-95">
                            <ImageIcon size={24} className="text-blue-500" />
                            <span>Abrir Galeria</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={photoActionTarget === 'main' ? handleReplaceMainImage : handleAddImage}
                            />
                        </label>

                        <button
                            type="button"
                            onClick={() => setPhotoActionTarget(null)}
                            className="w-full py-4 text-zinc-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-all mt-6"
                        >
                            Abortar Operação
                        </button>
                    </div>
                </div>
            )}

            {/* DETAIL PANEL (Standardized Bottom Sheet) */}
            {selectedDetail && (
                <div className="absolute inset-0 z-[150] flex flex-col justify-end bg-black/95 backdrop-blur-2xl pointer-events-none">
                    <div className={`w-full bg-[#09090b] border-t border-white/10 rounded-t-[3.5rem] shadow-2xl transition-all duration-700 pointer-events-auto flex flex-col ${sheetExpandedDetail ? 'h-[90vh]' : 'h-[650px]'}`}>
                        {/* Drag Handle */}
                        <div onClick={() => setSheetExpandedDetail(!sheetExpandedDetail)} className="py-6 flex flex-col items-center gap-1 cursor-pointer">
                            <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
                            <ChevronUp size={20} className={`text-zinc-600 transition-transform duration-500 ${sheetExpandedDetail ? 'rotate-180' : ''}`} />
                        </div>

                        <div className="px-8 pb-12 flex-1 overflow-y-auto no-scrollbar">
                            <div className="relative mb-10 group">
                                <div className="absolute inset-x-0 -bottom-10 h-32 bg-gradient-to-t from-[#09090b] to-transparent z-10" />
                                <div className="relative w-full aspect-[4/5] rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl">
                                    {selectedDetail.imageThumbnail ? (
                                        <img src={selectedDetail.imageThumbnail} className="w-full h-full object-cover grayscale brightness-75 transition-all duration-1000 group-hover:grayscale-0 group-hover:brightness-100 scale-110 group-hover:scale-100" />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-950 flex items-center justify-center"><Database size={64} className="text-zinc-900" /></div>
                                    )}
                                    <div className="absolute top-8 right-8 z-20">
                                        <button onClick={() => setSelectedDetail(null)} className="p-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white"><X size={20} /></button>
                                    </div>
                                    <div className="absolute bottom-12 left-8 right-8 z-20">
                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-2">Alvo Identificado</p>
                                        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-[0.9]">{selectedDetail.name}</h2>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-white/[0.03] border border-white/5 p-6 rounded-[2.5rem] space-y-1">
                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Setor</span>
                                    <p className="text-sm font-black text-white italic uppercase truncate">{selectedDetail.neighborhood || '---'}</p>
                                </div>
                                <div className="bg-white/[0.03] border border-white/5 p-6 rounded-[2.5rem] space-y-1">
                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Cidade</span>
                                    <p className="text-sm font-black text-white italic uppercase truncate">{selectedDetail.city || '---'}</p>
                                </div>
                            </div>

                            {selectedDetail.additionalImages && selectedDetail.additionalImages.length > 0 && (
                                <div className="space-y-4 mb-10">
                                    <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Vistas Secundárias</h4>
                                    <div className="flex gap-4 overflow-x-auto pb-4 px-2 no-scrollbar">
                                        {selectedDetail.additionalImages.map((img, i) => (
                                            <div key={i} className="w-24 h-24 rounded-[2rem] border border-white/10 overflow-hidden shrink-0 shadow-lg">
                                                <img src={img.image} className="w-full h-full object-cover grayscale brightness-50 hover:grayscale-0 hover:brightness-100 transition-all" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 mb-10">
                                <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Diretivas Operacionais</h4>
                                <div className="bg-white/[0.03] border border-white/5 p-8 rounded-[2.5rem] text-zinc-400 text-sm italic leading-relaxed">
                                    {selectedDetail.notes || 'Sem observações tácticas registradas para este alvo.'}
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedDetail(null)}
                                className="w-full bg-white text-black py-6 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl active:scale-95 transition-all mb-4"
                            >
                                Recolher Visão
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* IMPORTING ANIMATION */}
            {isImporting && (
                <LoadingOverlay
                    title="Processando Dados"
                    subtitle="Importando registros para o banco geográfico"
                />
            )}
        </div>
    );
};
