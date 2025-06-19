module.exports = {
  content: [
    './src/index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'theme-orange': '#FFA500',
        'theme-orange-dark': '#CC8400',
        'theme-orange-light': '#FFB733',
        'primary': '#FF6A00',
        'primary-dark': '#c2410c',
        'primary-light': '#ff944d',
        'surface': '#0b0f14',
        'surface-card': '#111827',
        'surface-elevated': '#1f2937',
        'surface-hover': '#374151',
        'surface-active': '#4b5563',
        'border': '#6b7280',
        'text-primary': '#f9fafb',
        'text-secondary': '#d1d5db',
        'text-muted': '#9ca3af'
      },
      backgroundColor: {
        'surface': '#0b0f14',
        'surface-card': '#111827',
        'surface-elevated': '#1f2937',
        'surface-hover': '#374151',
        'surface-active': '#4b5563',
        'info': '#3b82f6',
        'success': '#10b981',
        'warning': '#f59e0b',
        'error': '#ef4444',
        'muted': '#9ca3af'
      },
      borderColor: {
        'border': '#6b7280',
        'info': '#3b82f6',
        'success': '#10b981',
        'warning': '#f59e0b',
        'error': '#ef4444'
      },
      textColor: {
        'primary': '#f9fafb',
        'secondary': '#d1d5db',
        'muted': '#9ca3af',
        'warning': '#f59e0b',
        'success': '#10b981',
        'error': '#ef4444',
        'info': '#3b82f6'
      },
      placeholderColor: {
        'muted': '#9ca3af'
      }
    },
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.custom-scrollbar': {
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#111827',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#6b7280',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#FF6A00',
          },
        },
        '.hover\\:bg-orange-dark:hover': {
          backgroundColor: '#c2410c',
        },
        '.border-surface-border': {
          borderColor: '#6b7280',
        },
        '.bg-orange-dark': {
          backgroundColor: '#c2410c',
        }
      }
      addUtilities(newUtilities)
    }
  ],
};
