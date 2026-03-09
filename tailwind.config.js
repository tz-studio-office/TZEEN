/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#f5f5f0',
          100: '#efefe8',
          200: '#e4e4db',
          300: '#d3d3c7',
          400: '#b1b1a1',
          500: '#8f8f7b',
          600: '#67675a',
          700: '#4a4a41',
          800: '#2a2a26',
          900: '#111111',
        },
        warm: {
          50: '#fbfaf6',
          100: '#f3f0e7',
          200: '#e9e1cf',
          300: '#dbcda9',
          400: '#cdb87f',
          500: '#b89d59',
          600: '#927a42',
          700: '#6b5934',
          800: '#463b26',
          900: '#2d251b',
        },
        accent: {
          50: '#f3f3ef',
          100: '#e6e6df',
          200: '#d4d4ca',
          300: '#b8b8aa',
          400: '#969684',
          500: '#72725f',
          600: '#4c4c3f',
          700: '#2b2b24',
          800: '#181814',
          900: '#0f0f0c',
        },
      },
      boxShadow: {
        soft: '0 12px 40px rgba(17, 17, 17, 0.04)',
        shell: '0 25px 80px rgba(17, 17, 17, 0.05)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      letterSpacing: {
        caps: '0.22em',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Noto Sans JP', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Noto Sans JP', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
