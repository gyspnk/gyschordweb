module.exports = {
  content: [
    "./docs/index.html",
    "./docs/js/**/*.js",
    "./docs/css/tailwind-source.css",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      screens: {
        xs: "360px",
        "3xl": "1600px",
      },
    },
  },
};
