import { useState } from 'react';
import { Mail, Phone, Lock, User, ArrowRight, UserPlus, LogIn, X } from 'lucide-react';
import { supabase } from '../services/supabase';

interface AuthViewProps {
    onLogin: () => void;
}

export const AuthView = ({ onLogin }: AuthViewProps) => {
    const [isLoginMode, setIsLoginMode] = useState(true);

    // States para Formulário
    const [emailOrPhone, setEmailOrPhone] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');

        try {
            // Handle Phone vs Email logic
            // Supabase prefers email or specifically formatted phone numbers.
            // For now, we'll assume email if it contains '@', otherwise we'll treat as phone.
            // Note: Phone auth requires specific setup in Supabase dashboard.
            const isEmail = emailOrPhone.includes('@');

            if (isLoginMode) {
                // LOGIN
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: isEmail ? emailOrPhone : `${emailOrPhone}@delivery.com`, // Fallback format for mock phones if not configured
                    password: password,
                });

                if (error) throw error;
                if (data.user) {
                    localStorage.setItem('isAuthenticated', 'true');
                    onLogin();
                }
            } else {
                // REGISTER
                if (!name.trim()) throw new Error('Por favor, informe seu nome completo.');

                const { data, error } = await supabase.auth.signUp({
                    email: isEmail ? emailOrPhone : `${emailOrPhone}@delivery.com`,
                    password: password,
                    options: {
                        data: {
                            full_name: name,
                        }
                    }
                });

                if (error) throw error;
                if (data.user) {
                    alert('Conta criada! Verifique seu email para confirmar (se habilitado) ou entre agora.');
                    setIsLoginMode(true);
                }
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            setErrorMsg(err.message || 'Erro inesperado ao processar autenticação.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full h-full min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
            {/* Cinematic Background Decoration */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

            {/* Grid overlay for tech feel */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

            {/* Main HUD Container */}
            <div className="relative z-10 w-full max-w-sm px-8 flex flex-col animate-[slideUp_0.8s_ease-out]">

                {/* Cyber Logo / Brand */}
                <div className="flex flex-col items-center mb-12 text-center">
                    <div className="group relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
                        <div className="relative w-full h-full bg-zinc-950 border border-white/10 rounded-[2rem] flex items-center justify-center shadow-2xl overflow-hidden group-hover:border-blue-500/30 transition-colors">
                            <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent"></div>
                            <span className="text-4xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-purple-400">RV</span>
                        </div>
                    </div>
                    <h1 className="text-4xl font-black italic uppercase italic tracking-tighter text-white">Route<span className="text-blue-500">Vision</span></h1>
                    <div className="flex items-center gap-3 mt-2 justify-center">
                        <div className="h-[1px] w-4 bg-zinc-800" />
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] italic">Intelligence Systems</p>
                        <div className="h-[1px] w-4 bg-zinc-800" />
                    </div>
                </div>

                {/* Auth Module Card */}
                <div className="relative">
                    {/* Error HUD */}
                    {errorMsg && (
                        <div className="absolute -top-16 left-0 w-full bg-red-600/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl flex items-center gap-3 shadow-2xl animate-[shake_0.5s_ease-in-out] backdrop-blur-xl z-20">
                            <X size={16} className="shrink-0" />
                            <span>Falha no Protocolo: {errorMsg}</span>
                        </div>
                    )}

                    <div className="bg-zinc-950/40 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative group overflow-hidden">
                        {/* Internal neon accent */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-focus-within:bg-blue-500/10 transition-colors" />

                        <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
                            <div className="mb-2">
                                <h2 className="text-xs font-black italic uppercase tracking-[0.3em] text-zinc-400 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    {isLoginMode ? 'Acessar Terminal' : 'Registrar Agente'}
                                </h2>
                            </div>

                            {!isLoginMode && (
                                <div className="space-y-2 group/field">
                                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-4 italic">Designação do Operador</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within/field:text-blue-500 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="NOME COMPLETO"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/5 group-hover/field:border-white/10 focus:border-blue-500/50 rounded-2xl py-4.5 pl-14 pr-6 text-xs text-white placeholder:text-zinc-800 focus:outline-none transition-all italic font-medium tracking-wider"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 group/field">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-4 italic">Credencial de Acesso</label>
                                <div className="relative">
                                    {emailOrPhone.includes('@') ? (
                                        <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within/field:text-blue-500 transition-colors" />
                                    ) : (
                                        <Phone size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within/field:text-blue-500 transition-colors" />
                                    )}
                                    <input
                                        type="text"
                                        placeholder="EMAIL OU TERMINAL"
                                        value={emailOrPhone}
                                        onChange={e => setEmailOrPhone(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/5 group-hover/field:border-white/10 focus:border-blue-500/50 rounded-2xl py-4.5 pl-14 pr-6 text-xs text-white placeholder:text-zinc-800 focus:outline-none transition-all italic font-medium tracking-wider"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 group/field">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-4 italic">Chave de Encriptação</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within/field:text-blue-500 transition-colors" />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/5 group-hover/field:border-white/10 focus:border-blue-500/50 rounded-2xl py-4.5 pl-14 pr-6 text-xs text-white placeholder:text-zinc-800 focus:outline-none transition-all tracking-[0.5em]"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="mt-4 relative group/btn"
                            >
                                <div className="absolute inset-0 bg-blue-600 rounded-2xl blur-lg opacity-20 group-hover/btn:opacity-40 transition-opacity" />
                                <div className="relative w-full bg-blue-600 hover:bg-blue-500 text-white font-black italic uppercase tracking-[0.3em] py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 text-xs disabled:opacity-50 active:scale-95">
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span>{isLoginMode ? 'Sincronizar Acesso' : 'Finalizar Registro'}</span>
                                            {isLoginMode ? <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" /> : <UserPlus size={18} />}
                                        </>
                                    )}
                                </div>
                            </button>
                        </form>

                        <div className="mt-10 text-center relative z-10">
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic mb-3">
                                {isLoginMode ? "Status de Agente: Não Detectado" : "Já possui autorização?"}
                            </p>
                            <button
                                onClick={() => {
                                    setIsLoginMode(!isLoginMode);
                                    setErrorMsg('');
                                }}
                                className="text-white hover:text-blue-400 font-black italic uppercase text-[11px] tracking-[0.2em] transition-all flex items-center justify-center gap-2 mx-auto group"
                            >
                                {isLoginMode ? (
                                    <>SOLICITAR NOVAS CREDENCIAIS <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></>
                                ) : (
                                    <><LogIn size={14} className="group-hover:-translate-x-1 transition-transform" /> RETORNAR AO TERMINAL</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-12 text-center space-y-2 opacity-30 group">
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.5em] italic group-hover:text-zinc-400 transition-colors">Sistema de Visão Tática v1.0.0 Stable</p>
                    <p className="text-[7px] font-bold text-zinc-700 uppercase tracking-widest leading-relaxed">Este terminal é monitorado. Todo acesso não autorizado será reportado ao protocolo central de segurança.</p>
                </div>

            </div>
        </div>
    );
};
