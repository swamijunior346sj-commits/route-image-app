import { useState } from 'react';
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
            const isEmail = emailOrPhone.includes('@');

            if (isLoginMode) {
                // LOGIN
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: isEmail ? emailOrPhone : `${emailOrPhone}@delivery.com`,
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
        <div className="w-full h-full min-h-screen bg-gradient-to-b from-[#0F172A] to-[#1E293B] flex flex-col items-center justify-center relative overflow-hidden px-6 font-sans">
            {/* Cinematic Background Decoration */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

            {/* Main HUD Container */}
            <div className="relative z-10 w-full max-w-sm flex flex-col animate-slide-up">

                {/* Cyber Logo / Brand */}
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className="group relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-[2rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
                        <div className="relative w-full h-full glass-card rounded-[2rem] flex items-center justify-center shadow-2xl overflow-hidden group-hover:border-primary/30 transition-all">
                            <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent"></div>
                            <span className="text-4xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-accent">RV</span>
                        </div>
                    </div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white/90">Route<span className="text-primary">Vision</span></h1>
                    <div className="flex items-center gap-3 mt-2 justify-center">
                        <div className="h-[1px] w-4 bg-white/10" />
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] italic">Intelligence Systems</p>
                        <div className="h-[1px] w-4 bg-white/10" />
                    </div>
                </div>

                {/* Auth Module Card */}
                <div className="relative">
                    {/* Error HUD */}
                    {errorMsg && (
                        <div className="absolute -top-20 left-0 w-full glass-card border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-widest p-4 rounded-2xl flex items-center gap-3 shadow-2xl animate-shake z-20">
                            <span className="material-symbols-outlined !text-red-500">error</span>
                            <span>Falha no Protocolo: {errorMsg}</span>
                        </div>
                    )}

                    <div className="glass-card p-8 rounded-[2.5rem] relative group overflow-hidden">
                        {/* Internal neon accent */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-focus-within:bg-primary/10 transition-colors" />

                        <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
                            <div className="mb-2">
                                <h2 className="text-xs font-bold italic uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    {isLoginMode ? 'Acessar Terminal' : 'Registrar Agente'}
                                </h2>
                            </div>

                            {!isLoginMode && (
                                <div className="space-y-2 group">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1 italic">Operador</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">person</span>
                                        <input
                                            type="text"
                                            placeholder="NOME COMPLETO"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-14 text-sm text-white/90"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 group">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1 italic">Credencial</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                                        {emailOrPhone.includes('@') ? 'mail' : 'contacts'}
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="EMAIL OU TERMINAL"
                                        value={emailOrPhone}
                                        onChange={e => setEmailOrPhone(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-14 text-sm text-white/90"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1 italic">Chave de Acesso</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-14 text-sm text-white/90 tracking-[0.5em]"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="mt-4 relative group/btn overflow-hidden"
                            >
                                <div className="relative w-full bg-primary hover:bg-primary/90 text-white font-black italic uppercase tracking-[0.3em] py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 text-xs active:scale-95 disabled:opacity-50">
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span>{isLoginMode ? 'Sincronizar' : 'Registrar'}</span>
                                            <span className="material-symbols-outlined !text-sm group-hover/btn:translate-x-1 transition-transform">
                                                {isLoginMode ? 'arrow_forward' : 'person_add'}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </button>
                        </form>

                        <div className="mt-10 text-center relative z-10">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic mb-3 opacity-60">
                                {isLoginMode ? "Status de Agente: Não Detectado" : "Já possui autorização?"}
                            </p>
                            <button
                                onClick={() => {
                                    setIsLoginMode(!isLoginMode);
                                    setErrorMsg('');
                                }}
                                className="text-white/80 hover:text-primary font-black italic uppercase text-[11px] tracking-[0.2em] transition-all flex items-center justify-center gap-2 mx-auto group"
                            >
                                {isLoginMode ? (
                                    <>SOLICITAR CREDENCIAIS <span className="material-symbols-outlined !text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span></>
                                ) : (
                                    <><span className="material-symbols-outlined !text-sm group-hover:-translate-x-1 transition-transform">login</span> RETORNAR AO TERMINAL</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-12 text-center space-y-2 opacity-30 group">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.5em] italic group-hover:text-slate-400 transition-colors">Sistema de Visão Tática v1.2.0 Stable</p>
                    <p className="text-[7px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">Este terminal é monitorado por inteligência artificial centralizada.</p>
                </div>

            </div>
        </div>
    );
};
