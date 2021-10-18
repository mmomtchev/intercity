'use strict';
const gdal = require('gdal-async');

const wms = require('./wms');
const wmts = require('./wmts');
const wmtsRenderer = require('./wmtsRenderer');
const core = require('./core');
const png = require('./png');
const jpeg = require('./jpeg');
const format = require('./format');
const matrix = require('./tilematrix');
const wkss = require('./wkss');

async function listen(port) {
    try {
        await core.fastify.listen(port);
    } catch (err) {
        core.fastify.log.error(err);
        throw err;
    }
}

function handle(proto, base, path, opts) {
    const handler = new proto(path, base, opts);
    handler.register();
}

function use(handler) {
    if (handler instanceof format.Format) format.formats.push(handler);
    else if (handler instanceof matrix.TileMatrix) matrix.sets.push(handler);
    else if (handler instanceof gdal.SpatialReference) core.srsAdd(handler);
    else throw new TypeError('Unsupported handler type');
}

const layer = core.layer;
gdal.config.set('GDAL_PAM_ENABLED', 'NO');

module.exports = {
    layer,
    use,
    handle,
    listen,
    wms,
    wmts,
    wmtsRenderer,
    png,
    jpeg,
    wkss
};
