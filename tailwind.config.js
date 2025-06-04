module.exports = {
  content: [
    './frontend/index.html',
    './frontend/src/**/*.{vue,js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        'theme-orange': '#FFA500',
        'theme-orange-dark': '#CC8400',
        'theme-orange-light': '#FFB733',
      }
    },
  },
  plugins: [],
};
