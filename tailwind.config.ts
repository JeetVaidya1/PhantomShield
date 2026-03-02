import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        phantom: {
          bg: '#0F0D23',
          card: '#1E1B4B',
          'card-hover': '#272463',
          accent: '#6366F1',
          'accent-hover': '#818CF8',
          'text-primary': '#E0E7FF',
          'text-secondary': '#A5B4FC',
          'text-muted': '#818CF8',
          border: '#312E81',
          danger: '#EF4444',
          'danger-bg': '#7F1D1D',
          'danger-surface': '#2D0A0A',
          success: '#6EE7B7',
          'success-bg': '#065F46',
          warning: '#FCD34D',
          'warning-bg': '#78350F',
        },
      },
    },
  },
  plugins: [],
};

export default config;
