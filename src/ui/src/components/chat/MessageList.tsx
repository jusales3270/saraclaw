import { useRef, useEffect } from 'react';
import type { Message } from '../../stores/chat-store';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
    messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex flex-col pb-4">
            {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
        </div>
    );
}
