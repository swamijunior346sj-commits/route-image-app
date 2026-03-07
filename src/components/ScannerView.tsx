import { useRef, useState } from 'react';
import { analyzeLabel } from '../services/gemini';
import type { LocationPoint } from '../App';

interface ScannerProps {
    onClose: () => void;
    onConfirm: (point: Omit<LocationPoint, 'id' | 'status' | 'createdAt'>) => void;
}

export const ScannerView = ({ onClose, onConfirm }: ScannerProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [preview, setPreview] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<any>(null);

    // Form states
    const [address, setAddress] = useState('');
    const [name, setName] = useState('');
    const [city, setCity] = useState('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setStatus('Lendo imagem...');

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target?.result as string;
                setPreview(base64);

                setStatus('Analisando etiqueta com IA...');

                // Timeout of 15 seconds for Gemini
                const analyzePromise = analyzeLabel(base64);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));

                try {
                    const result = await Promise.race([analyzePromise, timeoutPromise]) as any;
                    if (result) {
                        setAddress(result.address || '');
                        setName(result.recipientName || '');
                        setCity(result.city || '');
                        setExtractedData(result);
                    }
                } catch (err) {
                    console.warn("IA Timeout or error, proceeding to manual edit");
                }

                setLoading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const handleFinalConfirm = async () => {
        setLoading(true);
        setStatus('Geocodificando endereço...');

        // Simple geocoding using Nominatim (free)
        try {
            const query = `${address} ${city}`;
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
            const data = await res.json();

            let lat = -23.5505;
            let lng = -46.6333;

            if (data && data.length > 0) {
                lat = parseFloat(data[0].lat);
                lng = parseFloat(data[0].lon);
            }

            onConfirm({
                address,
                name: name || 'Entrega',
                lat,
                lng,
                city,
                notes: extractedData?.notes || ''
            });

        } catch (error) {
            console.error(error);
            // Fallback to random nearby for demo if failed
            onConfirm({
                address,
                name: name || 'Entrega',
                lat: -23.5505 + (Math.random() - 0.5) * 0.01,
                lng: -46.6333 + (Math.random() - 0.5) * 0.01,
                city
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
            <div className="w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 animate-slide-up shadow-2xl relative">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Novo Registro</h2>
                    <button onClick={onClose} className="size-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {!preview ? (
                    <div className="space-y-6">
                        <div className="aspect-video bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-center group active:scale-95 transition-all cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}>
                            <div className="size-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/30">
                                <span className="material-symbols-outlined !text-32px">photo_camera</span>
                            </div>
                            <p className="font-bold text-slate-700">Tirar Foto da Etiqueta</p>
                            <p className="text-sm text-slate-400">Câmera abre automaticamente</p>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full h-14 text-slate-400 text-xs font-black uppercase tracking-widest"
                        >
                            Voltar
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-slate-100 border border-slate-100">
                            <img src={preview} className="w-full h-full object-cover" />
                            {loading && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center">
                                    <div className="size-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-3"></div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">{status}</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Endereço Detectado</label>
                                <textarea
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                                    rows={2}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Cidade</label>
                                    <input
                                        value={city}
                                        onChange={e => setCity(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Destinatário</label>
                                    <input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleFinalConfirm}
                            disabled={loading || !address}
                            className="btn-primary w-full disabled:opacity-50"
                        >
                            {loading ? 'Processando...' : 'Confirmar Parada'}
                        </button>
                    </div>
                )}

                <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
            </div>
        </div>
    );
};
