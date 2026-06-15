/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 必须确保包含这一行，用于扫描并编译样式
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}