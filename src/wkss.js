'use strict';

const gdal = require('gdal-async');
const TileMatrix = require('./tilematrix').TileMatrix;

const GoogleMapsCompatible = new TileMatrix('GoogleMapsCompatible', [
    559082264.0287178,
    279541132.0143589,
    139770566.0071794,
    69885283.00358972,
    34942641.50179486,
    17471320.75089743,
    8735660.375448715,
    4367830.187724357,
    2183915.093862179,
    1091957.546931089,
    545978.7734655447,
    272989.3867327723,
    136494.6933663862,
    68247.34668319309,
    34123.67334159654,
    17061.83667079827,
    8530.918335399136,
    4265.459167699568,
    2132.729583849784
], 'urn:ogc:def:wkss:OGC:1.0:GoogleMapsCompatible', 'urn:ogc:def:crs:EPSG:6.18.3:3857',
    new gdal.Envelope({ minX: -20037508.3427892, minY: -20037508.3427892, maxX: 20037508.3427892, maxY: 20037508.3427892 }));


const GoogleCRS84Quad = new TileMatrix('GoogleCRS84Quad', [
    559082264.0287178,
    279541132.0143589,
    139770566.0071794,
    69885283.00358972,
    34942641.50179486,
    17471320.75089743,
    8735660.375448715,
    4367830.187724357,
    2183915.093862179,
    1091957.546931089,
    545978.7734655447,
    272989.3867327723,
    136494.6933663862,
    68247.34668319309,
    34123.67334159654,
    17061.83667079827,
    8530.918335399136,
    4265.459167699568,
    2132.729583849784
], 'urn:ogc:def:wkss:OGC:1.0:GoogleCRS84Quad', 'urn:ogc:def:crs:OGC:1.3:CRS84',
    new gdal.Envelope({ minX: -180, minY: -90, maxX: 180, maxY: 90 }));


const GlobalCRS84Scale = new TileMatrix('GlobalCRS84Scale', [
    500e6,
    250e6,
    100e6,
    50e6,
    25e6,
    10e6,
    5e6,
    2.5e6,
    1e6,
    500e3,
    250e3,
    100e3,
    50e3,
    25e3,
    10e3,
    5e3,
    2.5e3,
    1e3,
    500,
    250,
    100
], 'urn:ogc:def:wkss:OGC:1.0:GlobalCRS84Scale', 'urn:ogc:def:crs:OGC:1.3:CRS84',
    new gdal.Envelope({ minX: -180, minY: -90, maxX: 180, maxY: 90 }));

const GlobalCRS84Pixel = new TileMatrix('GlobalCRS84Pixel', [
    795139219.9519541,
    397569609.9759771,
    198784804.9879885,
    132523203.3253257,
    66261601.66266284,
    33130800.83133142,
    13252320.33253257,
    6626160.166266284,
    3313080.083133142,
    1656540.041566571,
    552180.0138555236,
    331308.0083133142,
    110436.0027711047,
    55218.00138555237,
    33130.80083133142,
    11043.60027711047,
    3313.080083133142,
    1104.360027711047
], 'urn:ogc:def:wkss:OGC:1.0:GlobalCRS84Pixel', 'urn:ogc:def:crs:OGC:1.3:CRS84',
    new gdal.Envelope({ minX: -180, minY: -90, maxX: 180, maxY: 90 }));

module.exports = {
    GoogleMapsCompatible,
    GoogleCRS84Quad,
    GlobalCRS84Scale,
    GlobalCRS84Pixel
};
