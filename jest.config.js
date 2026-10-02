module.exports = {
    "transform": {
        "^.+\\.js$": ["babel-jest", {
            "plugins": ["@babel/plugin-transform-modules-commonjs"]
        }]
    },
    // FTMS ships browser-native ESM; transform just this dependency for Jest 27.
    "transformIgnorePatterns": ["/node_modules/(?!@deancochran/ftms/)"]
};
