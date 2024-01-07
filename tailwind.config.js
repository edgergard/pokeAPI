/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
    colors: {
      'white': '#FFF',
      'black': '#000',
      'page-background': '#ede9fe',
      'card-border': '#4B5563',
      'card-background': '#e5e7eb',
      'card-text-bold': '#1F2937',
      'card-type-badge': '#374151',
      'card-stats-badge': '#F3F4F6',
      'form-required': '#6b7280',
      'button-submit': '#3730a3',
      'button-submit-hover': '#6366f1',
      'button-submit-active': '#818cf8',
      'label-error': '#ef4444',
    }
  },
  plugins: [],
}

