'use strict';
const fastify = require('fastify')({ logger: true });
const gdal = require('gdal-async');

const wms = require('./wms');
const wmts = require('./wmts');
const core = require('./core');
const png = require('./png');
const jpeg = require('./jpeg');
const format = require('./format');
const matrix = require('./tilematrix');
const wkss = require('./wkss');

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
    handler.register(fastify);
}

function use(handler) {
    if (handler instanceof format.Format)
        format.formats.push(handler);
    else if (handler instanceof matrix.TileMatrix)
        matrix.sets.push(handler);
    else if (handler instanceof gdal.SpatialReference)
        core.srsAdd(handler);
    else
        throw new TypeError('Unsupported handler type');
}

const layer = core.layer;
module.exports = {
    layer,
    use,
    handle,
    listen,
    wms,
    wmts,
    png,
    jpeg,
    wkss
};
