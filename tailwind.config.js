// ── BRAND PALETTE ─────────────────────────────────────────────
// Change these hex values to restyle the whole app (landing, auth, analyzer, admin).
const brand = { 50: '#ecfaf5', 100: '#d1f3e6', 200: '#a5e6d0', 300: '#6fd3b4', 400: '#3fbf98', 500: '#27a67f', 600: '#1f8a69', 700: '#1b6f56', 800: '#195845', 900: '#164838' }
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#0f2e27', mute: '#5f7a72', brand, indigo: brand } } },
  plugins: [],
}
