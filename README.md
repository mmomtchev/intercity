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
| Dimensions | Usable, WMS only |
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
    return reply.send(rain_ds);   // intercity will do the rest (with GDAL's default float -> byte conversion)
});

// A dynamically generated layer filled with a
// client-specified color in a WMS/WMTS dimension
intercity.layer({
    name: 'random:color',
    title: 'random color',
    srs: gdal.SpatialReference.fromEPSG(4326),
    bbox: { minX: -8, minY: 38, maxX: 12, maxY: 53 },
    dimensions: {
        units: 'color',
        unitSymbol: '????',
        // values can be dynamic, will be computed at every GetCapabilities
        values: () => ['red', 'green', 'blue'],
        default: 'red'
    }
}, async (request, reply) => {
    // if you return a raster band without geospatial metadata,
    // it is automatically considered to use the main SRS
    // and to cover the declared bounding box
    const ds = await gdal.openAsync('temp', 'w', 'MEM', 128, 128, 3, gdal.GDT_CFloat32);
    const bands = {
        red: await ds.bands.getAsync(1),
        green: await ds.bands.getAsync(2),
        blue: await ds.bands.getAsync(3)
    }
    // intercity will pass a dimensions object with all the parameters
    const color = bands[request.dimensions.color];

    const data = new Uint8Array(128 * 128);
    for (let i = 0; i < data.length; i++)
        data[i] = Math.random() * 255;
    await Promise.all([red.fillAsync(0),
        green.fillAsync(0),
        blue.fillAsync(0)
    ]);
    await color.pixels.writeAsync(0, 0, 128, 128, data);
    return reply.send(ds);   // intercity will do the rest
});

intercity.handle(intercity.wms, 'http://localhost:3000', '/wms');
intercity.handle(intercity.wmts, 'http://localhost:3000', '/wmts');
intercity.use(intercity.png);
intercity.use(intercity.jpeg);
intercity.use(intercity.wkss.GoogleCRS84Quad);

intercity.listen(3000).catch(e => console.error(e));
```

# Project status

`intercity` is my only major pure-JS project on which I work on paragliding trips during the summer while living off-grid on my 12V Macbook Air.

It may appear stalled, but it is not.
