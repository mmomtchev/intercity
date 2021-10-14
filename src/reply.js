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

function geoFromBBox(bbox, size) {
    return [
        bbox.minX, (bbox.maxX - bbox.minX) / size.x, 0,
        bbox.maxY, 0, (bbox.minY - bbox.maxY) / size.y
    ];
}

function bboxFromGeo(geo, size) {
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

    async grayscale(gray) {
        const response = await gdal.openAsync('temp', 'w', 'MEM', this.width, this.height, 1, gdal.GDT_Byte);
        await this[bandSymbol](response.bands.getAsync(1), gray.bands.getAsync(1));
        return this[respondSymbol](response);
    }

    async rgb(rgb) {
        const response = await gdal.openAsync('temp', 'w', 'MEM', this.width, this.height, 3, gdal.GDT_Byte);
        const bands = [];
        for (let i = 1; i <= 3; i++) {
            bands[i] = this[bandSymbol](rgb.bands.getAsync(i), response.bands.getAsync(i));
        }
        await Promise.all(bands);
        return this[respondSymbol](response);
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

Reply.prototype[bandSymbol] = async function (srcBandq, dstBandq) {
    /*
    if (!s_srs.isSame(this[requestSymbol].srs)) {
        // This will be in the cache once the cache is implemented
        const warpOutput = await gdal.suggestedWarpOutputAsync({
            src: ds,
            s_srs: s_srs,
            t_srs: this[requestSymbol].srs
        });

        const warped = await gdal.openAsync('temp', 'w', 'MEM',
                warpOutput.rasterSize.x, warpOutput.rasterSize.y,
                await ds.bands.countAsync(), gdal.GDT_Int16);

        warped.geoTransform = warpOutput.geoTransform;
        warped.srs = this[requestSymbol].srs;
        await gdal.reprojectImageAsync({
            src: ds,
            dst: warped,
            s_srs: s_srs,
            t_srs: this[requestSymbol].srs,
            resampling: gdal.GRA_NearestNeighbor,
            blend: 0
        });

        return warped;
    }
    */
}

Reply.prototype[bandSymbol] = async function (srcBandq, dstBandq) {
    const srcBand = await srcBandq;
    const { windowSrc, windowDst } = await this[windowSymbol](srcBand);
    fastify.log.debug(`reply> reading zone from band ${JSON.stringify(windowSrc)} to ${JSON.stringify(windowDst)}`);
    const buffer = new Uint8Array((windowDst.maxX - windowDst.minX + 1) * (windowDst.maxY - windowDst.minY + 1));
    const [array, dstBand] = await Promise.all([
        srcBand.pixels.readAsync(windowSrc.minX, windowSrc.minY,
            windowSrc.maxX - windowSrc.minX + 1, windowSrc.maxY - windowSrc.minY + 1,
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

Reply.prototype[windowSymbol] = async function (band) {
    const srcSize = await band.ds.rasterSizeAsync;
    const srcSrs = (await band.ds.srsAsync) || this[layerSymbol].srs;
    const srcGeo = (await band.ds.geoTransformAsync) || geoFromBBox(this[layerSymbol].bbox, srcSize);
    const srcBbox = bboxFromGeo(srcGeo, srcSize);

    const dstSize = { x: this[requestSymbol].width, y: this[requestSymbol].height };
    const dstSrs = this[requestSymbol].srs;
    const dstGeo = geoFromBBox(this[requestSymbol].bbox, dstSize);
    const dstBbox = this[requestSymbol].bbox;

    // ulSrc/lrSrc - raster coordinates of the destination box in the source raster
    // ulDst/lrDst - raster coordinates of the source boundaries in the destination raster
    const xformFrom = new gdal.CoordinateTransformation(dstSrs, srcSrs);
    const xformTo = new gdal.CoordinateTransformation(srcSrs, dstSrs);
    const ulSrc = geoTransformReverse(xformFrom.transformPoint(dstBbox.minX, dstBbox.minY), srcGeo);
    const lrSrc = geoTransformReverse(xformFrom.transformPoint(dstBbox.maxX, dstBbox.maxY), srcGeo);
    const ulDst = geoTransformReverse(xformTo.transformPoint(srcBbox.minX, srcBbox.minY), dstGeo);
    const lrDst = geoTransformReverse(xformTo.transformPoint(srcBbox.maxX, srcBbox.maxY), dstGeo);
    const windowSrc = new gdal.Envelope({
        minX: Math.round(Math.min(ulSrc.x, lrSrc.x)),
        minY: Math.round(Math.min(ulSrc.y, lrSrc.y)),
        maxX: Math.round(Math.max(ulSrc.x, lrSrc.x)) - 1,
        maxY: Math.round(Math.max(ulSrc.y, lrSrc.y)) - 1
    });
    const windowDst = new gdal.Envelope({
        minX: 0,
        minY: 0,
        maxX: this.width - 1,
        maxY: this.height - 1
    });

    // Clamp the values to do a partial read when the window
    // is partly outside of the source band
    if (windowSrc.minX < 0) {
        windowDst.minX = Math.round(Math.min(ulDst.x, lrDst.x));
        windowSrc.minX = 0;
    }
    if (windowSrc.minY < 0) {
        windowDst.minY = Math.round(Math.min(ulDst.y, lrDst.y));
        windowSrc.minY = 0;
    }
    if (windowSrc.maxX >= srcSize.x) {
        windowDst.maxX = Math.round(Math.max(ulDst.x, lrDst.x)) - 1;
        windowSrc.maxX = srcSize.x - 1;
    }
    if (windowSrc.maxY >= srcSize.y) {
        windowDst.maxY = Math.round(Math.max(ulDst.y, lrDst.y)) - 1;
        windowSrc.maxY = srcSize.y - 1;
    }
    return { windowSrc, windowDst };
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
