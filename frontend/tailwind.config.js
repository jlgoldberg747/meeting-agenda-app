/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#08B3C3',
          dk: '#1A9AA6',
          br: '#2BBCC8',
        },
        navy: 'var(--navy)',
        slate: 'var(--slate)',
        muted: 'var(--muted)',
        bdr: 'var(--bdr)',
        bg: 'var(--bg)',
        srf: 'var(--srf)',
        'srf-alt': 'var(--srf-alt)',
        coral: '#EF4444',
        amber: '#E09C14',
        success: '#22C55E',
        purple: '#9333EA',
        orange: '#F97316',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        sm: '10px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(13,31,60,0.07),0 1px 2px rgba(13,31,60,0.04)',
        'card-lg': '0 8px 24px rgba(13,31,60,0.1),0 2px 8px rgba(13,31,60,0.06)',
        teal: '0 2px 8px rgba(43,188,200,0.3)',
      },
    },
  },
  plugins: [],
};
