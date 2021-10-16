'use strict';

const { create, fragment } = require('xmlbuilder2');
const semver = require('semver');

const core = require('./core');
const Protocol = require('./protocol');
const Reply = require('./reply');
const Request = require('./request');
const formats = require('./format').formats;
const matrixSets = require('./tilematrix').sets;
const { getQueryParam } = require('./utils');

class WMTS extends Protocol {
    constructor(path, base) {
        super('WMTS');
        this.path = path;
        this.base = base;
        this.url = `${base}${path}`;
    }

    register() {
        core.fastify.get(this.path, this.main.bind(this));
        core.fastify.get(`${this.path}/tile/:layer/:format/:set/:zoom/:col/:row(^\\d+).png`, this.getTile.bind(this));
    }

    async main(request, reply) {
        const service = getQueryParam(request.query, 'service', 'WMTS');
        if (service !== 'WMTS')
            throw new Error(`Invalid service ${service}, only WMTS supported`);
        let version = getQueryParam(request.query, 'version', '1.0.0');
        if (semver.gt(version, '1.0.0'))
            throw new Error(`Invalid service WMTS version ${version}, up to 1.0.0 supported`);
        if (semver.lt(version, '1.0.0'))
            throw new Error(`Invalid service WMTS version ${version}, starting from 1.0.0 supported`);
        const wmtsRequest = getQueryParam(request.query, 'request');
        switch (wmtsRequest) {
            case 'GetCapabilities':
                return this.getCapabilities(version);
            case 'GetTile':
                return this.getTile(request, reply);
            default:
                throw new Error(`Invalid request ${wmtsRequest}`);
        }
    }

    layers() {
        const layers = fragment();
        for (const l of core.layers) {
            const llbb = l.latlonbbox;
            layers
                .ele('Layer')
                    .ele('ows:Title').txt(l.title).up()
                    .ele('ows:Identifier').txt(l.name).up()
                    .ele('ows:WGS84BoundingBox')
                        .ele('ows:LowerCorner').txt(`${llbb.minX} ${llbb.minY}`).up()
                        .ele('ows:UpperCorner').txt(`${llbb.maxX} ${llbb.maxY}`).up()
                    .up()
                    .ele('Style')
                        .ele('ows:Title').txt(l.title).up()
                        .ele('ows:Identifier').txt(l.name).up()
                    .up()
                    .import(this.formats())
                    .import(this.tileMatrixLinks(l))
                    .import(this.urls(l))
                .up();
        }
        return layers;
    }

    formats() {
        const list = fragment();
        for (const f of formats) {
            list.ele('Format').txt(f.mime);
        }
        return list;
    }

    urls(layer) {
        const urls = fragment();
        for (const f of formats) {
            urls.ele('ResourceURL', {
                format: f.mime,
                resourceType: 'tile',
                template: `${this.url}/tile/${layer.name}/${f.name}/{TileMatrixSet}/{TileMatrix}/{TileCol}/{TileRow}.${f.ext}`
            });
        }
        return urls; 
    }

    tileMatrixLinks(layer) {
        const links = fragment();
        for (const m of matrixSets) {
            if (m.srs.isSame(layer.srs))
                links.ele('TileMatrixSetLink')
                    .ele('TileMatrixSet').txt(m.name).up();
        }
        return links;
    }

    tileMatrixSets() {
        const tileMatrixRoot = fragment();
        for (const m of matrixSets) {
            const tileMatrixSet = tileMatrixRoot.ele('TileMatrixSet');
            tileMatrixSet
                .ele('ows:Identifier').txt(m.name).up()
                .ele('ows:Title').txt(m.name).up()
                .ele('ows:SupportedCRS').txt(m.crs).up();
            if (m.urn) tileMatrixSet.ele('WellKnownScaleSet').txt(m.urn);
            for (const si in m.scales) {
                const s = m.scales[si];
                const l = m.levels[si];
                tileMatrixSet.ele('TileMatrix')
                    .ele('ows:Identifier').txt(si).up()
                    .ele('ScaleDenominator').txt(s).up()
                    .ele('TopLeftCorner').txt(m.orderedCoords([m.ul.x, m.ul.y]).join(' ')).up()
                    .ele('TileWidth').txt('256').up()
                    .ele('TileHeight').txt('256').up()
                    .ele('MatrixWidth').txt(l.matrixWidth).up()
                    .ele('MatrixHeight').txt(l.matrixHeight).up();
            }
        }
        return tileMatrixRoot;
    }

