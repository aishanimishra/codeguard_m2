/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        bg: {
          base:    '#0a0c0f',
          surface: '#111418',
          raised:  '#181c22',
          border:  '#1f252e',
          hover:   '#232930',
        },
        accent: {
          green:  '#00e676',
          red:    '#ff4444',
          amber:  '#ffab00',
          blue:   '#4fc3f7',
          purple: '#b388ff',
        },
        txt: {
          primary:   '#e8edf2',
          secondary: '#8892a0',
          muted:     '#4a5568',
        }
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.35s ease forwards',
        'pulse-slow': 'pulse 3s infinite',
        'scan':       'scan 2s linear infinite',
        'blink':      'blink 1s step-end infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scan:    { from: { transform: 'translateY(-100%)' }, to: { transform: 'translateY(400%)' } },
        blink:   { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
      }
    }
  },
  plugins: []
}
