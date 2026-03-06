import { useState } from 'react';
import { supabase } from '../services/supabase';

interface AuthViewProps {
    onLogin: () => void;
}

export const AuthView = ({ onLogin }: AuthViewProps) => {
    const [isLoginMode, setIsLoginMode] = useState(true);

    // States for Form
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');

        try {
            if (isLoginMode) {
                // LOGIN
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
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
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: name,
                            phone: phone,
                        }
                    }
                });

                if (error) throw error;
                if (data.user) {
                    alert('Conta criada! Verifique seu email para confirmar ou entre agora.');
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
        <div className="relative w-full h-full min-h-screen bg-[#070B14] text-slate-100 font-sans overflow-hidden">
            {/* Background Image Overlay */}
            <div
                className="fixed inset-0 z-0"
                style={{
                    background: `linear-gradient(to bottom, rgba(7, 11, 20, 0.4), rgba(7, 11, 20, 0.95)), url('https://images.unsplash.com/photo-1514565131-fce0801e5785?q=80&w=1000&auto=format&fit=crop')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
            ></div>

            <main className="relative z-10 flex flex-col min-h-screen px-8 pt-24 pb-12">
                <div className={`${isLoginMode ? 'mb-16' : 'mb-10 text-[40px]'} animate-fade-in`}>
                    <h1 className={`${isLoginMode ? 'text-[44px]' : 'text-[40px]'} font-extrabold tracking-tight text-white/90 leading-tight`}>
                        {isLoginMode ? 'Bem-vindo' : 'Criar Conta'}
                    </h1>
                    <p className="text-lg text-slate-400 font-medium mt-2">
                        {isLoginMode ? 'Acesse sua rota de hoje.' : 'Preencha os dados abaixo para começar.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 flex-1 animate-slide-up">
                    <div className="space-y-4">
                        {!isLoginMode && (
                            <input
                                autoComplete="name"
                                className="w-full bg-white/5 border border-white/20 rounded-2xl py-5 px-6 outline-none transition-all duration-300 placeholder:text-slate-500 placeholder:font-light focus:border-white/40 focus:bg-white/10 text-white"
                                placeholder="Nome Completo"
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        )}

                        <input
                            autoComplete="email"
                            className="w-full bg-white/5 border border-white/20 rounded-2xl py-5 px-6 outline-none transition-all duration-300 placeholder:text-slate-500 placeholder:font-light focus:border-white/40 focus:bg-white/10 text-white"
                            placeholder="E-mail"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />

                        {!isLoginMode && (
                            <input
                                autoComplete="tel"
                                className="w-full bg-white/5 border border-white/20 rounded-2xl py-5 px-6 outline-none transition-all duration-300 placeholder:text-slate-500 placeholder:font-light focus:border-white/40 focus:bg-white/10 text-white"
                                placeholder="Celular"
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                            />
                        )}

                        <div className="relative">
                            <input
                                autoComplete={isLoginMode ? "current-password" : "new-password"}
                                className="w-full bg-white/5 border border-white/20 rounded-2xl py-5 px-6 outline-none transition-all duration-300 placeholder:text-slate-500 placeholder:font-light focus:border-white/40 focus:bg-white/10 text-white"
                                placeholder="Sua senha"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined !font-light">
                                    {showPassword ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {errorMsg && (
                        <p className="text-red-500 text-xs font-bold uppercase tracking-widest mt-2 px-2 animate-shake">
                            {errorMsg}
                        </p>
                    )}

                    {isLoginMode && (
                        <div className="flex justify-end pt-2">
                            <button type="button" className="text-sm font-semibold text-[#60A5FA]/80 hover:text-[#60A5FA]">Esqueceu a senha?</button>
                        </div>
                    )}

                    <div className="flex justify-center pt-8">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative flex items-center justify-center size-20 bg-[#2563EB] rounded-full shadow-[0_0_30px_rgba(37,99,235,0.4)] active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <span className="material-symbols-outlined !text-[32px] text-white">arrow_forward</span>
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-auto pt-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-[1px] flex-1 bg-white/10"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {isLoginMode ? 'Ou entre com' : 'Ou cadastre-se com'}
                        </span>
                        <div className="h-[1px] flex-1 bg-white/10"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl py-4 flex items-center justify-center gap-3 active:scale-95 transition-transform hover:bg-white/10">
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                            </svg>
                            <span className="text-sm font-bold text-white">Google</span>
                        </button>
                        <button className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl py-4 flex items-center justify-center gap-3 active:scale-95 transition-transform hover:bg-white/10">
                            <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                                <path d="M17.05 20.28c-.98.95-2.05 1.78-3.23 1.76-1.16-.02-1.54-.74-2.89-.74-1.36 0-1.78.72-2.89.76-1.14.04-2.31-.88-3.31-1.87-2.03-2.03-3.1-5.75-1.03-9.35 1.03-1.78 2.85-2.91 4.82-2.94 1.5-.03 2.92 1.01 3.84 1.01.91 0 2.64-1.25 4.45-1.06 1.13.05 2.14.47 2.88 1.17-.67.63-1.26 1.4-1.26 2.5 0 1.25.75 2.19 1.79 3.08-.24.73-.55 1.45-.96 2.14-.54.91-1.04 1.83-1.46 2.54zM12.03 7.25c-.02-2.13 1.74-3.95 3.84-4.04.14 2.18-1.78 4.15-3.84 4.04z"></path>
                            </svg>
                            <span className="text-sm font-bold text-white">Apple</span>
                        </button>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-slate-500 text-sm">
                            {isLoginMode ? 'Não possui conta?' : 'Já possui uma conta?'} {' '}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLoginMode(!isLoginMode);
                                    setErrorMsg('');
                                }}
                                className="text-white font-bold hover:underline transition-all"
                            >
                                {isLoginMode ? 'Cadastre-se' : 'Entre aqui'}
                            </button>
                        </p>
                    </div>
                </div>
            </main>
            <div className="h-8 w-full fixed bottom-0 pointer-events-none"></div>
        </div>
    );
};
