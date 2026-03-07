import { useRef, useState, useCallback, useEffect } from 'react';
import {
    getRecords,
    saveRecord,
    addPointToActiveRoute,
    addToDailyRoute,
    checkAndUpdateUsage,
    type LocationRecord
} from '../services/db';
import { extractFeatures, cosineSimilarity } from '../services/imageProcessing';
import { analyzeAddressImage } from '../services/geminiService';
import { LoadingOverlay } from './LoadingOverlay';

interface ScannerProps {
    onNavigateToDailyRoute: () => void;
    initialViewMode?: 'camera' | 'confirm';
    onShowPaywall?: () => void;
    onRegisterImport?: (trigger: () => void) => void;
}

export const ScannerView = ({ onNavigateToDailyRoute, initialViewMode = 'camera', onShowPaywall, onRegisterImport }: ScannerProps) => {
    // --- State ---
    const [loading, setLoading] = useState(false);
    const [isSendingToRoute, setIsSendingToRoute] = useState(false);
    const [viewMode, setViewMode] = useState<'camera' | 'confirm'>(initialViewMode === 'confirm' ? 'confirm' : 'camera');
    const [cameraMode, setCameraMode] = useState<'register' | 'scan'>('scan');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    // Registering/Confirmation State
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [capturedFeatures, setCapturedFeatures] = useState<number[] | null>(null);
    const [addressInput, setAddressInput] = useState('');
    const [locationNameInput, setLocationNameInput] = useState('');
    const [neighborhoodInput, setNeighborhoodInput] = useState('');
    const [cityInput, setCityInput] = useState('');
    const [notesInput, setNotesInput] = useState('');
    const [latInput, setLatInput] = useState('');
    const [lngInput, setLngInput] = useState('');
    const [deadlineInput, setDeadlineInput] = useState('');

    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
    const [aiStatus, setAiStatus] = useState('');

    const SIMILARITY_THRESHOLD = 0.80;

    useEffect(() => {
        if (onRegisterImport) {
            onRegisterImport(() => {
                importFileInputRef.current?.click();
            });
        }
    }, [onRegisterImport]);

    // --- Camera Logic ---
    const captureAndAnalyze = useCallback(async (image: HTMLImageElement): Promise<{ features: number[] } | null> => {
        try {
            const features = await extractFeatures(image);
            return { features };
        } catch (err) {
            console.error('Feature extraction failed:', err);
            return null;
        }
    }, []);

    const runAiWithAnimation = async (imageSrc: string): Promise<void> => {
        setIsAiAnalyzing(true);
        setAiStatus('Iniciando leitura de IA...');

        const statusMessages = [
            'Detectando elementos da etiqueta...',
            'Lendo endereço com IA...',
            'Preenchendo campos automaticamente...',
        ];
        let msgIdx = 0;
        const msgInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % statusMessages.length;
            setAiStatus(statusMessages[msgIdx]);
        }, 600);

        try {
            const [aiReading] = await Promise.all([
                analyzeAddressImage(imageSrc),
                new Promise(r => setTimeout(r, 2000)),
            ]);

            if (aiReading) {
                if (aiReading.address) setAddressInput(aiReading.address);
                if (aiReading.neighborhood) setNeighborhoodInput(aiReading.neighborhood);
                if (aiReading.city) setCityInput(aiReading.city);
                if (aiReading.notes) setNotesInput(aiReading.notes);
                if (aiReading.recipientName) setLocationNameInput(aiReading.recipientName);
            }
        } catch (err) {
            console.warn('AI analysis failed:', err);
        } finally {
            clearInterval(msgInterval);
            setIsAiAnalyzing(false);
            setAiStatus('');
        }
    };

    const handleStartCamera = (mode: 'register' | 'scan') => {
        if (navigator.vibrate) navigator.vibrate(50);
        setCameraMode(mode);
        fileInputRef.current?.click();
    };

    const handleNativeCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processImageData(file, cameraMode);
    };

    const handleImportImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processImageData(file, 'scan');
    };

    const processImageData = async (file: File, mode: 'register' | 'scan') => {
        setLoading(true);
        try {
            const usage = await checkAndUpdateUsage();
            if (!usage.allowed) {
                if (onShowPaywall) onShowPaywall();
                else alert("Limite diário atingido! Faça o upgrade para o plano PRO.");
                setLoading(false);
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target?.result as string;
                if (!base64) return;

                const img = new Image();
                img.onload = async () => {
                    const result = await captureAndAnalyze(img);
                    if (!result) {
                        alert("Falha ao analisar a imagem.");
                        setLoading(false);
                        return;
                    }

                    if (mode === 'scan') {
                        const records = await getRecords();
                        let bestMatch: LocationRecord | null = null;
                        let highestSim = 0;

                        for (const rec of records) {
                            const sim = cosineSimilarity(result.features, rec.featureVector);
                            if (sim > highestSim) { highestSim = sim; bestMatch = rec; }
                        }

                        if (bestMatch && highestSim > SIMILARITY_THRESHOLD) {
                            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                            await addPointToActiveRoute({
                                id: bestMatch.id!,
                                name: bestMatch.name,
                                lat: bestMatch.lat,
                                lng: bestMatch.lng,
                                scannedAt: Date.now(),
                                notes: bestMatch.notes,
                                neighborhood: bestMatch.neighborhood,
                                city: bestMatch.city,
                                isRecent: true
                            });

                            setIsSendingToRoute(true);
                            setTimeout(() => {
                                setIsSendingToRoute(false);
                                onNavigateToDailyRoute();
                            }, 2000);
                        } else {
                            alert("Endereço não identificado no banco de dados.");
                        }
                        setLoading(false);
                    } else {
                        setCapturedImage(base64);
                        setCapturedFeatures(result.features);
                        setViewMode('confirm');

                        if ('geolocation' in navigator) {
                            navigator.geolocation.getCurrentPosition(
                                (pos) => {
                                    setLatInput(pos.coords.latitude.toString());
                                    setLngInput(pos.coords.longitude.toString());
                                },
                                undefined,
                                { enableHighAccuracy: true, timeout: 10000 }
                            );
                        }

                        await runAiWithAnimation(base64);
                        setLoading(false);
                    }
                };
                img.src = base64;
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('Processing failed:', err);
            setLoading(false);
        }
    };

    const handleSaveEntry = async () => {
        if (!capturedImage || !capturedFeatures || !addressInput.trim()) return;
        setLoading(true);
        try {
            let lat = parseFloat(latInput);
            let lng = parseFloat(lngInput);

            if (isNaN(lat) || isNaN(lng)) {
                try {
                    const query = [addressInput, neighborhoodInput, cityInput].filter(Boolean).join(', ');
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
                    const data = await res.json();
                    if (data && data.length > 0) {
                        lat = parseFloat(data[0].lat);
                        lng = parseFloat(data[0].lon);
                    }
                } catch (e) { console.error(e); }
            }

            const record = await saveRecord(
                locationNameInput.trim() || addressInput.trim(),
                isNaN(lat) ? null : lat,
                isNaN(lng) ? null : lng,
                capturedImage,
                capturedFeatures,
                { notes: notesInput, neighborhood: neighborhoodInput, city: cityInput, deadline: deadlineInput }
            );

            await addToDailyRoute({
                id: record.id,
                name: record.name,
                lat: record.lat,
                lng: record.lng,
                scannedAt: Date.now(),
                notes: record.notes,
                neighborhood: record.neighborhood,
                city: record.city,
                deadline: record.deadline
            });

            setIsSendingToRoute(true);
            setTimeout(() => {
                setIsSendingToRoute(false);
                setCapturedImage(null);
                setAddressInput('');
                setLocationNameInput('');
                setNeighborhoodInput('');
                setCityInput('');
                setNotesInput('');
                setLatInput('');
                setLngInput('');
                setDeadlineInput('');
                setViewMode('camera');
                onNavigateToDailyRoute();
            }, 2000);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'camera') {
            handleStartCamera('register');
        }
    }, [viewMode]);

    if (viewMode === 'confirm') {
        return (
            <div className="fixed inset-0 z-[11000] bg-bg-start flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-500 overflow-hidden font-sans">
                <header className="sticky top-0 z-50 backdrop-blur-xl bg-bg-start/60 border-b border-white/5 px-6 pt-10 pb-5 text-white">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => { setViewMode('camera'); onNavigateToDailyRoute(); }}
                            className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 text-slate-300 active:scale-90 transition-transform"
                        >
                            <span className="material-symbols-outlined !text-[20px]">arrow_back_ios_new</span>
                        </button>
                        <h1 className="text-lg font-bold tracking-tight">Novo Endereço</h1>
                        <div className="size-10"></div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32 no-scrollbar text-white">
                    <div className="space-y-3">
                        <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">
                            Foto da Etiqueta
                        </label>
                        <div className="relative w-full aspect-video rounded-[2rem] border-2 border-dashed border-white/20 overflow-hidden group">
                            {capturedImage && (
                                <img src={capturedImage} className="w-full h-full object-cover" alt="Capture" />
                            )}

                            {isAiAnalyzing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-start/80 backdrop-blur-md animate-in fade-in scale-in duration-500">
                                    <span className="material-symbols-outlined !text-[32px] text-primary animate-pulse mb-4">auto_awesome</span>
                                    <p className="text-xs font-bold text-white uppercase tracking-widest">{aiStatus}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2.5">
                            <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">Destinatário</label>
                            <input className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 outline-none text-white focus:border-primary/50" type="text" value={locationNameInput} onChange={e => setLocationNameInput(e.target.value)} placeholder="Ex: João da Silva" />
                        </div>

                        <div className="space-y-2.5">
                            <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">Endereço Completo</label>
                            <input className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 outline-none text-white focus:border-primary/50" type="text" value={addressInput} onChange={e => setAddressInput(e.target.value)} placeholder="Rua exemplo, 123" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2.5">
                                <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">Bairro</label>
                                <input className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 outline-none text-white focus:border-primary/50" type="text" value={neighborhoodInput} onChange={e => setNeighborhoodInput(e.target.value)} />
                            </div>
                            <div className="space-y-2.5">
                                <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">Horário Limite</label>
                                <input className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 outline-none text-white focus:border-primary/50" type="time" value={deadlineInput} onChange={e => setDeadlineInput(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">Observações</label>
                            <textarea className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 outline-none text-white focus:border-primary/50 min-h-[100px] resize-none" value={notesInput} onChange={e => setNotesInput(e.target.value)} placeholder="Ex: Casa verde, deixar na portaria..."></textarea>
                        </div>
                    </div>
                </main>

                <footer className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-bg-start via-bg-start p-6 pb-10 z-[210]">
                    <button
                        onClick={handleSaveEntry}
                        disabled={loading || !addressInput.trim()}
                        className="w-full h-16 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-premium active:scale-[0.97] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loading ? <span className="material-symbols-outlined animate-spin">refresh</span> : "Salvar e Adicionar Rota"}
                    </button>
                </footer>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-8 text-center">
            <div className="size-20 border-2 border-primary border-t-transparent rounded-full animate-spin mb-8"></div>
            <h2 className="text-xl font-bold text-white mb-2">Preparando Scanner...</h2>
            <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest">Aguardando câmera do sistema</p>

            <button
                onClick={() => handleStartCamera('register')}
                className="mt-12 px-8 py-4 bg-white/10 border border-white/10 rounded-2xl text-white font-bold uppercase tracking-widest text-xs"
            >
                Abrir Câmera Manualmente
            </button>

            {isAiAnalyzing && <LoadingOverlay title="Protocolo RouteVision™" subtitle={aiStatus} />}
            {isSendingToRoute && <LoadingOverlay title="Processando Rota" subtitle="Sincronizando com o motor de IA..." />}

            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleNativeCapture} className="hidden" />
            <input type="file" accept="image/*" ref={importFileInputRef} onChange={handleImportImage} className="hidden" />
        </div>
    );
};
