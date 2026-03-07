import { useEffect, useState } from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'success';
}

export const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    type = 'info'
}: ConfirmationModalProps) => {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
        } else {
            const timer = setTimeout(() => setIsAnimating(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen && !isAnimating) return null;

    return (
        <div className={`fixed inset-0 z-[20000] flex items-center justify-center p-6 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div className={`relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-8 flex flex-col items-center text-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'scale-100 translate-y-0' : 'scale-90 translate-y-10'}`}>
                {/* Icon based on type */}
                <div className={`size-16 rounded-2xl flex items-center justify-center mb-6 
                    ${type === 'danger' ? 'bg-red-50 text-red-500' :
                        type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                    <span className="material-symbols-outlined !text-[32px] font-bold">
                        {type === 'danger' ? 'warning' : type === 'success' ? 'check_circle' : 'info'}
                    </span>
                </div>

                <h3 className="text-[20px] font-black text-gray-900 mb-2 tracking-tight">{title}</h3>
                <p className="text-[15px] text-gray-500 font-medium leading-relaxed mb-8">
                    {message}
                </p>

                <div className="w-full flex flex-col gap-3">
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`w-full h-14 rounded-2xl font-bold transition-all active:scale-95 shadow-lg
                            ${type === 'danger' ? 'bg-red-500 text-white shadow-red-200' :
                                type === 'success' ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-[#2970ff] text-white shadow-blue-200'}`}
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full h-14 rounded-2xl font-bold text-gray-400 hover:bg-gray-50 transition-all"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};
