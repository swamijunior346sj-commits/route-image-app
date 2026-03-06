import { } from 'react';

interface Plan {
    id: 'free' | 'pro' | 'enterprise';
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    buttonText: string;
    isPopular?: boolean;
    color: string;
}

interface SubscriptionViewProps {
    onBack: () => void;
    onSelectPlan: (planId: 'free' | 'pro' | 'enterprise') => void;
    currentPlan?: string;
}

export const SubscriptionView = ({ onBack, onSelectPlan, currentPlan = 'free' }: SubscriptionViewProps) => {

    const plans: Plan[] = [
        {
            id: 'free',
            name: 'Básico',
            price: 'R$ 0',
            period: '/sempre',
            description: 'Para quem está começando a organizar suas entregas.',
            features: [
                'Até 5 escaneamentos IA/dia',
                'Histórico de 10 endereços',
                'Rotas de até 3 paradas',
                'Mapa Dark Mode IA'
            ],
            buttonText: 'Plano Atual',
            color: 'from-slate-500 to-slate-700'
        },
        {
            id: 'pro',
            name: 'Entregador Pro',
            price: 'R$ 29,90',
            period: '/mês',
            description: 'Otimização máxima para quem vive das ruas.',
            features: [
                'Escaneamentos IA Ilimitados',
                'Histórico Vitalício',
                'Rotas de até 50 paradas',
                'Prioridade no Processamento',
                'Suporte VIP via WhatsApp'
            ],
            isPopular: true,
            buttonText: 'Assinar Agora',
            color: 'from-primary to-blue-600'
        },
        {
            id: 'enterprise',
            name: 'Frotas',
            price: 'Sob Consulta',
            period: '',
            description: 'Gestão completa para empresas e frotas.',
            features: [
                'Múltiplos Motoristas',
                'Relatórios de Performance',
                'API de Integração ERP',
                'Painel de Controle Customizado',
                'Treinamento de Equipe'
            ],
            buttonText: 'Falar com Vendas',
            color: 'from-accent to-purple-600'
        }
    ];

    const handleSelect = (id: 'free' | 'pro' | 'enterprise') => {
        if (id === currentPlan) return;
        onSelectPlan(id);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-bg-start overflow-y-auto no-scrollbar font-sans pb-20">
            {/* Header decorativo */}
            <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none"></div>
            <div className="absolute top-10 -left-20 size-80 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>

            <header className="sticky top-0 z-50 px-6 pt-12 pb-6 flex items-center justify-between bg-bg-start/80 backdrop-blur-xl">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90"
                >
                    <span className="material-symbols-outlined !text-[24px]">close</span>
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black tracking-[0.3em] text-primary/80 mb-0.5 uppercase">Premium Portal</span>
                    <h1 className="text-white font-black text-xl tracking-tighter italic uppercase">Upgrade RouteVision</h1>
                </div>
                <div className="size-10"></div> {/* Spacer */}
            </header>

            <main className="px-6 pt-4 space-y-8 relative">
                {/* Hero section */}
                <div className="text-center space-y-2">
                    <p className="text-slate-400 text-sm font-medium">Eleve sua produtividade ao nível neural</p>
                    <h2 className="text-3xl font-black text-white italic tracking-tighter leading-tight">ESCOLHA O SEU <br /><span className="text-primary drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">PRÓXIMO NÍVEL</span></h2>
                </div>

                {/* Plan Cards */}
                <div className="space-y-6 pb-10">
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`relative glass-card rounded-[2.5rem] p-8 border-white/5 transition-all duration-500 overflow-hidden ${plan.isPopular ? 'ring-2 ring-primary/50 shadow-[0_20px_40px_rgba(0,0,0,0.4)]' : ''}`}
                        >
                            {plan.isPopular && (
                                <div className="absolute top-0 right-0 py-2 px-6 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-bl-3xl italic shadow-lg">
                                    Mais Popular
                                </div>
                            )}

                            {/* Background decoration */}
                            <div className={`absolute -bottom-10 -right-10 size-40 bg-gradient-to-br ${plan.color} opacity-10 blur-[50px] rounded-full`}></div>

                            <div className="relative">
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg bg-white/5 border border-white/5 ${plan.isPopular ? 'text-primary' : 'text-slate-500'}`}>
                                    {plan.name}
                                </span>

                                <div className="mt-6 flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-white italic tracking-tighter">{plan.price}</span>
                                    <span className="text-sm font-bold text-slate-500 italic">{plan.period}</span>
                                </div>

                                <p className="mt-4 text-sm text-slate-400 font-medium leading-relaxed">
                                    {plan.description}
                                </p>

                                <ul className="mt-8 space-y-4">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <div className="mt-1 size-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined !text-[12px] text-primary font-bold">check</span>
                                            </div>
                                            <span className="text-sm font-semibold text-white/80">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => handleSelect(plan.id)}
                                    disabled={plan.id === currentPlan}
                                    className={`w-full mt-10 py-5 rounded-2xl font-black text-sm uppercase tracking-[0.15em] italic transition-all active:scale-95 shadow-2xl ${plan.id === currentPlan
                                        ? 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                                        : plan.isPopular
                                            ? 'bg-primary text-white shadow-[0_10px_30px_rgba(59,130,246,0.3)] hover:brightness-110'
                                            : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                >
                                    {plan.id === currentPlan ? 'Plano Ativo' : plan.buttonText}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Safety Badge */}
                <div className="flex flex-col items-center gap-4 py-10 opacity-60">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined !text-[20px] text-emerald-500">verified_user</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pagamento Seguro via SSL</span>
                    </div>
                    <p className="text-[9px] text-center text-slate-600 px-10 leading-relaxed font-bold uppercase tracking-widest">
                        Cancele a qualquer momento direto nas configurações da sua conta.
                    </p>
                </div>
            </main>
        </div>
    );
};
