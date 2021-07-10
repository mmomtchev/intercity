'use strict';

const gdal = require('gdal-async');
const Format = require('./format').Format;

let uid = 1;
class PNG extends Format {
    constructor() {
        super('PNG', 'image/png', 'png');
    }

    async produce(ds) {
        const pngDriver = gdal.drivers.get('PNG');
        const tmpName = `/vsimem/${uid++}.png`;
        await pngDriver.createCopyAsync(tmpName, ds)
        const raw = gdal.vsimem.release(tmpName);
        return raw;
    }
}

module.exports = new PNG();
