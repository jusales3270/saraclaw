/**
 * Sovereign Chat - Echo & Whisper Interface
 * 
 * Chat interface for interacting with Sara.
 */

import { useState } from 'preact/hooks';

interface Message {
    id: string;
    role: 'user' | 'sara' | 'whisper';
    content: string;
    timestamp: string;
}

interface Props {
    onSend?: (message: string) => void;
}

export function SovereignChat({ onSend }: Props) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'whisper',
            content: 'Descobri um padrão interessante nos dados de soberania digital...',
            timestamp: '09:12',
        },
        {
            id: '2',
            role: 'sara',
            content: 'Sistema inicializado. Pronta para assistir.',
            timestamp: '09:14',
        },
    ]);

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        if (!input.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }).slice(0, 5),
        };

        setMessages(prev => [...prev, newMessage]);
        setInput('');
        onSend?.(input);

        // Simulate Sara response
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'sara',
                content: 'Analisando sua solicitação...',
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }).slice(0, 5),
            }]);
        }, 1000);
    };

    const getRoleStyles = (role: Message['role']) => {
        switch (role) {
            case 'user':
                return 'bg-zinc-800/50 border-l-2 border-zinc-600';
            case 'sara':
                return 'bg-soma-emerald/5 border-l-2 border-soma-emerald/50';
            case 'whisper':
                return 'bg-soma-amber/5 border-l-2 border-soma-amber/50';
        }
    };

    const getRoleLabel = (role: Message['role']) => {
        switch (role) {
            case 'user': return 'Você';
            case 'sara': return 'Sara';
            case 'whisper': return '⚡ Whisper';
        }
    };

    return (
        <div className="flex flex-col h-full bg-sara-panel border border-sara-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-sara-border bg-sara-bg/50">
                <span className="text-soma-emerald font-bold uppercase tracking-widest text-xs">
                    Sovereign Chat
                </span>
                <span className="text-zinc-600 text-[10px] font-mono">
                    ECHO & WHISPER
                </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {messages.map(msg => (
                    <div key={msg.id} className={`p-3 rounded-lg ${getRoleStyles(msg.role)}`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${msg.role === 'whisper' ? 'text-soma-amber' :
                                    msg.role === 'sara' ? 'text-soma-emerald' : 'text-zinc-500'
                                }`}>
                                {getRoleLabel(msg.role)}
                            </span>
                            <span className="text-[10px] text-zinc-600 font-mono">
                                {msg.timestamp}
                            </span>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            {msg.content}
                        </p>
                    </div>
                ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-sara-border bg-sara-bg/30">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onInput={(e) => setInput((e.target as HTMLInputElement).value)}
                        placeholder="Fale com a Sara..."
                        className="flex-1 bg-sara-bg border border-sara-border rounded-lg px-4 py-2.5
                       text-sm text-zinc-300 placeholder-zinc-600
                       focus:outline-none focus:border-soma-emerald/50 transition-colors"
                    />
                    <button
                        type="submit"
                        className="px-5 py-2.5 bg-soma-emerald text-sara-bg font-bold text-xs uppercase
                       rounded-lg hover:bg-soma-emerald/90 transition-colors"
                    >
                        Enviar
                    </button>
                </div>
            </form>
        </div>
    );
}
