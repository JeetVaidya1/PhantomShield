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
          bg: '#0a0e17',
          'bg-secondary': '#0d1117',
          card: '#111827',
          'card-hover': '#1a2332',
          accent: '#6366f1',
          'accent-hover': '#818cf8',
          'text-primary': '#e2e8f0',
          'text-secondary': '#94a3b8',
          'text-muted': '#64748b',
          border: '#1f2937',
          'border-light': '#374151',
          danger: '#ef4444',
          'danger-bg': '#7f1d1d',
          'danger-surface': '#1c1117',
          success: '#22c55e',
          'success-bg': '#052e16',
          warning: '#f59e0b',
          'warning-bg': '#451a03',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
