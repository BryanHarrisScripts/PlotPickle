export default {
  ignoreFiles: ["app/design-tokens.css"],
  rules: {
    "color-no-hex": true,
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla"],
    "declaration-property-value-disallowed-list": {
      "/^(?:margin|margin-.+|padding|padding-.+|gap|row-gap|column-gap|border-radius|font-size)$/": [
        "/\\b\\d*\\.?\\d+(?:px|rem|em)\\b/"
      ]
    }
  }
};
