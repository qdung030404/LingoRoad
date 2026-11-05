/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          25: '#E7F6ED',
          50: '#DCF1E0',
          100: '#CCF4DC',
          200: '#9DE8B8',
          300: '#72D391',
          400: '#52C87A',
          500: '#59B070', // Brand Primary
          600: '#418A54', // Hover Primary
          700: '#1E713B',
          800: '#20623F',
          900: '#1F4524',
        },
        slateDark: {
          900: '#1A2029',
          800: '#5B6574',
          700: '#657482',
          600: '#828FA1',
          500: '#7B8799',
          400: '#C6D0DE',
          300: '#CCD6E0',
          200: '#DBE2EB',
          100: '#E4E9F0',
          50: '#EDF1F6',
          25: '#F4F7FB',
        },
        amberGold: {
          50: '#FFF7EA',
          500: '#F2BD00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

