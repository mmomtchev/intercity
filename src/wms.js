'use strict';

const gdal = require('gdal-async');
const { create, fragment } = require('xmlbuilder2');
const semver = require('semver');

const core = require('./core');
const Protocol = require('./protocol');
const Reply = require('./reply');
const Request = require('./request');
const formats = require('./format').formats;
const { getQueryParam, forv } = require('./utils');

const wmsAttrs = {
    '1.1.1': { version: '1.1.1' },
    '1.3.0': {
        version: '1.3.0',
        xmlns: 'http://www.opengis.net/wms',
        'xmlns:sld': 'http://www.opengis.net/sld',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation':
            'http://www.opengis.net/wms http://schemas.opengis.net/wms/1.3.0/capabilities_1_3_0.xsd'
    }
};
class WMS extends Protocol {
    constructor(path, base) {
        super('WMS');
        this.path = path;
        this.base = base;
        this.url = `${base}${path}?`;
        this.defaultVersion = '1.3.0';
    }

    register() {
        core.fastify.get(this.path, this.main.bind(this));
    }

    async main(request, reply) {
        const service = getQueryParam(request.query, 'service', 'WMS');
        if (service.toUpperCase() !== 'WMS')
            throw new Error(`Invalid service ${service}, only WMS supported`);
        let version = getQueryParam(request.query, 'version', this.defaultVersion);
        if (semver.gt(version, '1.3.0'))
            throw new Error(`Invalid service WMS version ${version}, up to 1.3.0 supported`);
        if (semver.lt(version, '1.3.0') && semver.gte(version, '1.1.1')) version = '1.1.1';
        if (semver.lt(version, '1.1.1'))
            throw new Error(
                `Invalid service WMS version ${version}, starting from 1.1.1 supported`
            );
        const wmsRequest = getQueryParam(request.query, 'request');
        switch (wmsRequest) {
            case 'GetCapabilities':
                return this.getCapabilities(version);
            case 'GetMap':
                return this.getMap(request, reply);
            default:
                throw new Error(`Invalid request ${wmsRequest}`);
        }
    }

    wmsLayers() {
        const layers = fragment().ele('Layer');
        for (const l of core.layers) {
            const llbb = l.latlonbbox;
            const bb = l.bbox;
            layers
                .ele('Layer')
                .ele('Name')
                .txt(l.name)
                .up()
                .ele('Title')
                .txt(l.title)
                .up()
                .ele('CRS')
                .txt(`EPSG:${l.epsg}`)
                .up()
                .import(this.wmsSRS(l))
                .ele('LatLonBoundingBox', {
                    minx: bb.minX,
                    miny: bb.minY,
                    maxx: bb.maxX,
                    maxy: bb.maxY
                })
                .up()
                .ele('BoundingBox', {
                    SRS: `EPSG:${l.epsg}`,
                    minx: llbb.minX,
                    miny: llbb.minY,
                    maxx: llbb.maxX,
                    maxy: llbb.maxY
                })
                .up();

            for (const dim of this.wmsDimensions(l)) layers.import(dim);

            layers.up();
        }
        return layers.up();
    }

    wmsFormats() {
        const list = fragment();
        for (const f of formats) {
            list.ele('Format').txt(f.mime);
        }
        return list;
    }

    wmsSRS(layer) {
        const list = fragment();
        for (const srs of core.srs) {
            if (srs.isSame(layer.srs)) continue;
            list.ele('CRS').txt(`EPSG:${srs.getAuthorityCode()}`);
        }
        return list;
    }

    wmsDimensions(layer) {
        if (!layer.dimensions) return [];
        const r = [];
        for (const dimName of Object.keys(layer.dimensions)) {
            const dim = layer.dimensions[dimName];
            const d = fragment().ele('Dimension', {
                name: forv(dim.name),
                units: forv(dim.units),
                unitSymbol: forv(dim.unitSymbol),
                default: forv(dim.default),
                current: dim.current ? '1' : undefined
            });

            let format = (v) => v;
            if (dim.name === 'time') format = (v) => v.toISOString();

            const values = forv(dim.values);
            if (typeof values === 'object' && values instanceof Array)
                d.txt(values.map(format).join(',')).up();
            else d.txt(`${format(values.min)}/${format(values.max)}/${values.res}`).up();
            r.push(d);
        }
        return r;
    }

