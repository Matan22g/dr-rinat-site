/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // הוספתי לך כבר את הצבעים של פלטת ה-Lilac שבחרנו
        primary: '#9E8FB2', // Dusty Lilac
        secondary: '#F3F0F7', // Soft Lavender
        dark: '#2E2A35', // Dark Violet-Charcoal
        light: '#FDFBFE', // White/Mist
      },
      fontFamily: {
        sans: ['Assistant', 'sans-serif'],
        serif: ['Frank Ruhl Libre', 'serif'],
      }
    },
  },
  plugins: [],
}