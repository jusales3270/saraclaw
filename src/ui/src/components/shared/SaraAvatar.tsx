interface SaraAvatarProps {
    size?: 'xs' | 'sm' | 'md' | 'lg';
    isActive?: boolean;
    className?: string;
}

const sizes = {
    xs: 'w-7 h-7',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-20 h-20'
};

export function SaraAvatar({ size = 'sm', isActive = false, className = '' }: SaraAvatarProps) {
    return (
        <div className={`relative flex-shrink-0 ${className}`}>

            {/* Avatar image */}
            <div className={`${sizes[size]} rounded-full overflow-hidden
                      border border-white/10`}>
                <img
                    src="/sara-avatar.jpg"
                    alt="Sara"
                    className="w-full h-full object-cover
                    filter brightness-90"
                    style={{ objectPosition: '45% center' }}
                />
            </div>

            {/* Online indicator */}
            {isActive && (
                <span className="absolute bottom-0 right-0 
                        w-2 h-2 rounded-full bg-emerald-400 
                        border border-[#0a0a0a]" />
            )}
        </div>
    );
}
