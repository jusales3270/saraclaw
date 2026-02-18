import { SaraAvatar } from '../shared/SaraAvatar';
import type { Message } from '../../stores/chat-store';

interface MessageBubbleProps {
    message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-3 px-4 py-3 group 
                    hover:bg-white/[0.02] transition-colors
                    ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

            {/* Avatar */}
            {!isUser && (
                <div className="flex-shrink-0 mt-1">
                    <SaraAvatar size="xs" />
                </div>
            )}

            {/* Bubble */}
            <div className={`flex flex-col max-w-[75%]
                      ${isUser ? 'items-end' : 'items-start'}`}>

                {/* Message content */}
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
                        ${isUser
                        ? 'bg-white/10 text-white rounded-tr-sm'
                        : 'bg-transparent text-white/85 rounded-tl-sm'
                    }`}>

                    {/* File attachment indicator */}
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                            {message.attachments.map((file, i) => (
                                <FileChip key={i} name={file.name} type={file.type} />
                            ))}
                        </div>
                    )}

                    {/* Text content */}
                    <MessageContent content={message.content} />
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 mt-1 px-1">
                    <span className="text-xs text-white/20">
                        {formatTime(new Date(message.timestamp))}
                    </span>

                    {message.metadata?.model && (
                        <span className="text-xs text-white/15">
                            {getModelLabel(message.metadata.model)}
                        </span>
                    )}

                    {message.metadata?.cost && (
                        <span className="text-xs text-white/15">
                            ${message.metadata.cost.toFixed(4)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function MessageContent({ content }: { content: string }) {
    // Simple markdown-like rendering
    const lines = content.split('\n');

    return (
        <div className="space-y-1">
            {lines.map((line, i) => {
                // Bold
                if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
                }

                // Code block
                if (line.startsWith('```')) {
                    return null; // Handled separately
                }

                // List item
                if (line.startsWith('• ') || line.startsWith('- ')) {
                    return (
                        <p key={i} className="flex gap-2">
                            <span className="text-white/30 mt-0.5">•</span>
                            <span>{line.slice(2)}</span>
                        </p>
                    );
                }

                // Empty line
                if (line.trim() === '') {
                    return <br key={i} />;
                }

                return <p key={i}>{line}</p>;
            })}
        </div>
    );
}

function FileChip({ name, type }: { name: string; type: string }) {
    const icon = type.includes('pdf') ? '📄' :
        type.includes('image') ? '🖼️' :
            type.includes('text') ? '📝' : '📎';

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 
                   bg-white/5 rounded-lg border border-white/10
                   text-xs text-white/60">
            <span>{icon}</span>
            <span className="max-w-[120px] truncate">{name}</span>
        </div>
    );
}

function formatTime(date: Date): string {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getModelLabel(model: string): string {
    const labels: Record<string, string> = {
        'strategic-brain': 'Opus',
        'agile-executor': 'Kimi',
        'fast-responder': 'Gemini'
    };
    return labels[model] || model;
}
