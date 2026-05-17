/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#172026',
        clinic: '#0f766e',
        chain: '#2563eb',
      },
    },
  },
  plugins: [],
}
