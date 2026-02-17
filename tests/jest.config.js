module.exports = {
    testEnvironment: 'jsdom',
    rootDir: '..',
    roots: ['<rootDir>/tests'],
    moduleFileExtensions: ['js'],
    testMatch: ['**/*.test.js'],
    collectCoverageFrom: ['task_utils.js', 'popup.js', 'manager.js'],
};
