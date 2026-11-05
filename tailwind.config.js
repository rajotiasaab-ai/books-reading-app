/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sepia: {
          50: '#fdf8f0',
          100: '#faebd7',
          200: '#f5d5a0',
          300: '#e8b87d',
          400: '#c8945a',
          500: '#a0734a',
          600: '#7d5a3c',
          700: '#5c3d28',
          800: '#3d2b1a',
          900: '#1f160d',
        }
      },
      fontFamily: {
        'reader': ['Georgia', 'Times New Roman', 'serif'],
        'ui': ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
