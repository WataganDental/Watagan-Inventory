/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.{html,js}'],
  darkMode: 'class',
  safelist: [
    'bg-blue-500', 'bg-blue-600', 'bg-green-500', 'bg-green-600', 'bg-red-500', 'bg-red-600',
    'bg-yellow-500', 'bg-yellow-600', 'bg-purple-500', 'bg-purple-600', 'bg-indigo-500', 'bg-indigo-600',
    'bg-gray-500', 'bg-gray-600', 'bg-red-100', 'bg-gray-100', 'bg-gray-200', 'bg-red-200',
    'text-white', 'text-blue-500', 'text-blue-700', 'text-red-500', 'text-red-700',
    'p-2', 'p-4', 'p-6', 'rounded', 'hover:bg-blue-600', 'hover:bg-green-600', 'hover:bg-red-600',
    'hover:bg-yellow-600', 'hover:bg-purple-600', 'hover:bg-indigo-600', 'hover:bg-gray-600',
    'flex', 'gap-2', 'items-center', 'flex-1', 'w-24', 'w-32', 'w-full', 'max-w-md', 'max-w-xs',
    'mb-2', 'mb-4', 'mb-6', 'mt-4', 'mx-auto', 'text-center', 'text-xl', 'text-lg', 'text-3xl',
    'font-bold', 'font-semibold', 'list-disc', 'pl-5', 'hidden', 'border', 'border-collapse'
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui'),],
  daisyui: {
    themes: [
      {
        nord: { // Explicitly naming the theme object key
          "primary": "#88C0D0",          // Nord8
          "primary-content": "#2E3440",  // Nord0 (Darkest gray for text on primary)
          "secondary": "#81A1C1",        // Nord9
          "secondary-content": "#2E3440",// Nord0
          "accent": "#8FBCBB",           // Nord7
          "accent-content": "#2E3440",   // Nord0
          "neutral": "#4C566A",          // Nord3
          "neutral-content": "#ECEFF4",  // Nord6 (Lightest gray for text on neutral)
          "base-100": "#ECEFF4",         // Nord6 (Background)
          "base-200": "#E5E9F0",         // Nord5
          "base-300": "#D8DEE9",         // Nord4
          "base-content": "#2E3440",     // Nord0 (Default text color on base)
          "info": "#5E81AC",             // Nord10
          "info-content": "#ECEFF4",     // Nord6
          "success": "#A3BE8C",          // Nord14
          "success-content": "#2E3440",  // Nord0
          "warning": "#EBCB8B",          // Nord13
          "warning-content": "#2E3440",  // Nord0
          "error": "#BF616A",            // Nord11
          "error-content": "#ECEFF4",    // Nord6
        },
      },
      {
        sunset: { // Explicitly naming the theme object key
          "primary": "#F67280",          // A common sunset pink/red
          "primary-content": "#FFFFFF",
          "secondary": "#C06C84",        // A common sunset purple
          "secondary-content": "#FFFFFF",
          "accent": "#F8B195",           // A common sunset peach
          "accent-content": "#2A363B",   // Dark text for light accent
          "neutral": "#355C7D",          // A darker blue/gray
          "neutral-content": "#FAD0C9",  // Light peach for text on neutral
          "base-100": "#2A363B",         // Dark background for sunset
          "base-200": "#1F2A2E",         // Slightly lighter dark
          "base-300": "#151D21",         // Even lighter dark
          "base-content": "#FAD0C9",     // Light text on dark base
          "info": "#6C5B7B",             // A muted purple
          "info-content": "#FFFFFF",
          "success": "#A7D26F",          // A contrasting green
          "success-content": "#2A363B",
          "warning": "#FCB97D",          // A warm orange
          "warning-content": "#2A363B",
          "error": "#E94560",            // A clearer error red for dark themes
          "error-content": "#FFFFFF",
        },
      },
    ],
    darkTheme: "sunset", // This will target the theme named 'sunset' in the array above
    logs: true,
  },
};