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

class Reply {
    constructor(request, reply, layer) {
        this[replySymbol] = reply;
        this[requestSymbol] = request;
        this[layerSymbol] = layer;
        this.width = this[requestSymbol].width;
        this.height = this[requestSymbol].height;
    }

    async grayscale(gray) {   
        if (gray instanceof gdal.RasterBand) await this[prepareSymbol](gray.ds);
        const response = await gdal.openAsync('temp', 'w', 'MEM', this.width, this.height, 1, gdal.GDT_Byte);
        await this[bandSymbol](response.bands.getAsync(1), gray);
        return this[respondSymbol](response);
    }

    async rgb(rgb) {
        const prepare = [];
        for (let i = 0; i < 3; i++) {
            if (rgb[i] instanceof gdal.RasterBand) prepare.push(this[prepareSymbol](rgb[i].ds));
        }
        await Promise.all(prepare);
        const response = await gdal.openAsync('temp', 'w', 'MEM', this.width, this.height, 3, gdal.GDT_Byte);
        const bands = [];
        for (let i = 0; i < 3; i++) {
            bands[i] = this[bandSymbol](response.bands.getAsync(i + 1), rgb[i]);
        }
        await Promise.all(bands);
        return this[respondSymbol](response);
    }
}

Reply.prototype[prepareSymbol] = async function(ds) {
    if (!ds.lock) ds.lock = new AsyncLock();
    await ds.lock.acquire('srs', async () => {
        if (!await ds.srsAsync) {
            if (!ds.srs) ds.srs = this[layerSymbol].srs;
        }
    });
    await ds.lock.acquire('geo', async () => {
        if (!await ds.geoTransformAsync) {
            if (!ds.geoTransform) {
                const bbox = this[layerSymbol].bbox;
                ds.geoTransform = [
                    bbox.minX, (bbox.maxX - bbox.minX) / ds.rasterSize.x, 0,
                    bbox.maxY, 0, (bbox.minY - bbox.maxY) / ds.rasterSize.y
                ];
            }
        }
    });
    
    if (!(await ds.srsAsync) || !(await ds.srsAsync).isSame(this[layerSymbol].srs))
        throw new Error('Band SRS must match the main SRS of the served layer');
}

Reply.prototype[bandSymbol] = async function(dstq, data) {
    if (typeof data === 'number') {
        const band = await dstq;
        await band.fillAsync(data);
    } else if (typeof data === 'object' && data instanceof gdal.RasterBand) {
        const {windowSrc, windowDst} = await this[windowSymbol](data);
        fastify.log.debug(`reply> reading zone from band ${JSON.stringify(windowSrc)} to ${JSON.stringify(windowDst)}`);
        const buffer = new Uint8Array((windowDst.maxX - windowDst.minX + 1) * (windowDst.maxY - windowDst.minY + 1));
        const [array, band] = await Promise.all([
            data.pixels.readAsync(windowSrc.minX, windowSrc.minY,
                windowSrc.maxX - windowSrc.minX, windowSrc.maxY - windowSrc.minY,
                buffer, {
                    data_type: gdal.GDT_Byte,
                    buffer_width: windowDst.maxX - windowDst.minX + 1,
                    buffer_height: windowDst.maxY - windowDst.minY + 1
                }
            ),
            dstq
        ]);

        const scale = data.scale;
        const offset = data.offset;
        if (scale != 1.0 || offset != 0)
            for (let i = 0; i < array.length; i++) array[i] = array[i] * scale + offset;
        return band.pixels.writeAsync(windowDst.minX,
                                        windowDst.minY,
                                        windowDst.maxX - windowDst.minX + 1,
                                        windowDst.maxY - windowDst.minY + 1,
                                        array);
    } else {
        throw new Error(`Unsupported data type ${band}`);
    }
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
    this[replySymbol].type(this[requestSymbol].format.mime);
    const raw = await this[requestSymbol].format.produce(ds);
    this[replySymbol].send(raw);
}

module.exports = Reply;
