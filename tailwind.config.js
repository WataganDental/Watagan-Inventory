/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.{html,js}'],
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
  plugins: [],
};