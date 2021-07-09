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
    const band = await ds.bands.getAsync(1);
    const data = new Float32Array(128 * 128);
    for (let i = 0; i < data.length; i++)
        data[i] = Math.random() * 255;
    await band.pixels.writeAsync(0, 0, 128, 128, data);
    return reply.rgb([band, band, 0]);
});

intercity.layer({
    name: 'stripes:yellow',
    title: 'red horizontal and green vertical stripes 0.5° apart',
    srs: gdal.SpatialReference.fromEPSG(4326),
    bbox: { minX: -8, minY: 38, maxX: 12, maxY: 53 }
}, async (request, reply) => {
    const width = 12 + 8;
    const height = 53 - 38;
    const ds = await gdal.openAsync('temp', 'w', 'MEM', width, height, 2, gdal.GDT_Byte);
    const red = await ds.b
    ands.getAsync(1);
    const green = await ds.bands.getAsync(2);
    const one = new Uint8Array(1);
    const zero = new Uint8Array(1);
    one[0] = 255;
    zero[0] = 0;
    for (let x = 0; x < width; x++)
        await red.pixels.writeAsync(x, 0, 1, height,
            x % 2 ? one : zero, { buffer_height: 1, buffer_width: 1 });
    for (let y = 0; y < height; y++)
        await green.pixels.writeAsync(0, y, width, 1,
            y % 2 ? one : zero, { buffer_height: 1, buffer_width: 1 });
    return reply.rgb([red, green, 0]);
});

intercity.layer({
    name: 'coords:lat_lon',
    title: 'Latitude in red band and longitude in green band',
    srs: gdal.SpatialReference.fromEPSG(4326),
    bbox: { minX: -180, minY: -90, maxX: 180, maxY: 180 }
}, async (request, reply) => {
    const width = 360;
    const height = 180;
    const ds = await gdal.openAsync('temp', 'w', 'MEM', width, height, 2, gdal.GDT_CFloat32);
    const red = await ds.bands.getAsync(1);
    const green = await ds.bands.getAsync(2);
    for (let x = 0; x < width; x++)
        for (let y = 0; y < height; y++)
            await red.pixels.setAsync(x, y, y);
    for (let x = 0; x < width; x++)
        for (let y = 0; y < height; y++)
            await green.pixels.setAsync(x, y, x);
    return reply.rgb([red, green, 0]);
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

intercity.handle(intercity.wms, 'http://localhost:3000', '/wms');
intercity.handle(intercity.wmts, 'http://localhost:3000', '/wmts');
intercity.use(intercity.png);
intercity.use(intercity.jpeg);
intercity.use(intercity.wkss.GoogleCRS84Quad);

intercity.listen(3000).catch(e => console.error(e));
