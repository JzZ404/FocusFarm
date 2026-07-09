/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // Map Next.js path alias @/* to project root
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          // Jest needs CommonJS modules; override the Next.js bundler resolution
          module: "commonjs",
          moduleResolution: "node",
        },
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
};

module.exports = config;
