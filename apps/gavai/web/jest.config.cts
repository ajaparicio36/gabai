const nextJest = require('next/jest.js');

const createJestConfig = nextJest({
  dir: './',
});

const config = {
  displayName: '@gavai/web',
  preset: '../../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../coverage/apps/gavai/web',
  testEnvironment: 'jsdom',
};

const jestConfig = createJestConfig(config);

module.exports = async () => {
  // Nx sets NODE_ENV=production, but React production build strips `act`.
  // Tests need the development build.
  if (process.env.NODE_ENV === 'production') {
    process.env.NODE_ENV = 'test';
  }
  const resolved = await jestConfig();
  return resolved;
};
