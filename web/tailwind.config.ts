import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette -- anchored on the three tokens:
        //   #FFA846 warm amber, #FF4689 hot pink, #1C030D near-black plum.
        brand: {
          50: '#FFF4E6',
          100: '#FFE4C2',
          200: '#FFCE92',
          300: '#FFB863',
          400: '#FFA846', // primary amber
          500: '#FF8A3D',
          600: '#FF6A5C',
          700: '#FF4689', // primary pink
          800: '#C72873',
          900: '#6B0F3A',
        },
        ink: {
          50: '#FDF6F2',
          100: '#F5E6EE',
          200: '#DFC1D2',
          300: '#B98AA5',
          400: '#85536E',
          500: '#4E2A3F',
          600: '#34152A',
          700: '#25091B',
          800: '#1C030D', // primary dark
          900: '#0E0106',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        glass:
          '0 10px 30px -12px rgba(255, 70, 137, 0.35), 0 4px 16px -8px rgba(255, 168, 70, 0.25)',
        'glass-strong':
          '0 25px 60px -20px rgba(255, 70, 137, 0.45), 0 10px 24px -10px rgba(255, 168, 70, 0.35)',
      },
      backgroundImage: {
        'brand-gradient':
          'linear-gradient(135deg, #FFA846 0%, #FF4689 55%, #1C030D 100%)',
        'brand-gradient-soft':
          'linear-gradient(135deg, rgba(255,168,70,0.85) 0%, rgba(255,70,137,0.85) 55%, rgba(28,3,13,0.95) 100%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%, 100%': {
            boxShadow:
              '0 0 0 0 rgba(255, 70, 137, 0.45), 0 0 0 0 rgba(255, 168, 70, 0.35)',
          },
          '50%': {
            boxShadow:
              '0 0 0 14px rgba(255, 70, 137, 0), 0 0 0 24px rgba(255, 168, 70, 0)',
          },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'wave': {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        glow: 'glow 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.4s ease-out both',
        wave: 'wave 0.9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
