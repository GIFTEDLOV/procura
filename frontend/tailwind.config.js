/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2a2e",
        paper: "#f5f5f1",
        line: "#dfe4df",
        moss: "#2f6b57",
        amber: "#bb7a25",
        rose: "#b4534b",
        blue: "#346c8a"
      },
      boxShadow: { panel: "0 12px 34px rgba(33, 43, 42, .06)" }
    }
  },
  plugins: []
};
