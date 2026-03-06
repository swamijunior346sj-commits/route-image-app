import { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, MapPin, ScanLine, X, Loader2, SwitchCamera, LocateFixed, Database, Sparkles, ChevronUp } from 'lucide-react';
import { getRecords, saveRecord, addPointToActiveRoute, addToDailyRoute } from '../services/db';
import type { LocationRecord } from '../services/db';
import { extractFeatures, cosineSimilarity } from '../services/imageProcessing';
import { analyzeAddressImage } from '../services/geminiService';
import { LoadingOverlay } from './LoadingOverlay';

interface ScannerProps {
    onNavigateToMap: () => void;
    onNavigateToRecords: () => void;
    onNavigateToDailyRoute: () => void;
}

export const ScannerView = ({ onNavigateToMap, onNavigateToRecords, onNavigateToDailyRoute }: ScannerProps) => {
    const webcamRef = useRef<Webcam>(null);
    const [loading, setLoading] = useState(false);
    const [isSendingToRoute, setIsSendingToRoute] = useState(false);
    const [mode, setMode] = useState<'scan' | 'register'>('scan');

    // Registering state
    const [registerImage, setRegisterImage] = useState<string | null>(null);
    const [registerFeatures, setRegisterFeatures] = useState<number[] | null>(null);
    const [addressInput, setAddressInput] = useState('');
    const [notesInput, setNotesInput] = useState('');
    const [cityInput, setCityInput] = useState('');
    const [neighborhoodInput, setNeighborhoodInput] = useState('');
    const [latInput, setLatInput] = useState('');
    const [lngInput, setLngInput] = useState('');
    const [accuracy, setAccuracy] = useState<number | null>(null);

    const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
    const [aiStatus, setAiStatus] = useState('Analisando matriz...');
    const [sheetExpanded, setSheetExpanded] = useState(false);

    // Scanned match
    const [match, setMatch] = useState<LocationRecord | null>(null);

    const SIMILARITY_THRESHOLD = 0.80;

    const captureAndExtract = useCallback(async (): Promise<{ imageSrc: string, features: number[] } | null> => {
        if (!webcamRef.current) return null;
        const video = (webcamRef.current as any).video;
        if (!video || video.readyState !== 4) return null;

        // Extract features directly from video frame for speed
        const features = await extractFeatures(video);

        // Get screenshot only for display/storage if needed (like in register mode)
        const imageSrc = webcamRef.current.getScreenshot() || '';

        return { imageSrc, features };
    }, []);

    /**
     * Runs Gemini AI analysis with a guaranteed 2-second animated overlay.
     * Fills address fields and returns when both the API call and the timer complete.
     */
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
            // Run AI and minimum delay in parallel
            const [aiReading] = await Promise.all([
                analyzeAddressImage(imageSrc),
                new Promise(r => setTimeout(r, 2000)), // guaranteed 2s minimum
            ]);

            if (aiReading) {
                if (aiReading.address) setAddressInput(aiReading.address);
                if (aiReading.neighborhood) setNeighborhoodInput(aiReading.neighborhood);
                if (aiReading.city) setCityInput(aiReading.city);
                if (aiReading.notes) setNotesInput(aiReading.notes);
            }
        } catch (err) {
            console.warn('AI analysis failed:', err);
        } finally {
            clearInterval(msgInterval);
            setIsAiAnalyzing(false);
            setAiStatus('');
        }
    };

    // AUTO FOCUS IMPLEMENTATION
    const applyFocus = useCallback(async () => {
        if (!webcamRef.current) return;
        const video = (webcamRef.current as any).video;
        if (!video || !video.srcObject) return;

        const track = video.srcObject.getVideoTracks()[0];
        if (!track) return;

        const capabilities = track.getCapabilities?.();
        if (capabilities && (capabilities as any).focusMode) {
            try {
                await track.applyConstraints({
                    advanced: [{ focusMode: 'continuous' } as any]
                });
            } catch (err) {
                console.warn('Foco automático contínuo não suportado ou negado:', err);
                try {
                    // Try manual focus if continuous fails
                    await track.applyConstraints({
                        advanced: [{ focusMode: 'manual', focusDistance: 0 } as any]
                    });
                } catch (e) {
                    console.warn('Foco manual também não suportado.');
                }
            }
        }
    }, []);

    // Effect to apply focus when webcam is ready
    useEffect(() => {
        const timer = setTimeout(() => {
            applyFocus();
        }, 2000); // Give time for stream to stabilize
        return () => clearTimeout(timer);
    }, [applyFocus, facingMode]);

    const handleManualScan = async () => {
        if (loading || mode !== 'scan' || isSendingToRoute || match) return;
        setLoading(true);

        try {
            const capture = await captureAndExtract();
            if (!capture) {
                alert("Falha ao capturar imagem. Verifique a câmera.");
                return;
            }

            const records = await getRecords();
            if (records.length === 0) {
                alert("O banco de dados local está vazio. Por favor, adicione usando 'Nova Foto'.");
                return;
            }

            let bestMatch: LocationRecord | null = null;
            let highestSimilarity = 0;

            for (const rec of records) {
                const sim = cosineSimilarity(capture.features, rec.featureVector);
                if (sim > highestSimilarity) {
                    highestSimilarity = sim;
                    bestMatch = rec;
                }
                if (rec.additionalImages) {
                    for (const addView of rec.additionalImages) {
                        const simAdd = cosineSimilarity(capture.features, addView.features);
                        if (simAdd > highestSimilarity) {
                            highestSimilarity = simAdd;
                            bestMatch = rec;
                        }
                    }
                }
            }

            if (bestMatch && highestSimilarity > SIMILARITY_THRESHOLD) {
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Distinct "Success" pattern
                setMatch(bestMatch);

                await addPointToActiveRoute({
                    id: bestMatch.id!,
                    name: bestMatch.name,
                    lat: bestMatch.lat || -20.143196,
                    lng: bestMatch.lng || -44.2174965,
                    scannedAt: Date.now(),
                    notes: bestMatch.notes,
                    neighborhood: bestMatch.neighborhood,
                    city: bestMatch.city
                });

                // Auto-navigate animation
                setIsSendingToRoute(true);
                setTimeout(() => {
                    setIsSendingToRoute(false);
                    setMatch(null); // Reset match state
                    onNavigateToMap();
                }, 2000);
            } else {
                alert("Alvo não encontrado no banco de dados local. Use o botão 'NOVA FOTO' para cadastrá-lo.");
            }
        } catch (err: any) {
            console.error('Scan error:', err);
            alert("Erro durante a leitura offline.");
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterStart = async () => {
        try {
            setLoading(true);
            if (navigator.vibrate) navigator.vibrate(50);
            const capture = await captureAndExtract();
            if (!capture) throw new Error("Erro de captura.");

            // Clear inputs for new registration
            setAddressInput('');
            setNeighborhoodInput('');
            setCityInput('');
            setNotesInput('');

            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        setLatInput(pos.coords.latitude.toString());
                        setLngInput(pos.coords.longitude.toString());
                        setAccuracy(pos.coords.accuracy);
                    },
                    undefined,
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            }

            // AI ENHANCEMENT: Complement with Gemini analysis
            setRegisterImage(capture.imageSrc);
            setRegisterFeatures(capture.features);
            setMode('register');

            // Start AI animation AFTER modal opens
            await runAiWithAnimation(capture.imageSrc);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRegistration = async () => {
        if (!registerImage || !registerFeatures || !addressInput.trim()) return;
        try {
            setLoading(true);
            if (navigator.vibrate) navigator.vibrate(50);

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


            await saveRecord(
                addressInput.trim(),
                isNaN(lat) ? null : lat,
                isNaN(lng) ? null : lng,
                registerImage,
                registerFeatures,
                {
                    notes: notesInput.trim(),
                    city: cityInput.trim(),
                    neighborhood: neighborhoodInput.trim(),
                }
            );

            // Also add to daily route
            await addToDailyRoute({
                id: Date.now().toString(),
                name: addressInput.trim(),
                lat: isNaN(lat) ? null : lat,
                lng: isNaN(lng) ? null : lng,
                scannedAt: Date.now(),
                notes: notesInput.trim(),
                neighborhood: neighborhoodInput.trim(),
                city: cityInput.trim(),
            });

            // Animate and switch
            setIsSendingToRoute(true);
            setTimeout(() => {
                setIsSendingToRoute(false);
                setMode('scan');
                setRegisterImage(null);
                setRegisterFeatures(null);
                setAddressInput('');
                onNavigateToDailyRoute();
            }, 2000);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const cancelRegister = () => {
        setMode('scan');
        setRegisterImage(null);
        setRegisterFeatures(null);
        setAddressInput('');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isRegistering: boolean) => {
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

                if (isRegistering) {
                    // SETUP FOR REGISTRATION MODAL
                    setRegisterImage(imageSrc);
                    setRegisterFeatures(features);
                    setAddressInput('');
                    setNeighborhoodInput('');
                    setCityInput('');
                    setNotesInput('');
                    setLatInput('');
                    setLngInput('');

                    // Attempt to get initial GPS for registration
                    if ('geolocation' in navigator) {
                        navigator.geolocation.getCurrentPosition(
                            (pos) => {
                                setLatInput(pos.coords.latitude.toFixed(6));
                                setLngInput(pos.coords.longitude.toFixed(6));
                                setAccuracy(pos.coords.accuracy);
                            },
                            undefined,
                            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                        );
                    }

                    setMode('register');
                    // Show AI animation after modal opens
                    setLoading(false);
                    await runAiWithAnimation(imageSrc);
                    return; // skip finally setLoading(false) since we called it above
                } else {
                    const records = await getRecords();
                    let bestMatch: LocationRecord | null = null;
                    let highestSim = 0;

                    for (const rec of records) {
                        const sim = cosineSimilarity(features, rec.featureVector);
                        if (sim > highestSim) { highestSim = sim; bestMatch = rec; }

                        if (rec.additionalImages) {
                            for (const addView of rec.additionalImages) {
                                const simAdd = cosineSimilarity(features, addView.features);
                                if (simAdd > highestSim) { highestSim = simAdd; bestMatch = rec; }
                            }
                        }
                    }

                    if (bestMatch && highestSim > SIMILARITY_THRESHOLD) {
                        setMatch(bestMatch);
                        setIsSendingToRoute(true);
                        setTimeout(() => {
                            setIsSendingToRoute(false);
                            onNavigateToRecords();
                        }, 2000);
                    } else {
                        // Visual match failed, use AI to read and suggest registration
                        setMatch(null);

                        setRegisterImage(imageSrc);
                        setRegisterFeatures(features);
                        setMode('register');
                        // Show AI animation after modal opens
                        setLoading(false);
                        await runAiWithAnimation(imageSrc);
                        return; // skip finally setLoading(false)
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <div className="relative w-full h-full bg-black overflow-hidden flex flex-col pt-safe">
            {/* HUD Status Bar */}
            <div className="absolute top-0 z-50 w-full p-6 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm border-b border-white/5 animate-fade-in">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-2">
                        {accuracy !== null && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 backdrop-blur-md border border-white/10 rounded-full shadow-2xl">
                                <div className={`w-1.5 h-1.5 rounded-full ${accuracy < 20 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : accuracy < 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                <p className="text-[9px] text-white font-black tracking-tighter uppercase italic">SINAL GPS: {Math.round(accuracy)}m</p>
                            </div>
                        )}
                    </div>
                    {mode === 'scan' && (
                        <button
                            onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                            className="bg-white/[0.03] border border-white/10 p-3 rounded-2xl text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                        >
                            <SwitchCamera size={20} />
                        </button>
                    )}
                </div>
            </div>

            <div className="relative flex-1 overflow-hidden">
                {mode === 'scan' && !match && (
                    <Webcam
                        key={facingMode}
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode }}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}

                {mode === 'register' && registerImage && (
                    <div className="absolute inset-0">
                        <img src={registerImage} className="w-full h-full object-cover blur-2xl scale-110 opacity-30" alt="Preview Background" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
                    </div>
                )}

                {/* Scanning Interface Overlay */}
                {mode === 'scan' && !match && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"></div>

                        {/* High-Tech Scanner Frame */}
                        <div className="relative w-64 h-64">
                            <div className="absolute inset-0 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                                {/* Corners */}
                                <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-blue-500 rounded-tl-[2rem]"></div>
                                <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-blue-500 rounded-tr-[2rem]"></div>
                                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-blue-500 rounded-bl-[2rem]"></div>
                                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-blue-500 rounded-br-[2rem]"></div>

                                {/* Scan Line */}
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_20px_rgba(59,130,246,1)] z-10"></div>

                                {/* Center Processing */}
                                {loading && (
                                    <div className="absolute inset-0 bg-blue-500/5 backdrop-blur-md flex items-center justify-center animate-pulse">
                                        <div className="relative">
                                            <Loader2 className="animate-spin text-blue-500" size={48} />
                                            <div className="absolute inset-0 blur-xl bg-blue-500/20 rounded-full animate-pulse" />
                                        </div>
                                    </div>
                                )}
                            </div>




                            {/* Decorative HUD Elements */}
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Compact Bottom Controls - Now on a row to reduce vertical footprint */}
            <div className="absolute bottom-0 w-full px-6 pb-40 pt-16 bg-gradient-to-t from-black via-black/95 to-transparent z-10 pointer-events-none">
                {mode === 'scan' && (
                    <div className="flex flex-row items-stretch gap-3 max-w-lg mx-auto pointer-events-auto">
                        {/* New Registration Action */}
                        <button
                            onClick={handleRegisterStart}
                            disabled={loading}
                            className="flex-1 group bg-blue-600/10 border border-blue-500/20 py-4 rounded-2xl flex flex-col items-center justify-center transition-all hover:bg-blue-600/20 active:scale-95 disabled:opacity-30 shadow-[0_10px_30px_rgba(59,130,246,0.1)]"
                        >
                            <Camera size={22} className="text-blue-500 group-hover:text-blue-400 transition-colors" />
                            <span className="font-black italic uppercase text-[9px] tracking-widest text-blue-500 group-hover:text-blue-400 mt-2 transition-colors">Nova Foto</span>
                        </button>

                        {/* Scanner Validation Action */}
                        <button
                            onClick={handleManualScan}
                            disabled={loading}
                            className="flex-1 group bg-emerald-500/10 border border-emerald-500/20 py-4 rounded-2xl flex flex-col items-center justify-center transition-all hover:bg-emerald-500/20 active:scale-95 disabled:opacity-30 shadow-[0_10px_30px_rgba(16,185,129,0.1)]"
                        >
                            <ScanLine size={22} className="text-emerald-500 group-hover:text-emerald-400 transition-colors" />
                            <span className="font-black italic uppercase text-[9px] tracking-widest text-emerald-500 group-hover:text-emerald-400 mt-2 transition-colors">Escanear</span>
                        </button>

                        {/* Import Image Action */}
                        <label className="w-16 bg-white/[0.03] border border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer text-zinc-400 hover:text-white hover:border-white/20 transition-all active:scale-95 shadow-lg">
                            <Database size={18} />
                            <span className="text-[7px] font-black uppercase tracking-widest mt-1">Pasta</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false)} />
                        </label>
                    </div>
                )}
            </div>
            {/* REGISTRATION BOTTOM SHEET */}
            {mode === 'register' && (
                <div className="fixed inset-0 z-[10000] flex flex-col justify-end pointer-events-none">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={cancelRegister} />
                    <div className={`relative w-full bg-[#09090b] border-t border-white/10 rounded-t-[3.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] transition-all duration-500 pointer-events-auto flex flex-col ${sheetExpanded ? 'h-[90vh]' : 'h-[85vh]'}`}>
                        {/* Drag Handle */}
                        <div onClick={() => setSheetExpanded(!sheetExpanded)} className="py-6 flex flex-col items-center gap-1 cursor-pointer">
                            <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
                            <ChevronUp size={20} className={`text-zinc-600 transition-transform duration-500 ${sheetExpanded ? 'rotate-180' : ''}`} />
                        </div>

                        <div className="px-8 flex-1 overflow-y-auto w-full no-scrollbar pb-10">
                            <div className="flex justify-between items-center mb-6">
                                <div className="space-y-1">
                                    <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-none">Dados de Registro</h3>
                                    <p className="text-[9px] font-black text-blue-500/60 uppercase tracking-[0.3em]">Ambiente de Indexação Operacional</p>
                                </div>
                                <button onClick={cancelRegister} className="p-3 bg-white/5 rounded-full text-zinc-500 hover:text-white transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6 relative">
                                {/* AI Status Overlay if analyzing */}
                                {isAiAnalyzing && (
                                    <div className="absolute inset-0 z-[60] bg-[#09090b]/90 backdrop-blur-xl flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500 rounded-[2.5rem] border border-violet-500/10">
                                        <div className="relative">
                                            <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-3xl scale-150 animate-pulse" />
                                            <div className="relative w-24 h-24 rounded-[2rem] bg-zinc-900 border border-violet-500/20 flex items-center justify-center shadow-[0_0_50px_rgba(139,92,246,0.3)]">
                                                <Sparkles size={40} className="text-violet-400 animate-spin" style={{ animationDuration: '4s' }} />
                                            </div>
                                        </div>
                                        <div className="text-center space-y-2">
                                            <p className="text-sm font-black text-white uppercase tracking-widest px-4">{aiStatus}</p>
                                            <div className="flex gap-1.5 justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-[bounce_1s_infinite_0s]" />
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-[bounce_1s_infinite_0.2s]" />
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-[bounce_1s_infinite_0.4s]" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {registerImage && (
                                    <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden border border-white/5 group shadow-2xl shrink-0" onClick={() => setIsPreviewExpanded(true)}>
                                        <img src={registerImage} className="w-full h-full object-cover grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-700" alt="Capture" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                                        <div className="absolute bottom-6 left-8 flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                            <span className="text-[9px] font-black text-white uppercase tracking-widest">Visual do Alvo</span>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-4">Endereço Principal</label>
                                        <input
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-5 text-sm text-white focus:border-blue-500 transition-all outline-none font-bold italic"
                                            placeholder="LOGRADOURO, NÚMERO..."
                                            value={addressInput}
                                            onChange={e => setAddressInput(e.target.value)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-4">Setor/Bairro</label>
                                            <input
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-4 text-sm text-white focus:border-blue-500 transition-all outline-none"
                                                placeholder="BAIRRO"
                                                value={neighborhoodInput}
                                                onChange={e => setNeighborhoodInput(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-4">Cidade</label>
                                            <input
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-4 text-sm text-white focus:border-blue-500 transition-all outline-none"
                                                placeholder="CIDADE"
                                                value={cityInput}
                                                onChange={e => setCityInput(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-600/5 border border-blue-600/10 rounded-3xl p-4 flex flex-col gap-1 relative shadow-inner">
                                            <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Latitude</label>
                                            <input
                                                value={latInput}
                                                onChange={(e) => setLatInput(e.target.value)}
                                                className="bg-transparent text-sm font-mono text-white tracking-widest outline-none"
                                                placeholder="0.000000"
                                            />
                                            <LocateFixed size={14} className="absolute top-4 right-4 text-blue-500/20" />
                                        </div>
                                        <div className="bg-indigo-600/5 border border-indigo-600/10 rounded-3xl p-4 flex flex-col gap-1 relative shadow-inner">
                                            <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Longitude</label>
                                            <input
                                                value={lngInput}
                                                onChange={(e) => setLngInput(e.target.value)}
                                                className="bg-transparent text-sm font-mono text-white tracking-widest outline-none"
                                                placeholder="0.000000"
                                            />
                                            <LocateFixed size={14} className="absolute top-4 right-4 text-indigo-500/20" />
                                        </div>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            if (!latInput || !lngInput) return alert('Capture coordenadas primeiro.');
                                            setLoading(true);
                                            try {
                                                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latInput}&lon=${lngInput}`);
                                                const data = await res.json();
                                                if (data?.address) {
                                                    const a = data.address;
                                                    setAddressInput(`${a.road || a.pedestrian || ''}${a.house_number ? ', ' + a.house_number : ''}`);
                                                    setNeighborhoodInput(a.suburb || a.neighbourhood || '');
                                                    setCityInput(a.city || a.town || '');
                                                }
                                            } finally { setLoading(false); }
                                        }}
                                        disabled={loading || !latInput}
                                        className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-emerald-500/20 transition-all shadow-lg active:scale-95 mt-2"
                                    >
                                        <Database size={18} className={loading ? 'animate-spin' : ''} />
                                        SINCRONIZAÇÃO GEOGRÁFICA
                                    </button>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-4 mt-2">Diretivas Adicionais</label>
                                        <textarea
                                            placeholder="PONTOS DE REFERÊNCIA OPERACIONAIS..."
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-5 text-sm text-zinc-400 h-20 outline-none italic focus:border-blue-500 transition-all"
                                            value={notesInput}
                                            onChange={e => setNotesInput(e.target.value)}
                                        />
                                    </div>

                                    <button
                                        onClick={handleSaveRegistration}
                                        disabled={loading}
                                        className="w-full bg-blue-600 py-6 mt-4 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-white shadow-[0_20px_60px_rgba(37,99,235,0.3)] active:scale-95 transition-all text-[11px]"
                                    >
                                        {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'CONFIRMAR INDEXAÇÃO'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cinematic Transition Overlay */}
            {isSendingToRoute && (
                <LoadingOverlay
                    title="Integração de Rota"
                    subtitle="Codificando Vetores Geográficos e Mapeando..."
                    icon={<MapPin size={32} className="text-white animate-bounce" />}
                />
            )}

            {/* Expanded Media Viewer */}
            {isPreviewExpanded && registerImage && (
                <div className="fixed inset-0 z-[2000] bg-black/98 backdrop-blur-2xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
                    <button
                        onClick={() => setIsPreviewExpanded(false)}
                        className="absolute top-10 right-10 p-5 bg-white/5 rounded-[2rem] text-white/40 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md"
                    >
                        <X size={28} />
                    </button>
                    <div className="w-full max-w-5xl aspect-square flex items-center justify-center relative group">
                        <div className="absolute inset-0 blur-3xl bg-blue-500/10 rounded-full animate-pulse opacity-50" />
                        <img src={registerImage} className="w-full h-full object-contain rounded-3xl shadow-2xl relative z-10" alt="Expanded Media" />
                    </div>
                    <p className="text-zinc-600 text-[9px] mt-10 font-black uppercase tracking-[0.4em] italic">Análise de Captura de Alta Precisão</p>
                </div>
            )}
        </div>
    );
};
