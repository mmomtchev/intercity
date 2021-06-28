'use strict';
const gdal = require('gdal-async');
const fastify = require('fastify')({ logger: { level: 'debug' } });

const wgs84 = gdal.SpatialReference.fromEPSG(4326);

let updateSequence = 1;

class Layer {
    constructor(_opts) {
        const opts = _opts || {};
        this.bbox = opts.bbox;
        this.name = opts.name;
        this.title = opts.title;
        this.handler = opts.handler;
        this.srs = opts.srs;
        this.srs.autoIdentifyEPSG();
        if (this.srs.getAuthorityName() !== 'EPSG')
            throw new Error('Only EPSG projections are supported at the moment');
        this.epsg = this.srs.getAuthorityCode();
        this.xform = new gdal.CoordinateTransformation(this.srs, wgs84);
        const ul = this.xform.transformPoint(this.bbox.minX, this.bbox.minY);
        const lr = this.xform.transformPoint(this.bbox.maxX, this.bbox.maxY);
        this.latlonbbox = new gdal.Envelope({
            minX: Math.min(ul.x, lr.x),
            minY: Math.min(ul.y, lr.y),
            maxX: Math.max(ul.x, lr.x),
            maxY: Math.max(ul.y, lr.y)
        });
    }
}

const layers = [];

function layer(opts, handler) {
    const l = new Layer({...opts, handler});
    fastify.log.debug(`layer> create ${l}`);
    updateSequence++;
    return layers.push(l) - 1;
}

function unlayer(idx) {
    updateSequence++;
    layers.splice(idx, 1);
}

module.exports = {
    updateSequence,
    layers,
    layer,
    unlayer
};
