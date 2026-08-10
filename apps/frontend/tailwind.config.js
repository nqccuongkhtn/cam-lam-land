/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Brand tokens: use bg-navy / text-gold / border-navy / bg-navy/5 ...
      // Additive: existing arbitrary values (bg-[#0A2540]) still work; migrate gradually.
      colors: {
        navy: '#0A2540', // brand navy (primary surfaces, headings)
        gold: '#C8A14B', // brand gold accent
      },
    },
  },
  plugins: [],
};
