/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#8b5cf6',
          hover: '#7c3aed',
          dim: '#6d28d9'
        }
      }
    }
  },
  plugins: []
}
