'use strict';
const intercity = require('../src');
const path = require('path');
const gdal = require('gdal-async');

module.exports = function (port) {
    const sample1 = gdal.open(path.resolve(__dirname, 'data', 'sample-warped.tif'));
    intercity.layer(
        {
            name: 'warp:layer1',
            title: 'Layer 1',
            srs: sample1.srs,
            bbox: sample1.bands.getEnvelope()
        },
        async (request, reply) => {
            return reply.send(sample1);
        }
    );

    intercity.layer(
        {
            name: 'random:yellow',
            title: 'random yellow',
            srs: gdal.SpatialReference.fromEPSG(4326),
            bbox: { minX: 38, minY: -8, maxX: 53, maxY: 12 }
        },
        async (request, reply) => {
            const ds = await gdal.openAsync('temp', 'w', 'MEM', 128, 128, 3, gdal.GDT_CFloat32);
            const data = new Float32Array(128 * 128);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 255;
            await (await ds.bands.getAsync(1)).pixels.writeAsync(0, 0, 128, 128, data);
            await (await ds.bands.getAsync(2)).pixels.writeAsync(0, 0, 128, 128, data);
            await (await ds.bands.getAsync(3)).fillAsync(0);
            return reply.send(ds);
        }
    );

    intercity.layer(
        {
            name: 'stripes:yellow',
            title: 'red horizontal and green vertical stripes 1° apart',
            srs: gdal.SpatialReference.fromEPSG(4326),
            bbox: { minX: -8, minY: 38, maxX: 12, maxY: 53 }
        },
        async (request, reply) => {
            const width = 12 + 8;
            const height = 53 - 38;
            const ds = await gdal.openAsync('temp', 'w', 'MEM', width, height, 3, gdal.GDT_Byte);
            const red = await ds.bands.getAsync(1);
            const green = await ds.bands.getAsync(2);
            const blue = await ds.bands.getAsync(3);
            const one = new Uint8Array(1);
            const zero = new Uint8Array(1);
            one[0] = 255;
            zero[0] = 0;
            for (let x = 0; x < width; x++)
                await red.pixels.writeAsync(x, 0, 1, height, x % 2 ? one : zero, {
                    buffer_height: 1,
                    buffer_width: 1
                });
            for (let y = 0; y < height; y++)
                await green.pixels.writeAsync(0, y, width, 1, y % 2 ? one : zero, {
                    buffer_height: 1,
                    buffer_width: 1
                });
            await blue.fillAsync(0);
            return reply.send(ds);
        }
    );

    intercity.layer(
        {
            name: 'stripes:transparent',
            title: 'red horizontal and green vertical stripes 1° apart and transparency',
            srs: gdal.SpatialReference.fromEPSG(4326),
            bbox: { minX: -8, minY: 38, maxX: 12, maxY: 53 }
        },
        async (request, reply) => {
            const width = 12 + 8;
            const height = 53 - 38;
            const ds = await gdal.openAsync('temp', 'w', 'MEM', width, height, 4, gdal.GDT_Byte);
            const red = await ds.bands.getAsync(1);
            const green = await ds.bands.getAsync(2);
            const blue = await ds.bands.getAsync(3);
            const alpha = await ds.bands.getAsync(4);

            for (let x = 0; x < width; x++)
                for (let y = 0; y < height; y++) {
                    await red.pixels.setAsync(x, y, x % 2 ? 255 : 0);
                    await green.pixels.setAsync(x, y, y % 2 ? 255 : 0);
                    await alpha.pixels.setAsync(x, y, x % 2 || y % 2 ? 255 : 0);
                }
            await blue.fillAsync(0);
            return reply.send(ds);
        }
    );

    intercity.layer(
        {
            name: 'coords:lat_lon',
            title: 'Latitude in red band and longitude in green band',
            srs: gdal.SpatialReference.fromEPSG(4326),
            bbox: { minX: -180, minY: -90, maxX: 180, maxY: 90 }
        },
        async (request, reply) => {
            const width = 360;
            const height = 180;
            const ds = await gdal.openAsync('temp', 'w', 'MEM', width, height, 3, gdal.GDT_Byte);
            const red = await ds.bands.getAsync(1);
            const green = await ds.bands.getAsync(2);
            const blue = await ds.bands.getAsync(3);
            const data = new Uint8Array(1);
            for (let y = 0; y < height; y++) {
                data[0] = y;
                await red.pixels.writeAsync(0, y, width, 1, data, {
                    buffer_height: 1,
                    buffer_width: 1
                });
            }
            for (let x = 0; x < width; x++) {
                data[0] = x;
                await green.pixels.writeAsync(x, 0, 1, height, data, {
                    buffer_height: 1,
                    buffer_width: 1
                });
            }
            await blue.fillAsync(0);
            return reply.send(ds);
        }
    );

    const rain_ds = gdal.open(path.resolve(__dirname, 'data', '2-warped.tiff'));
    const rain_band = rain_ds.bands.get(1);
    const rain_blue_ds = gdal.open(
        'temp',
        'w',
        'MEM',
        rain_ds.rasterSize.x,
        rain_ds.rasterSize.y,
        3,
        gdal.GDT_Byte
    );
    rain_blue_ds.bands.get(1).fill(0);
    rain_blue_ds.bands.get(2).fill(0);
    rain_blue_ds.bands
        .get(3)
        .pixels.write(
            0,
            0,
            rain_ds.rasterSize.x,
            rain_ds.rasterSize.y,
            rain_band.pixels.read(0, 0, rain_ds.rasterSize.x, rain_ds.rasterSize.y)
        );
    rain_blue_ds.bands.get(3).scale = 40;
    intercity.layer(
        {
            name: 'arome:rain',
            title: 'Rain AROME',
            srs: rain_ds.srs,
            bbox: rain_ds.bands.getEnvelope()
        },
        async (request, reply) => {
            return reply.rgb(rain_blue_ds);
        }
    );

    intercity.handle(intercity.wms, `http://localhost:${port}`, '/wms');
    intercity.handle(intercity.wmts, `http://localhost:${port}`, '/wmts');
    intercity.handle(intercity.wmtsRenderer, `http://localhost:${port}`, '/wmtsRender', {
        target: `http://localhost:${port}/wmts`
    });
    intercity.use(intercity.png);
    intercity.use(intercity.jpeg);
    intercity.use(gdal.SpatialReference.fromEPSG(3857));
    intercity.use(gdal.SpatialReference.fromEPSG(4326));
    intercity.use(intercity.wkss.GoogleCRS84Quad);

    intercity.listen(port).catch((e) => console.error(e));

    return intercity;
};
