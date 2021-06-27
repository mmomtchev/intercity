'use strict';
const intercity = require('./src');
const gdal = require('gdal-async');

const sample1 = gdal.open('sample-warped.tif');
intercity.layer({
    name: 'warp:layer1',
    title: 'Layer 1',
    srs: sample1.srs,
    bbox: sample1.bands.getEnvelope()
}, async (request, reply) => {
    const ds = gdal.openAsync('sample-warped.tif');
});

intercity.layer({
    name: 'random:yellow',
    title: 'random yellow',
    srs: gdal.SpatialReference.fromEPSG(4326),
    bbox: { minX: -8, minY: 38, maxX: 12, maxY: 53 }
}, async (request, reply) => {
    const ds = await gdal.openAsync('temp', 'w', 'MEM', 128, 128, 1, gdal.GDT_CFloat32);
    ds.srs = gdal.SpatialReference.fromEPSG(4326);
    ds.geoTransform = [ -8, (12 + 8) / 128, 0, 53, 0, (38-53) / 128 ];
    console.log('geotransform', ds.geoTransform);
    const band = await ds.bands.getAsync(1);
    const data = new Uint8Array(128 * 128);
    for (let i = 0; i < data.length; i++)
        data[i] = Math.random() * 255;
    await band.pixels.write(0, 0, 128, 128, data);
    return reply.rgb([band, band, 0]);
});

const rain_ds = gdal.open('2-warped.tiff');
const rain_band = rain_ds.bands.get(1);
rain_band.scale = 40;
intercity.layer({
    name: 'arome:rain',
    title: 'Rain AROME',
    srs: rain_ds.srs,
    bbox: rain_ds.bands.getEnvelope()
}, async (request, reply) => {
    return reply.rgb([0, 0, rain_band]);
});

intercity.handle(intercity.wms, '/wms');
intercity.use(intercity.png);
intercity.use(intercity.jpeg);

intercity.listen(3000).catch(e => console.error(e));
