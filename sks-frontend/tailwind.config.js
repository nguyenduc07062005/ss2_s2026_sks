/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'sks-primary': '#0ea5e9', // Sky-500 (Cyan-Blue)
        'sks-primary-dark': '#0284c7', // Sky-600
        'sks-primary-light': '#e0f2fe', // Sky-100
        'sks-accent': '#06b6d4', // Cyan-500
        'sks-slate': {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'display': ['Plus Jakarta Sans', 'sans-serif'],
        'serif': ['Noto Serif', 'serif'],
      },
      boxShadow: {
        'sks-soft': '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 10px -1px rgba(15, 23, 42, 0.02)',
        'sks-medium': '0 12px 40px -10px rgba(15, 23, 42, 0.08), 0 4px 20px -5px rgba(15, 23, 42, 0.04)',
        'sks-heavy': '0 25px 60px -15px rgba(15, 23, 42, 0.12), 0 10px 30px -10px rgba(15, 23, 42, 0.08)',
        'sks-glow': '0 0 40px 10px rgba(79, 70, 229, 0.05)',
      },
      borderRadius: {
        'sks-xl': '1.25rem',
        'sks-2xl': '1.5rem',
        'sks-3xl': '2rem',
      },
      animation: {
        'spin-slow': 'spin 25s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'float-slow': 'float 8s ease-in-out 1s infinite',
        'slide-up': 'slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      }
    },
  },
  plugins: [],
};
