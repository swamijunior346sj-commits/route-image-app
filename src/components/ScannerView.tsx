import { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import {
    getRecords,
    saveRecord,
    addPointToActiveRoute,
    addToDailyRoute,
    getActiveRoute,
    getSettings,
    checkAndUpdateUsage,
    type RoutePoint,
    type LocationRecord,
    type AppSettings
} from '../services/db';
import { extractFeatures, cosineSimilarity } from '../services/imageProcessing';
import { analyzeAddressImage } from '../services/geminiService';
import { LoadingOverlay } from './LoadingOverlay';
import { NotificationsView } from './NotificationsView';

interface ScannerProps {
    onNavigateToMap: () => void;
    onNavigateToDailyRoute: () => void;
    initialViewMode?: 'dashboard' | 'camera';
    onShowPaywall?: () => void;
}

export const ScannerView = ({ onNavigateToMap, onNavigateToDailyRoute, initialViewMode = 'dashboard', onShowPaywall }: ScannerProps) => {
    // --- Dashboard State ---
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [stats, setStats] = useState({ deliveries: 0, total: 0, earnings: 0 });
    const [nextStop, setNextStop] = useState<RoutePoint | null>(null);

    // --- Functional State ---
    const webcamRef = useRef<Webcam>(null);
    const [loading, setLoading] = useState(false);
    const [isSendingToRoute, setIsSendingToRoute] = useState(false);
    const [viewMode, setViewMode] = useState<'dashboard' | 'camera' | 'confirm' | 'notifications'>(initialViewMode);
    const [cameraMode, setCameraMode] = useState<'register' | 'scan'>('scan');
    const [isCockpitOpen, setIsCockpitOpen] = useState(false);
    const [torch, setTorch] = useState(false);

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

    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
    const [aiStatus, setAiStatus] = useState('');
    const [facingMode] = useState<'environment' | 'user'>('environment');

    const VALOR_POR_PACOTE = 2.25;
    const SIMILARITY_THRESHOLD = 0.80;

    const loadDashboardData = useCallback(async () => {
        try {
            const [appSettings, route] = await Promise.all([
                getSettings(),
                getActiveRoute()
            ]);

            setSettings(appSettings);

            if (route.length > 0) {
                const pending = route.filter(p => p.id !== 'current' && !p.isDelivered);
                const delivered = route.filter(p => p.id !== 'current' && p.isDelivered);

                setStats({
                    deliveries: delivered.length,
                    total: route.filter(p => p.id !== 'current').length,
                    earnings: delivered.length * VALOR_POR_PACOTE
                });

                if (pending.length > 0) {
                    setNextStop(pending[0]);
                } else {
                    setNextStop(null);
                }
            } else {
                setStats({ deliveries: 0, total: 0, earnings: 0 });
                setNextStop(null);
            }
        } catch (err) {
            console.error('Failed to load dashboard:', err);
        }
    }, []);

    // --- Initial Load ---
    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    useEffect(() => {
        if (initialViewMode) {
            setViewMode(initialViewMode);
        }
    }, [initialViewMode]);

    useEffect(() => {
        if (viewMode === 'dashboard') loadDashboardData();
    }, [viewMode, loadDashboardData]);

    useEffect(() => {
        loadDashboardData();
    }, [isSendingToRoute, loadDashboardData]);

    // --- Camera Logic ---
    const captureAndExtract = useCallback(async (): Promise<{ imageSrc: string, features: number[] } | null> => {
        if (!webcamRef.current) return null;
        // @ts-ignore - access to video element
        const video = webcamRef.current.video as HTMLVideoElement | null;
        if (!video || video.readyState !== 4) return null;

        const features = await extractFeatures(video);
        const imageSrc = webcamRef.current.getScreenshot() || '';
        return { imageSrc, features };
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
        setViewMode('camera');
        setIsCockpitOpen(false);
    };

    const handleCapture = async () => {
        if (loading) return;
        setLoading(true);
        try {
            // Check usage for free users
            const usage = await checkAndUpdateUsage();
            if (!usage.allowed) {
                if (onShowPaywall) onShowPaywall();
                else alert("Limite diário de 5 escaneamentos atingido! Faça o upgrade para o plano PRO.");
                setLoading(false);
                return;
            }

            const capture = await captureAndExtract();
            if (!capture) {
                alert("Falha na captura.");
                return;
            }

            if (cameraMode === 'scan') {
                // 1. Tentar reconhecimento offline primeiro (Scan funcional)
                const records = await getRecords();
                let bestMatch: LocationRecord | null = null;
                let highestSim = 0;

                for (const rec of records) {
                    const sim = cosineSimilarity(capture.features, rec.featureVector);
                    if (sim > highestSim) { highestSim = sim; bestMatch = rec; }
                    if (rec.additionalImages) {
                        for (const addView of rec.additionalImages) {
                            const simAdd = cosineSimilarity(capture.features, addView.features);
                            if (simAdd > highestSim) { highestSim = simAdd; bestMatch = rec; }
                        }
                    }
                }

                if (bestMatch && highestSim > SIMILARITY_THRESHOLD) {
                    // Sucesso Scan Offline
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
                        isRecent: true // Marker for the new section
                    });

                    setIsSendingToRoute(true);
                    setTimeout(() => {
                        setIsSendingToRoute(false);
                        onNavigateToDailyRoute(); // Go to daily route to see the item
                    }, 2000);
                } else {
                    alert("Endereço não encontrado na base de dados. Use 'Novo Registro' para cadastrá-lo.");
                    setViewMode('dashboard');
                }
            } else {
                // Modo Registro (Novo Registro) - Go straight to AI
                setCapturedImage(capture.imageSrc);
                setCapturedFeatures(capture.features);
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

                await runAiWithAnimation(capture.imageSrc);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEntry = async () => {
        if (!capturedImage || !capturedFeatures || !addressInput.trim()) return;
        setLoading(true);
        try {
            let lat = parseFloat(latInput);
            let lng = parseFloat(lngInput);

            // Fallback Geocoding if lat/lng missing
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
                { notes: notesInput, neighborhood: neighborhoodInput, city: cityInput }
            );


            await addToDailyRoute({
                id: record.id,
                name: record.name,
                lat: record.lat,
                lng: record.lng,
                scannedAt: Date.now(),
                notes: record.notes,
                neighborhood: record.neighborhood,
                city: record.city
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
                setViewMode('dashboard');
                onNavigateToDailyRoute();
            }, 2000);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageSrc = event.target?.result as string;
            if (!imageSrc) return;
            setLoading(true);
            try {
                const img = new Image();
                img.src = imageSrc;
                await new Promise(r => { img.onload = r; });
                const features = await extractFeatures(img);

                // Setup for confirm mode
                setCapturedImage(imageSrc);
                setCapturedFeatures(features);
                setViewMode('confirm');

                if (navigator.vibrate) navigator.vibrate(50);
                await runAiWithAnimation(imageSrc);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // --- UI Helpers ---

    if (viewMode === 'camera') {
        return (
            <div className="fixed inset-0 z-[11000] bg-black flex flex-col font-sans overflow-hidden">
                {/* Camera Layer */}
                <div className="absolute inset-0 z-0">
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{
                            facingMode,
                            width: { ideal: 4096 },
                            height: { ideal: 2160 },
                            //@ts-ignore
                            advanced: [{ torch }]
                        }}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 camera-grid" />

                    {/* Viewfinder Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-72 h-48 border-2 border-white/20 rounded-3xl scan-focus relative overflow-hidden">
                            <div className="scanning-line" />
                            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
                        </div>
                    </div>
                </div>

                {/* Minimalist Reader View */}
                <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-auto" onClick={handleCapture}>
                    {/* Floating Status HUD removed as requested */}

                    {/* Viewfinder Only */}
                    <div className="w-80 h-56 border border-white/10 rounded-[3rem] scan-focus relative overflow-hidden backdrop-blur-[2px]">
                        <div className="scanning-line" />
                        <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-xl" />
                        <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-xl" />
                        <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-xl" />
                        <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-xl" />
                    </div>

                    {/* Minimal Close Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setViewMode('dashboard'); }}
                        className="absolute top-14 left-6 size-12 rounded-full glass-ui flex items-center justify-center text-white/40 active:scale-90 transition-all"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>

                    {/* Flash Toggle */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setTorch(!torch); }}
                        className={`absolute top-14 right-6 size-12 rounded-full glass-ui flex items-center justify-center active:scale-90 transition-all ${torch ? 'text-yellow-400' : 'text-white/40'}`}
                    >
                        <span className="material-symbols-outlined">{torch ? 'flash_on' : 'flash_off'}</span>
                    </button>

                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary mb-2 animate-pulse">
                            {cameraMode === 'register' ? 'Novo Registro' : 'Escanear Endereço'}
                        </p>
                        <p className="text-[14px] font-bold text-white/40">Toque na tela para capturar</p>
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'confirm') {
        const coordsValue = latInput && lngInput ? `${latInput}, ${lngInput}` : '';

        return (
            <div className="fixed inset-0 z-[11000] bg-bg-start flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-500 overflow-hidden font-sans">
                <header className="sticky top-0 z-50 backdrop-blur-xl bg-bg-start/60 border-b border-white/5 px-6 pt-10 pb-5">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setViewMode('camera')}
                            className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 text-slate-300 active:scale-90 transition-transform"
                        >
                            <span className="material-symbols-outlined !text-[20px]">arrow_back_ios_new</span>
                        </button>
                        <h1 className="text-lg font-bold tracking-tight text-white/90">Novo Endereço</h1>
                        <div className="size-10"></div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32 no-scrollbar">
                    {/* Capture Preview Section */}
                    <div className="space-y-3">
                        <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">
                            Foto da Etiqueta
                        </label>
                        <div className="relative w-full aspect-video rounded-[2rem] border-2 border-dashed border-white/20 overflow-hidden group">
                            {capturedImage ? (
                                <img src={capturedImage} className="w-full h-full object-cover" alt="Capture" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-white/5">
                                    <div className="size-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-xl shadow-primary/20">
                                        <span className="material-symbols-outlined text-white text-3xl">add_a_photo</span>
                                    </div>
                                    <p className="text-[15px] font-bold text-white tracking-wide">Sem Foto</p>
                                </div>
                            )}

                            {isAiAnalyzing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-start/80 backdrop-blur-md animate-in fade-in scale-in duration-500">
                                    <span className="material-symbols-outlined !text-[32px] text-primary animate-pulse mb-4">auto_awesome</span>
                                    <p className="text-xs font-bold text-white uppercase tracking-widest">{aiStatus}</p>
                                    <div className="mt-4 flex gap-1">
                                        <div className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="size-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="size-1.5 bg-primary rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">
                            Nome do Local
                        </label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">home_work</span>
                            <input
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 outline-none transition-all duration-300 placeholder:text-slate-500 placeholder:font-light focus:border-primary/50 focus:ring-1 focus:ring-primary/30 focus:bg-white/10 text-white pr-12"
                                placeholder="Ex: Centro de Logística Norte"
                                type="text"
                                value={locationNameInput}
                                onChange={e => setLocationNameInput(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">
                            Endereço Completo
                        </label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">location_on</span>
                            <input
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 outline-none transition-all duration-300 placeholder:text-slate-500 placeholder:font-light focus:border-primary/50 focus:ring-1 focus:ring-primary/30 focus:bg-white/10 text-white pr-12"
                                placeholder="Av. Paulista, 1000 - Bela Vista"
                                type="text"
                                value={addressInput}
                                onChange={e => setAddressInput(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">
                            Coordenadas (Lat/Long)
                        </label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">distance</span>
                            <input
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 outline-none transition-all duration-300 placeholder:text-slate-500 placeholder:font-light focus:border-primary/50 focus:ring-1 focus:ring-primary/30 focus:bg-white/10 text-white pr-12"
                                placeholder="-23.5505, -46.6333"
                                type="text"
                                value={coordsValue}
                                onChange={e => {
                                    const val = e.target.value;
                                    const parts = val.split(',').map(p => p.trim());
                                    if (parts[0]) setLatInput(parts[0]);
                                    if (parts[1]) setLngInput(parts[1]);
                                }}
                            />
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <label className="block text-[13px] font-semibold tracking-wider uppercase text-slate-400 ml-1">
                            Observações Detalhadas
                        </label>
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 outline-none transition-all duration-300 placeholder:text-slate-500 placeholder:font-light focus:border-primary/50 focus:ring-1 focus:ring-primary/30 focus:bg-white/10 text-white min-h-[120px] resize-none"
                            placeholder="Informe pontos de referência, portões ou horários específicos de recebimento..."
                            value={notesInput}
                            onChange={e => setNotesInput(e.target.value)}
                        ></textarea>
                    </div>
                </main>

                <footer className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-bg-start via-bg-start/90 to-transparent p-6 pb-10 z-[210]">
                    <button
                        onClick={handleSaveEntry}
                        disabled={loading || !addressInput.trim()}
                        className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black italic uppercase tracking-[0.3em] rounded-2xl shadow-premium active:scale-[0.97] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loading ? <span className="material-symbols-outlined animate-spin !text-[20px]">sync</span> : (
                            <>
                                <span className="material-symbols-outlined !font-semibold">verified</span>
                                <span>Salvar Endereço</span>
                            </>
                        )}
                    </button>
                </footer>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-bg-start overflow-hidden flex flex-col font-sans">
            <header className="sticky top-0 z-50 backdrop-blur-2xl bg-bg-start/80 border-b border-white/5 px-6 pt-12 pb-6 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-0.5">Visão Geral</span>
                    <h1 className="text-2xl font-black tracking-tight text-white/90">Dashboard</h1>
                </div>
                <button
                    onClick={() => setViewMode('notifications')}
                    className="relative flex items-center justify-center size-12 rounded-2xl bg-white/5 border border-white/10 text-slate-400 active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined !text-[24px]">notifications</span>
                    <span className="absolute top-3.5 right-3.5 size-2 bg-primary rounded-full border-2 border-bg-start shadow-[0_0_8px_rgba(59,130,246,1)]"></span>
                </button>
            </header>

            <main className="px-6 py-8 space-y-8 pb-40 overflow-y-auto no-scrollbar flex-1 animate-slide-up">
                {/* Profile Card */}
                <section className="glass-card rounded-[2.5rem] p-6 relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 size-40 bg-primary/10 blur-[60px] group-hover:bg-primary/20 transition-all duration-700"></div>

                    <div className="flex items-center gap-4 mb-6 relative z-10">
                        <div className="size-16 rounded-[1.25rem] bg-gradient-to-br from-primary to-accent p-[1px] shadow-lg">
                            <div className="w-full h-full rounded-[1.25rem] bg-[#0F172A] flex items-center justify-center overflow-hidden">
                                {settings?.personalData.avatar ? (
                                    <img src={settings.personalData.avatar} className="w-full h-full object-cover" alt="Profile" />
                                ) : (
                                    <div className="text-white font-black text-xl italic">{settings?.personalData.name ? settings.personalData.name[0].toUpperCase() : 'C'}</div>
                                )}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">{settings?.personalData.name || 'Motorista'}</h2>
                            <div className="flex items-center gap-2">
                                <span className="size-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Protocolo Ativo</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 relative z-10">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 opacity-60">Entregas</p>
                            <p className="text-2xl font-black text-white/90">{stats.deliveries}<span className="text-slate-500 text-lg">/{stats.total}</span></p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 opacity-60">Ganhos</p>
                            <p className="text-2xl font-black text-white/90">R$ {stats.earnings.toFixed(2).replace('.', ',')}</p>
                        </div>
                    </div>
                </section>

                {/* Next Stop Section */}
                <section className="space-y-4">
                    <h3 className="text-[12px] font-bold tracking-widest uppercase text-slate-400 ml-1 opacity-50">Próxima Parada</h3>
                    {nextStop ? (
                        <div className="glass-card rounded-[2.5rem] p-5 border-l-4 border-l-primary group active:scale-[0.98] transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1.5 px-1">
                                    <span className="text-[9px] font-black py-1 px-2.5 bg-primary/20 text-primary rounded-lg uppercase tracking-wider">Destino Atual</span>
                                    <h4 className="text-lg font-bold text-white leading-tight pr-4">{nextStop.name}</h4>
                                </div>
                                <button className="size-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                                    <span className="material-symbols-outlined">more_vert</span>
                                </button>
                            </div>
                            <div className="flex items-center gap-3 text-slate-400 mb-6 px-1">
                                <span className="material-symbols-outlined !text-[18px] text-primary/60">location_on</span>
                                <span className="text-sm font-medium opacity-80 truncate">{nextStop.neighborhood || 'Endereço sem bairro'}</span>
                            </div>
                            <button
                                onClick={onNavigateToMap}
                                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 group/btn"
                            >
                                <span className="material-symbols-outlined !text-[20px] group-hover/btn:animate-pulse">navigation</span>
                                <span className="tracking-widest">INICIAR NAVEGAÇÃO</span>
                            </button>
                        </div>
                    ) : (
                        <div className="glass-card p-10 rounded-[2.5rem] flex flex-col items-center justify-center text-center opacity-40">
                            <div className="size-14 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/5">
                                <span className="material-symbols-outlined text-slate-500">check_circle</span>
                            </div>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Sem entregas pendentes</p>
                        </div>
                    )}
                </section>

                {/* Add Entry Section */}
                <section className="space-y-5">
                    <div className="flex justify-between items-center ml-1">
                        <h3 className="text-[12px] font-bold tracking-widest uppercase text-slate-400 opacity-50">Adicionar Endereço</h3>
                        <div className="h-[1px] flex-1 mx-4 bg-white/5"></div>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={onNavigateToDailyRoute}
                            className="w-full relative group transition-all"
                        >
                            <div className="absolute inset-y-0 left-5 flex items-center text-slate-500 group-hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">search</span>
                            </div>
                            <div className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-5 text-left text-sm text-slate-500 font-medium">
                                Pesquisar ou Listagem Diária
                            </div>
                        </button>

                        <button
                            onClick={() => setIsCockpitOpen(true)}
                            className="glass-card rounded-[2.5rem] p-10 border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-5 cursor-pointer hover:border-primary/50 hover:bg-white/10 active:scale-[0.97] transition-all group"
                        >
                            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 shadow-lg transition-transform border border-primary/20">
                                <span className="material-symbols-outlined !text-[36px]">rocket_launch</span>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-base font-bold text-white tracking-tight">Abrir Cockpit de Operações</p>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest opacity-60">Escolha o modo de captura</p>
                            </div>
                        </button>
                    </div>
                </section>
            </main>

            {/* Cockpit Menu Overlay */}
            {isCockpitOpen && (
                <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-2xl animate-in fade-in duration-300 flex items-end">
                    <div
                        className="absolute inset-0"
                        onClick={() => setIsCockpitOpen(false)}
                    />
                    <div className="relative w-full bg-[#0F172A]/95 border-t border-white/10 rounded-t-[3rem] p-8 pb-14 animate-in slide-in-from-bottom duration-500 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />

                        <div className="space-y-6">
                            <div className="flex flex-col mb-4">
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-1">Operações RouteVision</span>
                                <h3 className="text-xl font-black text-white italic tracking-tight">Cockpit de Captura</h3>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <button
                                    onClick={() => handleStartCamera('register')}
                                    className="w-full h-24 glass-card rounded-3xl flex items-center gap-6 p-6 border-white/5 active:scale-95 transition-all group"
                                >
                                    <div className="size-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-lg shadow-amber-500/5 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined !text-[28px]">add_a_photo</span>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-lg font-bold text-white tracking-tight">Novo Registro</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Cadastro IA via Gemini™</p>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-700">arrow_forward</span>
                                </button>

                                <button
                                    onClick={() => handleStartCamera('scan')}
                                    className="w-full h-24 glass-card rounded-3xl flex items-center gap-6 p-6 border-white/5 active:scale-95 transition-all group"
                                >
                                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-lg shadow-primary/5 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined !text-[28px]">barcode_scanner</span>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-lg font-bold text-white tracking-tight">Escanear Entregas</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Busca na Base de Dados</p>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-700">arrow_forward</span>
                                </button>
                            </div>

                            <button
                                onClick={() => setIsCockpitOpen(false)}
                                className="w-full py-4 text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] mt-4"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Nav Fade Overlay */}
            <nav className="fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-bg-start via-bg-start/80 to-transparent pointer-events-none z-10"></nav>

            {/* Registering/AI Analysis Overlay */}
            {isAiAnalyzing && (
                <LoadingOverlay
                    title="Protocolo RouteVision™"
                    subtitle={aiStatus}
                />
            )}

            {/* Sync Overlay */}
            {isSendingToRoute && (
                <LoadingOverlay
                    title="Processando Rota"
                    subtitle="Identificando via Matriz de IA e Sincronizando..."
                />
            )}

            {/* FAB for Camera */}
            {viewMode === 'dashboard' && (
                <div className="fixed bottom-32 right-6 z-50 animate-in fade-in zoom-in duration-500">
                    <button
                        onClick={() => setIsCockpitOpen(true)}
                        className="size-16 rounded-full bg-primary text-white shadow-fab flex items-center justify-center active:scale-90 transition-all border border-white/20 group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary via-accent to-white opacity-20 group-hover:opacity-40 transition-opacity"></div>
                        <span className="material-symbols-outlined !text-[32px] group-hover:scale-110 transition-all duration-300">rocket_launch</span>
                    </button>
                </div>
            )}

            {/* Notifications View Overlay */}
            {viewMode === 'notifications' && (
                <NotificationsView onBack={() => setViewMode('dashboard')} />
            )}
        </div>
    );
};
