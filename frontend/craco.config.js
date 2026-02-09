module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.module.rules.forEach((rule) => {
        if (!rule.oneOf) return;

        rule.oneOf.forEach((r) => {
          const usesSourceMapLoader =
            r.enforce === "pre" &&
            r.use &&
            r.use.some((u) =>
              typeof u === "string"
                ? u.includes("source-map-loader")
                : u?.loader?.includes("source-map-loader")
            );

          if (usesSourceMapLoader) {
            r.exclude = [
              ...(Array.isArray(r.exclude) ? r.exclude : r.exclude ? [r.exclude] : []),
              /@tensorflow-models\/blazeface/,
            ];
          }
        });
      });

      return webpackConfig;
    },
  },
};
