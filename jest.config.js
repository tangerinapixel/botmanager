// jest.config.js

module.exports = {
  testPathIgnorePatterns: [
    "<rootDir>/frontend/" // Isso vai ignorar todos os arquivos de teste dentro da pasta 'frontend'
  ],
  // Se você quiser testar apenas arquivos dentro de '__tests__', adicione:
  // testMatch: ["<rootDir>/__tests__/**/*.test.js"]
};