const testApp = require('./testapp');

const { testPort } = require('./libtest');
const { fastify } = require('../src/core');

const mochaHooks = {
    beforeAll() {
        testApp(testPort);
    },
    afterAll() {
        fastify.close();
    }
};

module.exports = {
    mochaHooks
};
