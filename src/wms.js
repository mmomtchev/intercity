'use strict';

const { create, fragment } = require('xmlbuilder2');
const fastify = require('fastify')({ logger: { level: 'debug' } });
const semver = require('semver');

const core = require('./core');
const Reply = require('./reply');
const Request = require('./request');
const formats = require('./format').formats;

async function main(request, reply) {
    if (request.query.SERVICE !== 'WMS')
        throw new Error(`Invalid service ${request.query.SERVICE}, only WMS supported`);
    let version = request.query.VERSION || '1.3.0';
    if (semver.gt(version, '1.3.0'))
        throw new Error(`Invalid service WMS version ${version}, up to 1.3.0 supported`);
    if (semver.lt(version, '1.3.0') && semver.gte(version, '1.1.1'))
        version = '1.1.1';
    if (semver.lt(version, '1.1.1'))
        throw new Error(`Invalid service WMS version ${version}, starting from 1.1.1 supported`);
    switch (request.query.REQUEST) {
        case 'GetCapabilities':
            return getCapabilites(version);
        case 'GetMap':
            return getMap(request, reply);
        default:
            throw new Error(`Invalid request ${request.query.REQUEST}`);
    }
}

function wmsLayers() {
    const layers = fragment().ele('Layer');
    for (const l of core.layers) {
        const llbb = l.latlonbbox;
        const bb = l.bbox;
        layers
            .ele('Layer')
            .ele('Name').txt(l.name).up()
            .ele('Title').txt(l.title).up()
            .ele('SRS').txt(`EPSG:${l.epsg}`).up()
            .ele('LatLonBoundingBox', { minx: bb.minX, miny: bb.minY, maxx: bb.maxX, maxy: bb.maxY }).up()
            .ele('BoundingBox', { SRS: `EPSG:${l.epsg}`, minx: llbb.minX, miny: llbb.minY, maxx: llbb.maxX, maxy: llbb.maxY }).up()
            .up()
            .up();
    }
    return layers.up();
}

function wmsFormats() {
    const list = fragment();
    for (const f of formats) {
        list.ele('Format').txt(f.mime);
    }
    return list;
}

const wmsAttrs = {
    '1.1.1': { version: '1.1.1' },
    '1.3.0': {
        version: '1.3.0',
        'xmlns': 'http://www.opengis.net/wms',
        'xmlns:sld': 'http://www.opengis.net/sld',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'http://www.opengis.net/wms http://schemas.opengis.net/wms/1.3.0/capabilities_1_3_0.xsd'
    }
};

function getCapabilites(version) {
    let caps = create({ version: '1.0' });
    if (version === '1.1.1') caps = caps.dtd({ sysID: 'http://schemas.opengis.net/wms/1.1.1/WMS_MS_Capabilities.dtd' });

    caps.ele('WMT_MS_Capabilities', { ...wmsAttrs[version] })
        .ele('Service')
            .ele('Name').txt('OGC:WMS').up()
            .ele('Title').txt('intercity.js').up()
            .ele('OnlineResource', { 'xmlns:xlink': 'http://www.w3.org/1999/xlink', 'xlink:href': 'http://localhost:3000/wms' }).up()
        .up()
        .ele('Capability')
            .ele('Request')
                .ele('GetCapabilities')
                    .ele('Format').txt('application/vnd.ogc.wms_xml').up()
                    .ele('DCPType')
                        .ele('HTTP')
                            .ele('Get')
                                .ele('OnlineResource', { 'xmlns:xlink': 'http://www.w3.org/1999/xlink', 'xlink:href': 'http://localhost:3000/wms' }).up()
                            .up()
                        .up()
                    .up()
                .up()
                .ele('GetMap')
                    .import(wmsFormats())
                    .ele('DCPType')
                        .ele('HTTP')
                            .ele('Get')
                                .ele('OnlineResource', { 'xmlns:xlink': 'http://www.w3.org/1999/xlink', 'xlink:href': 'http://localhost:3000/wms' }).up()
                            .up()
                        .up()
                    .up()
                .up()
            .up()
            .import(wmsLayers())
        .up();

    const xml = caps.root().end({ prettyPrint: true });
    return xml;
}

function getMap(request, reply) {
    if (typeof request.query.LAYERS !== 'string') throw new Error('LAYERS must be a list of string');
    const layers = request.query.LAYERS.split(',');
    fastify.log.debug(`WMS> GetMap ${layers}`);
    let format;
    if (request.query.FORMAT) {
        format = formats.find((x) => x.mime === request.query.FORMAT);
        if (!format) throw new Error(`Unsupported format ${request.query.FORMAT}`);
    } else {
        format = formats[0];
    }
    const width = +(request.query.WIDTH || 512);
    const height = +(request.query.HEIGHT || 512);
    for (const l of core.layers) {
        if (layers.includes(l.name)) {
            const srs = l.srs;
            const mapRequest = new Request(request, l, srs, request.query.BBOX, format, width, height);
            fastify.log.debug(`WMS> serving ${mapRequest.layer}, ${JSON.stringify(mapRequest.bbox)}`);
            return l.handler(mapRequest, new Reply(mapRequest, reply, l));
        }
    }
}

module.exports = {
    main
};
