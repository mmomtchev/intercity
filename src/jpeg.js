'use strict';

const gdal = require('gdal-async');
const Format = require('./format').Format;

let uid = 1;
class JPEG extends Format {
    constructor() {
        super('JPEG', 'image/jpeg', 'jpeg');
    }

    async produce(ds) {
        const jpegDriver = gdal.drivers.get('JPEG');
        const tmpName = `/vsimem/${uid++}.jpeg`;
        (await jpegDriver.createCopyAsync(tmpName, ds)).close();
        const raw = gdal.vsimem.release(tmpName);
        return raw;
    }
}

module.exports = new JPEG();
