// Chrome API Mock for Jest
const store = {};

const chromeStorageListeners = [];

global.chrome = {
    storage: {
        local: {
            get: jest.fn((defaults, callback) => {
                const result = {};
                for (const key of Object.keys(defaults)) {
                    result[key] = store[key] !== undefined
                        ? JSON.parse(JSON.stringify(store[key]))
                        : defaults[key];
                }
                callback(result);
            }),
            set: jest.fn((items, callback) => {
                Object.assign(store, JSON.parse(JSON.stringify(items)));
                if (callback) callback();
                // Notify listeners
                const changes = {};
                for (const key of Object.keys(items)) {
                    changes[key] = { newValue: items[key] };
                }
                chromeStorageListeners.forEach(fn => fn(changes, 'local'));
            }),
        },
        onChanged: {
            addListener: jest.fn((fn) => {
                chromeStorageListeners.push(fn);
            }),
        },
    },
    runtime: {
        lastError: null,
        getURL: jest.fn(path => `chrome-extension://fakeid/${path}`),
    },
    tabs: {
        create: jest.fn(),
    },
};

// Helper to reset store between tests
global.resetChromeStorage = () => {
    for (const key of Object.keys(store)) delete store[key];
    chrome.runtime.lastError = null;
    chrome.storage.local.get.mockClear();
    chrome.storage.local.set.mockClear();
    chrome.storage.onChanged.addListener.mockClear();
    chromeStorageListeners.length = 0;
};

// Helper to seed storage with tasks
global.seedTasks = (tasks) => {
    store.tasks = JSON.parse(JSON.stringify(tasks));
};

/**
 * Load a browser script file into the global (globalThis) scope for testing.
 * Jest wraps test files in module scope, so eval/vm.runInThisContext don't leak
 * declarations. This helper uses new Function() and explicitly assigns listed
 * symbols to globalThis.
 *
 * @param {string} filePath - Absolute path to the script file
 * @param {string[]} exports - Array of symbol names to export to globalThis
 * @param {object} options - Options
 * @param {boolean} options.stripDOMContentLoaded - If true, converts the
 *   DOMContentLoaded wrapper into a callable function named __initFn__
 */
const fs = require('fs');
global.loadScript = (filePath, exports = [], options = {}) => {
    let code = fs.readFileSync(filePath, 'utf8');

    // Optionally convert DOMContentLoaded wrapper into a callable function
    if (options.stripDOMContentLoaded) {
        const domReadyRegex = /document\.addEventListener\('DOMContentLoaded',\s*function\s*\(\)\s*\{/;
        const match = code.match(domReadyRegex);
        if (match) {
            const startIdx = code.indexOf(match[0]);
            // Find the matching closing '});' by counting braces from the opening '{'
            let braceCount = 0;
            let closeIdx = -1;
            for (let i = startIdx + match[0].length - 1; i < code.length; i++) {
                if (code[i] === '{') braceCount++;
                else if (code[i] === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        closeIdx = i;
                        break;
                    }
                }
            }
            if (closeIdx !== -1) {
                // Replace opening with function declaration
                code = code.substring(0, startIdx) + 'function __initFn__() {' +
                    code.substring(startIdx + match[0].length, closeIdx + 1) +
                    code.substring(closeIdx + 1).replace(/^\s*\)\s*;?\s*/, '\n');
            }
        }
        if (!exports.includes('__initFn__')) {
            exports.push('__initFn__');
        }
    }

    // Append globalThis assignment for all exported symbols
    if (exports.length > 0) {
        code += '\n;Object.assign(globalThis, {' + exports.join(',') + '});';
    }

    new Function(code)();
};
