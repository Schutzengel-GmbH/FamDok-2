/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/generated/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // shared/ has no tsconfig of its own (backend and frontend each compile it with theirs),
        // so the test compiler options live here. Generated Prisma code imports with `.ts`
        // extensions, hence allowImportingTsExtensions.
        tsconfig: {
          target: 'es2022',
          module: 'commonjs',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          allowImportingTsExtensions: true,
          noEmit: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
