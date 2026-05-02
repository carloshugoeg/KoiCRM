module.exports = {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,css,md}": ["prettier --write"],
  "*.ts?(x)": () => "tsc --noEmit",
};
