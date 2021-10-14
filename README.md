# Intercity.js
An Express-like middleware for serving dynamic geospatial data over WMS, WMTS, WCS and WFS
Based upon `gdal-async` and `fastify`

***Intercity.js is still unreleased and not ready for use***

# Installation
Intercity.js is a work in progress and it hasn't been published yet. It currently supports only serving raster data over WMS.

# Usage

```js
const intercity = require('intercity');
const gdal = require('gdal-async');

// A layer coming from a tiff
const rain_ds = gdal.open('rain.tiff');
rain_band.scale = 40; // Scale is honored (4mm of rain = 160/256 of blue)
intercity.layer({
    name: 'arome:rain',
    title: 'Rain AROME',
    srs: rain_ds.srs,
    bbox: rain_ds.bands.getEnvelope()
}, async (request, reply) => {
    return reply.rgb(rain_ds);   // intercity will do the rest
});

// A random dynamically generated yellow layer
intercity.layer({
    name: 'random:yellow',
    title: 'random yellow',
    srs: gdal.SpatialReference.fromEPSG(4326),
    bbox: { minX: -8, minY: 38, maxX: 12, maxY: 53 }
}, async (request, reply) => {
    // if you return a raster band without geospatial metadata,
    // it is automatically considered to use the main SRS
    // and to cover the declared bounding box
    const ds = await gdal.openAsync('temp', 'w', 'MEM', 128, 128, 3, gdal.GDT_CFloat32);
    const [red, green, blue] = await Promise.all([
        ds.bands.getAsync(1),
        ds.bands.getAsync(2),
        ds.bands.getAsync(3)
    ]);
    const data = new Uint8Array(128 * 128);
    for (let i = 0; i < data.length; i++)
        data[i] = Math.random() * 255;
    await Promise.all([
        red.pixels.writeAsync(0, 0, 128, 128, data),
        green.pixels.writeAsync(0, 0, 128, 128, data),
        blue.pixels.writeAsync(0, 0, 128, 128, data)
    ]);
    return reply.rgb(ds);   // intercity will do the rest
});

intercity.handle(intercity.wms, 'http://localhost:3000', '/wms');
intercity.handle(intercity.wmts, 'http://localhost:3000', '/wmts');
intercity.use(intercity.png);
intercity.use(intercity.jpeg);
intercity.use(intercity.wkss.GoogleCRS84Quad);

intercity.listen(3000).catch(e => console.error(e));
```
