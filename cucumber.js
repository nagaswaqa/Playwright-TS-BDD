module.exports = {
  default: `--require-module ts-node/register \
            --require src/**/*.ts \
            --require .features-gen/**/*.ts \
            --format progress`,
};
