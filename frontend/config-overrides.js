module.exports = function override(config, env) {
  // Fix webpack dev server allowedHosts configuration
  if (config.devServer) {
    if (Array.isArray(config.devServer.allowedHosts)) {
      config.devServer.allowedHosts = config.devServer.allowedHosts.filter(
        (host) => host && host.length > 0
      );
    }
  }
  return config;
};
