'use strict';

const gdal = require('gdal-async');
const fastify = require('fastify')({ logger: { level: 'debug' } });
const fs = require('fs');
const AsyncLock = require('async-lock');

const requestSymbol = Symbol('_request');
const replySymbol = Symbol('_reply');
const layerSymbol = Symbol('_layer');
const prepareSymbol = Symbol('_prepare');
const respondSymbol = Symbol('_respond');

function bbox2geo(bbox, rasterSize) {
    return [
        bbox.minX, (bbox.maxX - bbox.minX) / rasterSize.x, 0,
        bbox.maxY, 0, (bbox.minY - bbox.maxY) / rasterSize.y
    ];
}

function geoTransform(xy, geo) {
    return {
        x: geo[0] + xy.x * geo[1] + xy.y * geo[2],
        y: geo[3] + xy.x * geo[4] + xy.y * geo[5]
    }
}

function geoTransformReverse(xy, geo) {
    const determinate = geo[1] * geo[5] - geo[2] * geo[4];
    const inverse = 1 / determinate;
    const inverseGeo = [
        (geo[2] * geo[3] - geo[0] * geo[5]) * inverse,
        geo[5] * inverse,
        -geo[2] * inverse,
        (-geo[1] * geo[3] + geo[0] * geo[4]) * inverse,
        -geo[4] * inverse,
        geo[1] * inverse
    ];
    return geoTransform(xy, inverseGeo);
}

function geo2bbox(geo, size) {
    const ul = geoTransform({ x: 0, y: 0 }, geo);
    const lr = geoTransform({ x: size.x, y: size.y }, geo);
    return new gdal.Envelope({
        minX: Math.min(ul.x, lr.x),
        maxX: Math.max(ul.x, lr.x),
        minY: Math.min(ul.y, lr.y),
        maxY: Math.max(ul.y, lr.y)
    });
}

class Reply {
    constructor(request, reply, layer) {
        this[replySymbol] = reply;
        this[requestSymbol] = request;
        this[layerSymbol] = layer;
        this.width = this[requestSymbol].width;
        this.height = this[requestSymbol].height;
    }

    async send(ds) {
        return this[respondSymbol](ds);
    }
}

Reply.prototype[prepareSymbol] = async function (ds) {
    if (!ds.lock) ds.lock = new AsyncLock();
    await ds.lock.acquire('srs', async () => {
        if (!await ds.srsAsync) ds.srs = this[layerSymbol].srs;
    });
    await ds.lock.acquire('geo', async () => {
        if (!await ds.geoTransformAsync) {
            ds.geoTransform = bbox2geo(this[layerSymbol].bbox, ds.rasterSize);
        }
    });

    return ds;
}

Reply.prototype[respondSymbol] = async function (ds) {
    await ds.flushAsync();
    await this[prepareSymbol](ds);
    const response = await gdal.openAsync('temp', 'w', 'MEM',
        this.width, this.height, await ds.bands.countAsync(), gdal.GDT_Byte);

    response.srs = this[requestSymbol].srs;
    response.geoTransform = bbox2geo(this[requestSymbol].bbox, response.rasterSize);

    await gdal.reprojectImageAsync({ src: ds, s_srs: ds.srs, dst: response, t_srs: response.srs });

    this[replySymbol].type(this[requestSymbol].format.mime);
    const raw = await this[requestSymbol].format.produce(response);
    this[replySymbol].send(raw);
}

module.exports = Reply;
