/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    spacing: {
      0: '0px',
      1: '4px',
      2: '8px',
      4: '16px',
      6: '24px',
      8: '32px',
      10: '40px',
      12: '48px',
      14: '56px',
      16: '64px',
    },
    borderRadius: {
      none: '0px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      '2xl': '32px',
      full: '9999px',
    },
    boxShadow: {
      sm: '0 1px 3px rgba(0,0,0,0.1)',
      md: '0 8px 24px rgba(0,0,0,0.65)',
      focus: '0 0 0 3px rgba(16,185,129,0.45)',
    },
    fontSize: {
      xs: '10px',
      sm: '12px',
      base: '14px',
      lg: '16px',
      xl: '20px',
      '2xl': '24px',
    },
    extend: {},
  },
  plugins: [],
};
