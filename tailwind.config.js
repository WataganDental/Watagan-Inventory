/** @type {import('@tailwindcss/cli').Config} */
export default {
  content: [
    "./public/**/*.{html,js}",
    "./public/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#88c0d0',
          content: '#2e3440'
        },
        secondary: {
          DEFAULT: '#81a1c1',
          content: '#2e3440'
        },
        accent: {
          DEFAULT: '#8fbcbb',
          content: '#2e3440'
        },
        neutral: {
          DEFAULT: '#4c566a',
          content: '#eceff4'
        },
        'base-100': '#eceff4',
        'base-200': '#e5e9f0', 
        'base-300': '#d8dee9',
        'base-content': '#2e3440',
        info: {
          DEFAULT: '#5e81ac',
          content: '#eceff4'
        },
        success: {
          DEFAULT: '#a3be8c',
          content: '#2e3440'
        },
        warning: {
          DEFAULT: '#ebcb8b',
          content: '#2e3440'
        },
        error: {
          DEFAULT: '#bf616a',
          content: '#eceff4'
        }
      }
    },
  }
};
