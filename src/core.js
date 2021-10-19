'use strict';
const gdal = require('gdal-async');
const fastify = require('fastify')(process.env.DEBUG ? { logger: { level: 'debug' } } : {});
const Dimension = require('./dimension');

const wgs84 = gdal.SpatialReference.fromEPSG(4326);

let updateSequence = 1;

function epsg(srs) {
    try {
        srs.autoIdentifyEPSG();
        if (srs.getAuthorityName() !== 'EPSG') throw new Error();
    } catch (e) {
        throw new Error('Only EPSG projections are supported at the moment');
    }
    return srs.getAuthorityCode();
}

class Layer {
    constructor(_opts) {
        const opts = _opts || {};
        this.bbox = opts.bbox;
        this.name = opts.name;
        this.title = opts.title;
        this.handler = opts.handler;
        this.srs = opts.srs;
        this.epsg = epsg(this.srs);
        this.xform = new gdal.CoordinateTransformation(this.srs, wgs84);
        const ul = this.xform.transformPoint(this.bbox.minX, this.bbox.minY);
        const lr = this.xform.transformPoint(this.bbox.maxX, this.bbox.maxY);
        this.latlonbbox = new gdal.Envelope({
            minX: Math.min(ul.x, lr.x),
            minY: Math.min(ul.y, lr.y),
            maxX: Math.max(ul.x, lr.x),
            maxY: Math.max(ul.y, lr.y)
        });
        if (opts.dimensions) {
            this.dimensions = {};
            for (const d of Object.keys(opts.dimensions)) {
                this.dimensions[d] = new Dimension(d, {
                    title: opts.dimensions[d].title,
                    units: opts.dimensions[d].units,
                    unitSymbol: opts.dimensions[d].unitSymbol,
                    default: opts.dimensions[d].default,
                    values: opts.dimensions[d].values,
                    current: opts.dimensions[d].current
                });
            }
        }
    }
}

const layers = [];
const srs = [];

function srsAdd(s) {
    epsg(s);
    srs.push(s);
}

function layer(opts, handler) {
    const l = new Layer({ ...opts, handler });
    fastify.log.debug(`layer> create ${l.name}`);
    updateSequence++;
    return layers.push(l) - 1;
}

function unlayer(idx) {
    updateSequence++;
    fastify.log.debug(`layer> remove ${layers[idx].name}`);
    layers.splice(idx, 1);
}

module.exports = {
    fastify,
    wgs84,
    updateSequence,
    layers,
    srs,
    layer,
    unlayer,
    srsAdd
};
