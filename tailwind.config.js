/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617',
        },
        indigo: {
          950: '#1e1b4b',
        },
      },
    },
  },
  plugins: [],
}
