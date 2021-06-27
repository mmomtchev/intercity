const gdal = require('gdal-async');
const fs = require('fs');
const Format = require('./format').Format;

let uid = 1;
class JPEG extends Format {
    constructor() {
        super('JPEG', 'image/jpeg');
    }

    async produce(ds) {
        const jpegDriver = gdal.drivers.get('JPEG');
        const tmpName = `tmp${uid}.jpeg`;
        await jpegDriver.createCopyAsync(tmpName, ds)
        //const raw = Buffer.alloc(size * size * 3, 0);
        //const png = await gdal.openAsync(raw, 'w', 'png', size, size, 3, gdal.GDT_Byte);
        const raw = await fs.promises.readFile(tmpName);
        return raw;
    }
}

module.exports = new JPEG();
