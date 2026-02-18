import type { Config } from 'tailwindcss';

export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                sara: {
                    bg: '#050505',
                    panel: '#0a0a0a',
                    border: '#1a1a1a',
                    'border-bright': '#2a2a2a',
                },
                soma: {
                    amber: '#fbbf24',
                    'amber-dim': '#b45309',
                    emerald: '#10b981',
                    'emerald-dim': '#047857',
                    rose: '#ef4444',
                    'rose-dim': '#b91c1c',
                },
            },
            fontFamily: {
                mono: ['JetBrains Mono', 'Roboto Mono', 'Fira Code', 'Consolas', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-in': 'slideIn 0.3s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { opacity: '0', transform: 'translateX(-8px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
            },
        },
    },
    plugins: [],
} satisfies Config;
