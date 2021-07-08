'use strict';

const gdal = require('gdal-async');
const fastify = require('fastify')({ logger: { level: 'debug' } });
const fs = require('fs');

const requestSymbol = Symbol('_request');
const replySymbol = Symbol('_reply');
const layerSymbol = Symbol('_layer');
const windowSymbol = Symbol('_window');
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
        const response = await gdal.openAsync('temp', 'w', 'MEM', this.width, this.height, 1, gdal.GDT_Byte);
        await this[bandSymbol](response.bands.getAsync(1), gray);
        return this[respondSymbol](response);
    }

    async rgb(rgb) {
        const response = await gdal.openAsync('temp', 'w', 'MEM', this.width, this.height, 3, gdal.GDT_Byte);
        const bands = [];
        for (let i = 0; i < 3; i++) {
            bands[i] = this[bandSymbol](response.bands.getAsync(i + 1), rgb[i]);
        }
        await Promise.all(bands);
        return this[respondSymbol](response);
    }
}

Reply.prototype[bandSymbol] = function(dstq, data) {
    let q
    if (typeof data === 'number') {
        q = dstq.then((b) => b.fillAsync(data));
    } else if (typeof data === 'object' && data instanceof gdal.RasterBand) {
        const buffer = new Uint8Array(this.width * this.height);
        const window = this[windowSymbol](data);
        fastify.log.debug(`reply> reading zone from band ${JSON.stringify(window)}`);
        q = Promise.all([
            data.pixels.readAsync(window.minX, window.minY,
                window.maxX - window.minX, window.maxY - window.minY,
                buffer, {
                data_type: gdal.GDT_Byte,
                buffer_width: this.width,
                buffer_height: this.height
            }),
            dstq
        ]).then(([array, band]) => {
            const scale = data.scale;
            const offset = data.offset;
            if (scale != 1.0 || offset != 0)
                for (let i = 0; i < array.length; i++) array[i] = array[i] * scale + offset;
            return band.pixels.writeAsync(0, 0, this.width, this.height, array);
        })
    } else {
        throw new Error(`Unsupported data type ${band}`);
    }
    return q;
}

Reply.prototype[windowSymbol] = function(band) {
    if (!band.ds.srs) {
        band.ds.srs = this[layerSymbol].srs;
    }
    if (!band.ds.geoTransform) {
        const bbox = this[layerSymbol].bbox;
        band.ds.geoTransform = [
            bbox.minX, (bbox.maxX - bbox.minX) / band.ds.rasterSize.x, 0,
            bbox.maxY, 0, (bbox.minY - bbox.maxY) / band.ds.rasterSize.y];
    }
    if (!band.ds.srs || !band.ds.srs.isSame(this[layerSymbol].srs))
        throw new Error('Band SRS must match the main SRS of the served layer');
    const xform = new gdal.CoordinateTransformation(this[requestSymbol].srs, band.ds);
    const ul = xform.transformPoint(this[requestSymbol].bbox.minX, this[requestSymbol].bbox.minY);
    const lr = xform.transformPoint(this[requestSymbol].bbox.maxX, this[requestSymbol].bbox.maxY);
    return new gdal.Envelope({
        minX: Math.round(Math.min(ul.x, lr.x)),
        minY: Math.round(Math.min(ul.y, lr.y)),
        maxX: Math.round(Math.max(ul.x, lr.x)),
        maxY: Math.round(Math.max(ul.y, lr.y))
    });
}

Reply.prototype[respondSymbol] = async function(ds) {
    await ds.flushAsync();
    this[replySymbol].type(this[requestSymbol].format.mime);
    const raw = await this[requestSymbol].format.produce(ds);
    this[replySymbol].send(raw);
}

module.exports = Reply;
