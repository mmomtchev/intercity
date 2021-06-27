'use strict';
const fastify = require('fastify')({ logger: true });
const gdal = require('gdal-async');

const wms = require('./wms');
const core = require('./core');
const png = require('./png');
const jpeg = require('./jpeg');
const formats = require('./format').formats;

async function listen(port) {
    try {
        await fastify.listen(port);
    } catch (err) {
        fastify.log.error(err);
        throw err;
    }
}

function handle(handler, url) {
    fastify.get(url, handler.main);
}

function use(format) {
    formats.push(format);
}

const layer = core.layer;
module.exports = {
    layer,
    use,
    handle,
    listen,
    formats,
    wms,
    png,
    jpeg
};
