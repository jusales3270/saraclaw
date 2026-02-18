import { SaraAvatar } from '../shared/SaraAvatar';

export function TypingIndicator() {
    return (
        <div className="flex gap-3 px-4 py-3">
            <SaraAvatar size="xs" isActive={true} />

            <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-tl-sm">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-white/30 
                      animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>
        </div>
    );
}
