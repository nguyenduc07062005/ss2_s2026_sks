/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'sks-primary': '#4f46e5', // Indigo-600
        'sks-primary-dark': '#3730a3', // Indigo-800
        'sks-primary-light': '#eef2ff', // Indigo-50
        'sks-accent': '#10b981', // Emerald-500
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
      }
    },
  },
  plugins: [],
};
