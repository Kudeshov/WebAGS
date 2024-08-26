module.exports = {
  devServer: {
    allowedHosts: 'all',
  },
  resolve: {
    fallback: {
      "fs": false,
      "path": false,
      "os": false
    }
  }
};
