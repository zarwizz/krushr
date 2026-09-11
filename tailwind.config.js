/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
      },
      colors: {
        apple: {
          dark: "#121316",
          card: "rgba(28, 28, 32, 0.75)",
          cardBorder: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.05)",
          blue: "#0A84FF",
          blueHover: "#0071E3",
          accent: "#30D158",
          subtext: "#86868B",
        }
      },
      backdropBlur: {
        apple: "24px",
      },
      boxShadow: {
        apple: "0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.08)",
        glow: "0 0 20px rgba(10, 132, 255, 0.25)",
      }
    },
  },
  plugins: [],
}