    getCapabilities(version) {
        let caps = create({ version: '1.0' });
        if (version === '1.1.1')
            caps = caps.dtd({
                sysID: 'http://schemas.opengis.net/wms/1.1.1/WMS_MS_Capabilities.dtd'
            });

        caps.ele('WMT_MS_Capabilities', { ...wmsAttrs[version] })
            .ele('Service')
            .ele('Name')
            .txt('OGC:WMS')
            .up()
            .ele('Title')
            .txt('intercity.js')
            .up()
            .ele('OnlineResource', {
                'xmlns:xlink': 'http://www.w3.org/1999/xlink',
                'xlink:href': this.url
            })
            .up()
            .up()
            .ele('Capability')
            .ele('Request')
            .ele('GetCapabilities')
            .ele('Format')
            .txt('application/vnd.ogc.wms_xml')
            .up()
            .ele('DCPType')
            .ele('HTTP')
            .ele('Get')
            .ele('OnlineResource', {
                'xmlns:xlink': 'http://www.w3.org/1999/xlink',
                'xlink:href': this.url
            })
            .up()
            .up()
            .up()
            .up()
            .up()
            .ele('GetMap')
            .import(this.wmsFormats())
            .ele('DCPType')
            .ele('HTTP')
            .ele('Get')
            .ele('OnlineResource', {
                'xmlns:xlink': 'http://www.w3.org/1999/xlink',
                'xlink:href': this.url
            })
            .up()
            .up()
            .up()
            .up()
            .up()
            .up()
            .import(this.wmsLayers())
            .up();

        const xml = caps.root().end({ prettyPrint: true });
        return xml;
    }

    getMap(request, reply) {
        const layersString = getQueryParam(request.query, 'layers');
        if (typeof layersString !== 'string') throw new Error('LAYERS must be a list of string');
        const layers = layersString.split(',');
        core.fastify.log.debug(`WMS> GetMap ${layers}`);

        let format;
        const queryFormat = getQueryParam(request.query, 'format');
        if (queryFormat) {
            format = formats.find((x) => x.mime === queryFormat);
            if (!format) throw new Error(`Unsupported format ${queryFormat}`);
        } else {
            format = formats[0];
        }

        let srs, querySRS;
        try {
            querySRS = getQueryParam(request.query, 'srs') || getQueryParam(request.query, 'crs');
            srs = gdal.SpatialReference.fromUserInput(querySRS);
        } catch (e) {
            throw new Error(`Invalid spatial reference specified: ${e}`);
        }

        const width = +getQueryParam(request.query, 'width', 512);
        const height = +getQueryParam(request.query, 'height', 512);
        const queryBbox = getQueryParam(request.query, 'bbox');
        if (!queryBbox) throw new Error('"BBOX" is mandatory in WMS"');
        const splitBbox = queryBbox.split(',');
        if (splitBbox.length != 4) throw new Error('"Malformed "BBOX"');
        const bbox = new gdal.Envelope({
            minX: +splitBbox[0],
            minY: +splitBbox[1],
            maxX: +splitBbox[2],
            maxY: +splitBbox[3]
        });

        for (const l of core.layers) {
            if (layers.includes(l.name)) {
                let reqSRS = l.srs;
                if (!srs.isSame(l.srs)) {
                    reqSRS = core.srs.find((x) => srs.isSame(x));
                    if (!reqSRS) throw new Error(`Unsupported CRS ${querySRS}`);
                }

                let dimensions = {};
                if (l.dimensions)
                    for (const dim of Object.keys(l.dimensions)) {
                        const value = getQueryParam(request.query, dim, l.dimensions[dim].default);
                        // TODO: validate the values
                        if (value !== undefined) {
                            if (l.dimensions[dim].values.min !== undefined)
                                dimensions[dim] = parseFloat(value);
                            else dimensions[dim] = value;
                        }
                    }

                const mapRequest = new Request({
                    request,
                    layer: l,
                    srs: reqSRS,
                    bbox,
                    format,
                    width,
                    height,
                    dimensions
                });
                core.fastify.log.debug(
                    `WMS> serving ${mapRequest.layer}, ${JSON.stringify(mapRequest.bbox)}`
                );
                return l.handler(mapRequest, new Reply(mapRequest, reply, l));
            }
        }
    }
}

module.exports = WMS;
