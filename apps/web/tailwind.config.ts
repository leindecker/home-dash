import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dash: {
          bg: '#0F1117',
          card: '#1A1D27',
          border: '#2A2D3A',
          green: '#1D9E75',
          'green-dim': 'rgba(29,158,117,0.15)',
          'red-dim': 'rgba(239,68,68,0.15)',
        },
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
} satisfies Config;