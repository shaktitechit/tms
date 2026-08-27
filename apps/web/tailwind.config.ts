import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#f4f8fd',
          900: '#ffffff',
          800: '#ffffff',
          700: '#e8f1fc',
        },
        accent: {
          DEFAULT: '#2563eb',
          dim: '#1d4ed8',
        },
      },
      boxShadow: {
        glow: '0 12px 40px rgba(37, 99, 235, 0.12)',
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 180ms ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
