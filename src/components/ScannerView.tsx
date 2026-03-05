import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, MapPin, ScanLine, X, Loader2, ImagePlus, SwitchCamera, Save, LocateFixed, Database } from 'lucide-react';
import { getRecords, saveRecord, addPointToActiveRoute } from '../services/db';
import type { LocationRecord } from '../services/db';
import { extractFeatures, cosineSimilarity } from '../services/imageProcessing';

interface ScannerProps {
    onNavigateToMap: () => void;
}

export const ScannerView = ({ onNavigateToMap }: ScannerProps) => {
    const webcamRef = useRef<Webcam>(null);
    const [loading, setLoading] = useState(false);
    const [isSendingToRoute, setIsSendingToRoute] = useState(false);
    const [statusMsg, setStatusMsg] = useState('Aponte a câmera para a etiqueta do pacote');
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

    // Scanned match
    const [match, setMatch] = useState<LocationRecord | null>(null);

    const SIMILARITY_THRESHOLD = 0.80;

    const captureAndExtract = async (): Promise<{ imageSrc: string, features: number[] } | null> => {
        if (!webcamRef.current) return null;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return null;

        const img = new Image();
        img.src = imageSrc;
        await new Promise(r => { img.onload = r; });

        const features = await extractFeatures(img);
        return { imageSrc, features };
    };

    const handleScan = useCallback(async () => {
        try {
            setLoading(true);
            setStatusMsg('Processando etiqueta...');
            setMatch(null);

            if (navigator.vibrate) navigator.vibrate(50);

            const capture = await captureAndExtract();
            if (!capture) throw new Error("Erro ao acessar a câmera.");

            const records = await getRecords();
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
                setMatch(bestMatch);
                setStatusMsg(`Reconhecido: ${(highestSimilarity * 100).toFixed(0)}%`);

                await addPointToActiveRoute({
                    id: bestMatch.id,
                    name: bestMatch.name,
                    lat: bestMatch.lat || -23.55052,
                    lng: bestMatch.lng || -46.633309,
                    scannedAt: Date.now(),
                    notes: bestMatch.notes,
                    neighborhood: bestMatch.neighborhood,
                    city: bestMatch.city
                });

                // Auto-navigate animation
                setIsSendingToRoute(true);
                setTimeout(() => {
                    setIsSendingToRoute(false);
                    onNavigateToMap();
                }, 2000);
            } else {
                setStatusMsg('Nenhum endereço reconhecido.');
            }
        } catch (err: any) {
            console.error(err);
            setStatusMsg('Erro no reconhecimento.');
        } finally {
            setLoading(false);
        }
    }, [webcamRef, onNavigateToMap]);

    const handleRegisterStart = async () => {
        try {
            setLoading(true);
            if (navigator.vibrate) navigator.vibrate(50);
            const capture = await captureAndExtract();
            if (!capture) throw new Error("Erro de captura.");

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

            setRegisterImage(capture.imageSrc);
            setRegisterFeatures(capture.features);
            setMode('register');
            setStatusMsg('Vincule os dados à etiqueta capturada.');
        } catch (err) {
            setStatusMsg('Falha na captura.');
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
                    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`);
                    const data = await res.json();
                    if (data.status === 'OK' && data.results?.[0]) {
                        lat = data.results[0].geometry.location.lat;
                        lng = data.results[0].geometry.location.lng;
                    }
                } catch (e) { console.log(e); }
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

            // Animate and switch
            setIsSendingToRoute(true);
            setTimeout(() => {
                setIsSendingToRoute(false);
                setMode('scan');
                setRegisterImage(null);
                setRegisterFeatures(null);
                setAddressInput('');
                onNavigateToMap();
            }, 2000);
        } catch (err) {
            setStatusMsg('Erro ao salvar.');
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
                    setStatusMsg('Vincule os dados à imagem importada.');
                } else {
                    setStatusMsg('Analisando arquivo...');
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
                        setStatusMsg(`Reconhecido via Arquivo: ${(highestSim * 100).toFixed(0)}%`);

                        await addPointToActiveRoute({
                            id: bestMatch.id,
                            name: bestMatch.name,
                            lat: bestMatch.lat || -23.55052,
                            lng: bestMatch.lng || -46.633309,
                            scannedAt: Date.now(),
                            notes: bestMatch.notes,
                            neighborhood: bestMatch.neighborhood,
                            city: bestMatch.city
                        });

                        setIsSendingToRoute(true);
                        setTimeout(() => {
                            setIsSendingToRoute(false);
                            onNavigateToMap();
                        }, 2000);
                    } else {
                        // SAFETY: Don't show "Sending to Route" if not found
                        setStatusMsg('Nenhuma correspondência no arquivo.');
                        setMatch(null);
                    }
                }
            } catch (err) {
                setStatusMsg('Erro ao processar arquivo.');
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
                    <div className="space-y-1">
                        <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                            Scanner <span className="text-blue-500">Visão</span>
                        </h1>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">{statusMsg}</p>
                            {accuracy !== null && (
                                <div className="flex items-center gap-2 ml-4 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                                    <div className={`w-1 h-1 rounded-full ${accuracy < 20 ? 'bg-emerald-500' : accuracy < 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                    <p className="text-[8px] text-zinc-400 font-bold tracking-tighter uppercase">SIGNAL: {Math.round(accuracy)}m</p>
                                </div>
                            )}
                        </div>
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
                        <div className="relative w-72 h-72">
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

            {/* Bottom Controls */}
            <div className="absolute bottom-0 w-full px-6 pb-32 pt-10 bg-gradient-to-t from-black via-black/80 to-transparent z-10">
                {mode === 'scan' ? (
                    <div className="space-y-4 max-w-lg mx-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleRegisterStart}
                                disabled={loading}
                                className="group relative overflow-hidden bg-white/[0.03] border border-white/10 py-5 rounded-[2rem] flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-30"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                <Camera size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                                <span className="font-black italic uppercase text-[11px] tracking-widest text-zinc-400 group-hover:text-white transition-colors">Vincular</span>
                            </button>

                            <button
                                onClick={handleScan}
                                disabled={loading}
                                className="relative bg-blue-600 hover:bg-blue-500 border border-blue-400/30 py-5 rounded-[2rem] flex items-center justify-center gap-3 shadow-[0_15px_35px_rgba(37,99,235,0.3)] transition-all active:scale-95 disabled:opacity-30"
                            >
                                <ScanLine size={18} className="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                                <span className="font-black italic uppercase text-[11px] tracking-widest text-white">Escanear</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <label className="bg-white/[0.02] border border-white/5 py-4 rounded-3xl flex items-center justify-center gap-2 cursor-pointer text-zinc-600 hover:text-zinc-400 hover:border-white/10 transition-all text-[9px] font-black uppercase tracking-widest">
                                <ImagePlus size={14} /> Importar (Link)
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true)} />
                            </label>
                            <label className="bg-blue-500/5 border border-blue-500/10 py-4 rounded-3xl flex items-center justify-center gap-2 cursor-pointer text-blue-500/40 hover:text-blue-400 hover:border-blue-500/30 transition-all text-[9px] font-black uppercase tracking-widest">
                                <ImagePlus size={14} /> Importar (Scan)
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false)} />
                            </label>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-lg mx-auto bg-zinc-950/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 flex flex-col gap-6 animate-[slideUp_0.5s_ease-out] shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
                        <div className="flex justify-between items-center px-2">
                            <div className="space-y-0.5">
                                <h3 className="text-xl font-black italic uppercase text-white tracking-tighter leading-none">Dados de Registro</h3>
                                <p className="text-[9px] font-black text-blue-500/60 uppercase tracking-widest">Indexação Neural de Logística</p>
                            </div>
                            <button onClick={cancelRegister} className="bg-white/5 p-2.5 rounded-2xl text-zinc-500 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-5 overflow-y-auto max-h-[45vh] pr-2 custom-scrollbar">
                            {registerImage && (
                                <div
                                    className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 mb-2 shrink-0 group cursor-pointer"
                                    onClick={() => setIsPreviewExpanded(true)}
                                >
                                    <img src={registerImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Etiqueta" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                                        <p className="text-[10px] font-black text-white uppercase tracking-widest italic">Ampliar Detalhes da Captura</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5 group">
                                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-4">Endereço / Identificador</label>
                                <input
                                    type="text"
                                    placeholder="RUA, NÚMERO, NOME DO DESTINATÁRIO..."
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-5 text-xs text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:outline-none transition-all font-medium italic"
                                    value={addressInput}
                                    onChange={e => setAddressInput(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 focus-within:translate-y-[-2px] transition-transform">
                                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-4">Bairro</label>
                                    <input
                                        type="text"
                                        placeholder="BAIRRO"
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-5 text-xs text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:outline-none transition-all italic"
                                        value={neighborhoodInput}
                                        onChange={e => setNeighborhoodInput(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5 focus-within:translate-y-[-2px] transition-transform">
                                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-4">Cidade</label>
                                    <input
                                        type="text"
                                        placeholder="CIDADE"
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-5 text-xs text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:outline-none transition-all italic"
                                        value={cityInput}
                                        onChange={e => setCityInput(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Coordinates HUD */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-5 flex flex-col gap-1 relative overflow-hidden group">
                                    <label className="text-[9px] font-black text-blue-500/40 uppercase tracking-widest">Latitude</label>
                                    <input
                                        type="text"
                                        value={latInput}
                                        onChange={(e) => setLatInput(e.target.value)}
                                        className="bg-transparent text-sm font-mono text-white tracking-widest focus:outline-none italic"
                                        placeholder="0.000000"
                                    />
                                    <LocateFixed size={12} className="absolute top-5 right-5 text-blue-500/20 group-hover:text-blue-500 transition-colors" />
                                </div>
                                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-5 flex flex-col gap-1 relative overflow-hidden group">
                                    <label className="text-[9px] font-black text-indigo-500/40 uppercase tracking-widest">Longitude</label>
                                    <input
                                        type="text"
                                        value={lngInput}
                                        onChange={(e) => setLngInput(e.target.value)}
                                        className="bg-transparent text-sm font-mono text-white tracking-widest focus:outline-none italic"
                                        placeholder="0.000000"
                                    />
                                    <LocateFixed size={12} className="absolute top-5 right-5 text-indigo-500/20 group-hover:text-indigo-500 transition-colors" />
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
                                className="w-full bg-emerald-500/5 border border-emerald-500/20 text-emerald-500/60 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-500/10 transition-all disabled:opacity-20"
                            >
                                <Database size={14} className={loading ? 'animate-spin' : ''} />
                                Sincronização Geográfica Reversa
                            </button>

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-4">Diretivas Logísticas</label>
                                <textarea
                                    placeholder="NOTAS DE ACESSO, PONTOS DE REFERÊNCIA..."
                                    rows={2}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-5 text-xs text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:outline-none transition-all italic resize-none"
                                    value={notesInput}
                                    onChange={e => setNotesInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSaveRegistration}
                            disabled={loading || !addressInput.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-[2rem] font-black italic uppercase text-xs tracking-[0.2em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30 mt-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                            Confirmar Registro Base
                        </button>
                    </div>
                )}
            </div>

            {/* Cinematic Transition Overlay */}
            {isSendingToRoute && (
                <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative mb-12">
                        <div className="w-40 h-40 border border-blue-500/10 rounded-full flex items-center justify-center">
                            <div className="w-32 h-32 border-2 border-blue-500/20 rounded-full animate-[spin_8s_linear_infinite]" />
                            <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin" />
                            <MapPin className="text-white drop-shadow-[0_0_15px_rgba(59,130,246,1)] animate-bounce" size={48} />
                        </div>
                    </div>
                    <div className="text-center space-y-3">
                        <h3 className="text-4xl font-black italic text-white uppercase tracking-tighter animate-pulse">Integração de Rota</h3>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em]">Codificando Vetores Geográficos...</p>

                        <div className="mt-12 w-48 h-1 bg-white/5 rounded-full overflow-hidden mx-auto">
                            <div className="h-full bg-blue-500 animate-[loading_3s_ease-in-out_infinite] w-full" />
                        </div>
                    </div>
                </div>
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

