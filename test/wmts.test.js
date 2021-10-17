const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const gdal = require('gdal-async');

const {testRoot, matchPNGtoURL, matchPNGtoDS} = require('./libtest');

describe('WMTS', () => {
    const wmtsService = '/wmts?SERVICE=WMTS&VERSION=1.0.0';
    const wmtsServiceCaps = wmtsService + '&REQUEST=GetCapabilities';
    const layerYellowStripes = wmtsServiceCaps + ',layer=stripes:yellow';

    describe('GetCapabilities', () => {
        it('should return a valid response', () =>
            chai
                .request(testRoot)
                .get(wmtsServiceCaps)
                .then((data) => {
                    expect(data).to.have.status(200);
                }));
    });

    describe('GetMap', () => {
        it(
            'should return native tiles',
            matchPNGtoURL(
                testRoot,
                '/wmts/tile/stripes:yellow/PNG/GoogleCRS84Quad/4/8/2.png',
                'wmts_googleCRS84quad.png',
                256
            )
        );
    });

    describe('[Full GDAL tests]', () => {
        let wmts;

        before(() => {
            gdal.config.set('GDAL_ENABLE_WMS_CACHE', 'NO');
            wmts = gdal.drivers.get('WMTS');
        });
        describe('gdalinfo', () => {
            it('should open the root URL and report the subdatasets', () => {
                // All GDAL calls that call the backend must be async
                // mocha and the backend are running in the same V8 isolate
                return wmts.openAsync('WMTS:' + testRoot + wmtsServiceCaps).then((ds) => {
                    const info = JSON.parse(gdal.info(ds, ['-json']));
                    expect(info.driverShortName).to.equal('WMTS');
                    expect(info.metadata.SUBDATASETS.SUBDATASET_1_NAME).to.include(
                        `WMTS:${testRoot}/wmts`
                    );
                });
            });

            it('should open the root URL and report valid subdatasets', () => {
                return wmts.openAsync('WMTS:' + testRoot + wmtsServiceCaps).then((ds) => {
                    const info = JSON.parse(gdal.info(ds, ['-json']));
                    expect(info.driverShortName).equal('WMTS');
                    expect(info.metadata.SUBDATASETS.SUBDATASET_1_NAME).to.include(
                        `WMTS:${testRoot}/wmts`
                    );
                    const subName = Object.keys(info.metadata.SUBDATASETS).find((sub) =>
                        info.metadata.SUBDATASETS[sub].match('layer=stripes:yellow')
                    );
                    const subDs = wmts.openAsync(info.metadata.SUBDATASETS[subName]);
                    return subDs.then((ds) => {
                        expect(ds).to.instanceOf(gdal.Dataset);
                        expect(ds.geoTransform[0]).to.approximately(-8, 1e-5);
                    });
                });
            });

            it('should open a subdataset URL and report the metadata', () => {
                return wmts.openAsync('WMTS:' + testRoot + layerYellowStripes).then((ds) => {
                    const info = JSON.parse(gdal.info(ds, ['-json']));
                    expect(info.driverShortName).equal('WMTS');
                    expect(info.metadata.IMAGE_STRUCTURE.INTERLEAVE).to.equal('PIXEL');
                });
            });
        });

        describe('gdal_translate', () => {
            const filename = '/vsimem/WMTS_default_translate.png';
            it('should produce results identical to WMS', () =>
                wmts
                    .openAsync('WMTS:' + testRoot + layerYellowStripes)
                    .then((ds) =>
                        gdal
                            .translateAsync(filename, ds, [
                                '-outsize',
                                '512',
                                '512',
                                '-projwin',
                                '-1',
                                '45',
                                '1',
                                '43'
                            ])
                            .then((ds) => matchPNGtoDS(ds, 'wms_default.png', 0))
                    ));
        });
    });

    describe('[Built-in renderer]', () => {
        it('should return a valid response', () =>
            chai
                .request(testRoot)
                .get('/wmtsRender?layer=stripes:yellow')
                .then((data) => {
                    expect(data).to.have.status(200);
                }));
    });
});
