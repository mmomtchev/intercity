# Intercity.js
An Express-like middleware for serving dynamic geospatial data over WMS, WMTS, WCS and WFS

Built upon `gdal-async` and `fastify`

***Intercity.js is still unreleased and not ready for use***

[![License: LGPL v3](https://img.shields.io/badge/License-LGPL%20v3-blue.svg)](https://www.gnu.org/licenses/lgpl-3.0)
[![Node.js CI](https://github.com/mmomtchev/intercity/actions/workflows/node.js.yml/badge.svg)](https://github.com/mmomtchev/intercity/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/mmomtchev/intercity/branch/master/graph/badge.svg?token=08HS1KXSW9)](https://codecov.io/gh/mmomtchev/intercity)

# Intercity.js vs Geoserver

| | Geoserver | Intercity.js |
| --- | --- | --- |
| Role | Geospatial server | Geospatial middleware
| Target audience | System administrators | Developers |
| Configuration | Traditional GUI | Configuration-as-Code |
| Best for | High-traffic production deployment | Serving dynamic data for a limited number of users |
| Focus | Performance | Flexibility |
| Language | Java | JavaScript (Node.js) |

# Installation
Intercity.js is a work in progress and it hasn't been published yet. 

| Current status | |
| --- | --- |
| WMS | Working demo, not fully standards-compliant |
| WMTS | Working demo, not fully standards-compliant |
| Raster reprojection | Usable |
| WCS | Not started |
| WFS | Not started |

# Usage

```js
const intercity = require('intercity');
const gdal = require('gdal-async');

// A layer coming from a tiff
const rain_ds = gdal.open('rain.tiff');
intercity.layer({
    name: 'arome:rain',
    title: 'Rain AROME',
    srs: rain_ds.srs,
    bbox: rain_ds.bands.getEnvelope()
}, async (request, reply) => {
    return reply.send(rain_ds);   // intercity will do the rest
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
        blue.fillAsync(0)
    ]);
    return reply.send(ds);   // intercity will do the rest
});

intercity.handle(intercity.wms, 'http://localhost:3000', '/wms');
intercity.handle(intercity.wmts, 'http://localhost:3000', '/wmts');
intercity.use(intercity.png);
intercity.use(intercity.jpeg);
intercity.use(intercity.wkss.GoogleCRS84Quad);

intercity.listen(3000).catch(e => console.error(e));
```
