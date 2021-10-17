const testApp = require('./testapp');

const { testPort } = require('./libtest');
const { fastify } = require('../src/core');

const mochaHooks = {
    beforeAll() {
        if (!process.env.MOCHA_PORT)
            testApp(testPort);
    },
    afterAll() {
        fastify.close();
    }
};

module.exports = {
    mochaHooks
};
