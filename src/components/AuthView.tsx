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
            {/* Background Decorativo Neon/Glass blur */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Container Principal */}
            <div className="relative z-10 w-full max-w-sm px-6 flex flex-col animate-slide-up">

                {/* Cabecalho / Logo animada */}
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className="w-20 h-20 mb-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                        <span className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">RV</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-wide">Route Vision</h1>
                    <p className="text-zinc-400 text-sm mt-1">Escaneamento e Inteligência Geográfica</p>
                </div>

                {/* Card do Formulário */}
                <div className="glass-panel p-6 rounded-[2rem] border border-white/10 shadow-2xl relative">

                    {errorMsg && (
                        <div className="absolute -top-12 left-0 w-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl flex items-start gap-2 shadow-xl animate-fade-in backdrop-blur-md">
                            <X size={14} className="mt-0.5 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-bold text-white">
                                {isLoginMode ? 'Acessar Conta' : 'Criar Conta'}
                            </h2>
                        </div>

                        {!isLoginMode && (
                            <div className="flex flex-col gap-1.5 focus-within:text-blue-400 text-zinc-400 transition-colors">
                                <label className="text-[10px] font-bold uppercase tracking-wider ml-1">Nome Completo</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-70" />
                                    <input
                                        type="text"
                                        placeholder="João Silva"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5 focus-within:text-blue-400 text-zinc-400 transition-colors">
                            <label className="text-[10px] font-bold uppercase tracking-wider ml-1">Email ou Telefone</label>
                            <div className="relative">
                                {emailOrPhone.includes('@') ? (
                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-70" />
                                ) : (
                                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-70" />
                                )}
                                <input
                                    type="text"
                                    placeholder="exemplo@email.com"
                                    value={emailOrPhone}
                                    onChange={e => setEmailOrPhone(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5 focus-within:text-blue-400 text-zinc-400 transition-colors">
                            <label className="text-[10px] font-bold uppercase tracking-wider ml-1">Senha</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-70" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none transition-all tracking-widest"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="mt-4 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span>{isLoginMode ? 'Entrar' : 'Finalizar Cadastro'}</span>
                                    {isLoginMode ? <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /> : <UserPlus size={18} />}
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divisor */}
                    <div className="hidden mt-6 relative items-center justify-center">
                        <div className="absolute inset-x-0 h-px bg-white/5"></div>
                        <span className="relative bg-zinc-900/50 px-2 text-[10px] text-zinc-500 tracking-wider backdrop-blur-md">OU</span>
                    </div>

                    <div className="mt-8 text-center text-sm pt-4 border-t border-white/5">
                        <p className="text-zinc-400">
                            {isLoginMode ? "Ainda não tem acesso?" : "Já possui uma conta?"}
                        </p>
                        <button
                            onClick={() => {
                                setIsLoginMode(!isLoginMode);
                                setErrorMsg('');
                            }}
                            className="text-blue-400 font-bold hover:text-blue-300 mt-1 transition-colors flex items-center justify-center gap-1 mx-auto"
                        >
                            {isLoginMode ? (
                                <>Criar nova conta <ArrowRight size={16} /></>
                            ) : (
                                <><LogIn size={16} /> Voltar para o Login</>
                            )}
                        </button>
                    </div>

                </div>

                <div className="mt-8 text-center text-xs text-zinc-600">
                    <p>Ao continuar, você concorda com os Termos Corporativos de Uso.</p>
                </div>

            </div>
        </div>
    );
};
