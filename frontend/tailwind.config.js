/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'nba-navy': '#0A1628',
        'nba-navy-mid': '#1A2E4A',
        'nba-orange': '#C9540A',
        'nba-orange-light': '#FEF0E8',
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
