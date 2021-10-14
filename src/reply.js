'use strict';

const gdal = require('gdal-async');
const fastify = require('fastify')({ logger: { level: 'debug' } });
const fs = require('fs');
const AsyncLock = require('async-lock');

const requestSymbol = Symbol('_request');
const replySymbol = Symbol('_reply');
const layerSymbol = Symbol('_layer');
const windowSymbol = Symbol('_window');
const prepareSymbol = Symbol('_prepare');
const bandSymbol = Symbol('_band');
const respondSymbol = Symbol('_respond');

function bbox2geo(bbox, rasterSize) {
    return [
        bbox.minX, (bbox.maxX - bbox.minX) / rasterSize.x, 0,
        bbox.maxY, 0, (bbox.minY - bbox.maxY) / rasterSize.y
    ];
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

Reply.prototype[prepareSymbol] = async function(ds) {
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

Reply.prototype[bandSymbol] = async function(srcBandq, dstBandq) {
    const srcBand = await srcBandq;
    const {windowSrc, windowDst} = await this[windowSymbol](srcBand);
    fastify.log.debug(`reply> reading zone from band ${JSON.stringify(windowSrc)} to ${JSON.stringify(windowDst)}`);
    const buffer = new Uint8Array((windowDst.maxX - windowDst.minX + 1) * (windowDst.maxY - windowDst.minY + 1));
    const [array, dstBand] = await Promise.all([
        srcBand.pixels.readAsync(windowSrc.minX, windowSrc.minY,
            windowSrc.maxX - windowSrc.minX, windowSrc.maxY - windowSrc.minY,
            buffer, {
                data_type: gdal.GDT_Byte,
                buffer_width: windowDst.maxX - windowDst.minX + 1,
                buffer_height: windowDst.maxY - windowDst.minY + 1
            }
        ),
        dstBandq
    ]);

    const scale = srcBand.scale;
    const offset = srcBand.offset;
    if (scale != 1.0 || offset != 0)
        for (let i = 0; i < array.length; i++) array[i] = array[i] * scale + offset;
    return dstBand.pixels.writeAsync(windowDst.minX,
                                    windowDst.minY,
                                    windowDst.maxX - windowDst.minX + 1,
                                    windowDst.maxY - windowDst.minY + 1,
                                    array);
}

Reply.prototype[windowSymbol] = async function(band) {
    const rasterSize = await band.ds.rasterSizeAsync;
    const xform = new gdal.CoordinateTransformation(this[requestSymbol].srs, band.ds);
    const ul = xform.transformPoint(this[requestSymbol].bbox.minX, this[requestSymbol].bbox.minY);
    const lr = xform.transformPoint(this[requestSymbol].bbox.maxX, this[requestSymbol].bbox.maxY);
    const windowSrc = new gdal.Envelope({
        minX: Math.round(Math.min(ul.x, lr.x)),
        minY: Math.round(Math.min(ul.y, lr.y)),
        maxX: Math.round(Math.max(ul.x, lr.x)),
        maxY: Math.round(Math.max(ul.y, lr.y))
    });
    // Clamp the values to do a partial read when the window
    // is partly outside of the source band
    const srcWidth = Math.round(Math.abs(ul.x - lr.x));
    const srcHeight = Math.round(Math.abs(ul.y - lr.y));
    const windowDst = new gdal.Envelope({
        minX: 0,
        minY: 0,
        maxX: this.width - 1,
        maxY: this.height - 1
    })
    if (windowSrc.minX < 0) {
        windowDst.minX = Math.round((-windowSrc.minX) / srcWidth * this.width);
        windowSrc.minX = 0;
    }
    if (windowSrc.minY < 0) {
        windowDst.minY = Math.round((-windowSrc.minY) / srcHeight * this.height);
        windowSrc.minY = 0;
    }
    if (windowSrc.maxX >= rasterSize.x) {
        windowDst.maxX -= Math.round((windowSrc.maxX - rasterSize.x) / srcWidth * this.width);
        windowSrc.maxX = rasterSize.x;
    }
    if (windowSrc.maxY >= rasterSize.y) {
        windowDst.maxY -= Math.round((windowSrc.maxY - rasterSize.y) / srcHeight * this.height);
        windowSrc.maxY = rasterSize.y;
    }
    return {windowSrc, windowDst};
}

Reply.prototype[respondSymbol] = async function(ds) {
    await ds.flushAsync();
    await this[prepareSymbol](ds);
    const response = await gdal.openAsync('temp', 'w', 'MEM',
            this.width, this.height, await ds.bands.countAsync(), gdal.GDT_Byte);

    response.srs = this[requestSymbol].srs;
    response.geoTransform = bbox2geo(this[requestSymbol].bbox, response.rasterSize);

    await gdal.reprojectImageAsync({src: ds, s_srs: ds.srs, dst: response, t_srs: response.srs});

    this[replySymbol].type(this[requestSymbol].format.mime);
    const raw = await this[requestSymbol].format.produce(response);
    this[replySymbol].send(raw);
}

module.exports = Reply;
