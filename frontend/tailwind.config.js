/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#F2F6FB",
          100: "#E6EDF6",
          500: "#4A77B0",
          600: "#2C5790",
          700: "#1E4172",
          800: "#133158",
          900: "#0A2540",
        },
        orange: {
          50: "#FFF5EB",
          100: "#FFE9D4",
          400: "#FF9333",
          500: "#FF7A00",
          600: "#E86A00",
        },
        ink: {
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          700: "#334155",
          900: "#0F172A",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
