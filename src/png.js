const gdal = require('gdal-async');
const fs = require('fs');
const Format = require('./format').Format;

let uid = 1;
class PNG extends Format {
    constructor() {
        super('PNG', 'image/png', 'png');
    }

    async produce(ds) {
        const pngDriver = gdal.drivers.get('PNG');
        const tmpName = `tmp${uid}.png`;
        await pngDriver.createCopyAsync(tmpName, ds)
        //const raw = Buffer.alloc(size * size * 3, 0);
        //const png = await gdal.openAsync(raw, 'w', 'png', size, size, 3, gdal.GDT_Byte);
        const raw = await fs.promises.readFile(tmpName);
        return raw;
    }
}

module.exports = new PNG();
