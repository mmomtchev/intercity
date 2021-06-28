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

function handle(proto, base, path) {
    const handler = new proto(path, base);
    fastify.get(path, handler.main.bind(handler));
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