    getCapabilities() {
        let caps = create({ version: '1.0' }).ele('Capabilities', {
            'xmlns' :'http://www.opengis.net/wmts/1.0',
            'xmlns:ows': 'http://www.opengis.net/ows/1.1',
            'xmlns:xlink': 'http://www.w3.org/1999/xlink',
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xmlns:gml': 'http://www.opengis.net/gml',
            'xsi:schemaLocation': 'http://www.opengis.net/wmts/1.0 ' +
                'http://schemas.opengis.net/wmts/1.0/wmtsGetCapabilities_response.xsd',
            'version': '1.0.0'
        });

        caps.ele('ows:ServiceIdentification')
            .ele('ows:Title').txt('intercity').up()
            .ele('ows:Abstract').txt('-').up()
            .ele('ows:ServiceType').txt('OGC WMTS').up()
            .ele('ows:ServiceTypeVersion').txt('1.0.0').up();

        caps.ele('ows:ServiceProvider').up();

        caps.ele('ows:OperationsMetadata')
            .ele('ows:Operation', { name: 'GetCapabilities' } )
                .ele('ows:DCP')
                    .ele('ows:HTTP')
                        .ele('ows:Get', { 'xmlns:xlink': 'http://www.w3.org/1999/xlink', 'xlink:href': this.url })
                            .ele('ows:Constraint', { name: 'GetEncoding' })
                                .ele('ows:AllowedValues')
                                    .ele('ows:Value').txt('REST').up()
                                .up()
                            .up()
                        .up()
                    .up()
                .up()
            .up()
            .ele('ows:Operation', { name: 'GetTile' } )
                .ele('ows:DCP')
                    .ele('ows:HTTP')
                        .ele('ows:Get', { 'xmlns:xlink': 'http://www.w3.org/1999/xlink', 'xlink:href': this.url })
                            .ele('ows:Constraint', { name: 'GetEncoding' })
                                .ele('ows:AllowedValues')
                                    .ele('ows:Value').txt('REST').up()
                                .up()
                            .up()
                        .up()
                    .up()
                .up()
            .up()
        .up();

        caps.ele('Contents')
            .import(this.layers())
            .import(this.tileMatrixSets());

        const xml = caps.root().end({ prettyPrint: true });
        return xml;
    }

    getTile(request, reply) {
        const layer = request.params.layer;
        if (typeof layer !== 'string') throw new Error('layer must be a string');
        core.fastify.log.debug(`WMTS> GetTile ${layer}`);
        const format = formats.find((x) => x.name === request.params.format);
        if (!format) throw new Error(`Unsupported format ${request.params.format}`);
        const set = matrixSets.find((x) => x.name === request.params.set);
        if (!set) throw new Error(`Unsupported matrix set ${request.params.set}`);
        const width = 256;
        const height = 256;
        for (const l of core.layers) {
            if (l.name === layer) {
                const bbox = set.tileEnvelope(+request.params.zoom, +request.params.col, +request.params.row);
                const mapRequest = new Request(request, l, set.srs, bbox, format, width, height);
                core.fastify.log.debug(`WMTS> serving ${mapRequest.layer}, ${JSON.stringify(mapRequest.bbox)}`);
                return l.handler(mapRequest, new Reply(mapRequest, reply, l));
            }
        }
    }
}

module.exports = WMTS;
