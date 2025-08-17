const path = require('path');
const { vol } = require('memfs');

// Mock filesystem
module.exports = {
  ...jest.requireActual('fs'),
  promises: {
    ...jest.requireActual('fs/promises'),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn()
  }
};