import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'], // forced update

    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', 'sans-serif'],
          heading: ['Outfit', 'sans-serif'],
        },
        colors: {
          brand: {
            50: '#f0f9ff',
            100: '#e0f2fe',
            200: '#bae6fd',
            300: '#7dd3fc',
            400: '#38bdf8',
            500: '#0ea5e9',
            600: '#0284c7', // Primary Brand Color
            700: '#0369a1',
            800: '#075985',
            900: '#0c4a6e',
        },
          slate: {
            850: '#1e293b', // Custom dark slate
          }
        },
        boxShadow: {
            'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
            'card': '0 0 0 1px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.04)',
            'card-hover': '0 0 0 1px rgba(0,0,0,0.03), 0 8px 16px rgba(0,0,0,0.06)',
        },
        keyframes: {
            shimmer: {
                '0%':   { transform: 'translateX(-100%)' },
                '100%': { transform: 'translateX(200%)' },
            },
        },
        animation: {
            shimmer: 'shimmer 1.8s infinite linear',
        },
      },
    },
    plugins: [
        forms,
    ],
  }
