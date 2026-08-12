/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        agri: {
          green: '#16a34a',
          dark: '#052e16',
          card: '#0f172a',
          border: '#1e293b',
        },
      },
    },
  },
  plugins: [],
}
