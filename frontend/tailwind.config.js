/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'nba-navy': '#0A1628',
        'nba-navy-mid': '#1A2E4A',
        'nba-orange': '#F97316', // Update brand orange to #F97316
        'nba-orange-light': '#FEF0E8',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
  safelist: [
    'lg:left-16',
    'lg:left-64',
    'xl:left-64',
  ],
};
