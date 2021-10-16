const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const gdal = require('gdal-async');

const {testRoot, matchPNGtoURL, matchPNGtoDS, projBox} = require('./libtest');

describe('WMS', () => {
    const wmsService = '/wms?SERVICE=WMS&VERSION=1.1.1';
    const wmsServiceCaps = wmsService + '&REQUEST=GetCapabilities';
    const wmsServiceGetMap = wmsService + '&REQUEST=GetMap';
    const layerYellowStripes = wmsServiceGetMap + '&LAYERS=stripes%3Ayellow';
    const layerYellowStripesPNG = layerYellowStripes + '&format=image/png';

    describe('GetCapabilities', () => {
        it('should return a valid response', () =>
            chai
                .request(testRoot)
                .get(wmsServiceCaps)
                .then((data) => {
                    expect(data).to.have.status(200);
                }));
    });

    describe('GetMap', () => {
        it(
            'should support a default request',
            matchPNGtoURL(
                testRoot,
                layerYellowStripesPNG + '&SRS=EPSG:4326&BBOX=-1,43,1,45',
                'wms_default.png',
                512
            )
        );

        it('should support width & height', () =>
            matchPNGtoURL(
                testRoot,
                layerYellowStripesPNG + '&SRS=EPSG:4326&BBOX=-1,43,1,45&width=256&height=256',
                'wms_tilesize.png',
                256
            ));

        const bbox3857 = projBox('EPSG:4326', 'EPSG:3857', [-1, 43, 1, 45]).join(',');
        it(
            'should support reprojection',
            matchPNGtoURL(
                testRoot,
                layerYellowStripesPNG + `&SRS=EPSG:3857&BBOX=${bbox3857}`,
                'wms_3857.png',
                512
            )
        );
    });

    describe('[Full GDAL tests]', () => {
        let wms;

        before(() => {
            gdal.config.set('GDAL_ENABLE_WMS_CACHE', 'NO');
            wms = gdal.drivers.get('WMS');
        });
        describe('gdalinfo', () => {
            it('should open the root URL and report the subdatasets', () => {
                // All GDAL calls that call the backend must be async
                // mocha and the backend are running in the same V8 isolate
                return wms.openAsync(testRoot + wmsServiceCaps).then((ds) => {
                    const info = JSON.parse(gdal.info(ds, ['-json']));
                    expect(info.driverShortName).to.equal('WMS');
                    expect(info.metadata.SUBDATASETS.SUBDATASET_1_NAME).to.include(
                        `WMS:${testRoot}/wms`
                    );
                });
            });

            it('should open the root URL and report valid subdatasets', () => {
                return wms.openAsync(testRoot + wmsServiceCaps).then((ds) => {
                    const info = JSON.parse(gdal.info(ds, ['-json']));
                    expect(info.driverShortName).equal('WMS');
                    expect(info.metadata.SUBDATASETS.SUBDATASET_1_NAME).to.include(
                        `WMS:${testRoot}/wms`
                    );
                    const subName = Object.keys(info.metadata.SUBDATASETS).find((sub) =>
                        info.metadata.SUBDATASETS[sub].match('LAYERS=stripes%3Ayellow')
                    );
                    const subDs = wms.openAsync(info.metadata.SUBDATASETS[subName]);
                    return subDs.then((ds) => {
                        expect(ds).to.instanceOf(gdal.Dataset);
                        expect(ds.geoTransform[0]).to.approximately(-8, 1e-6);
                    });
                });
            });

            it('should open a subdataset URL and report the metadata', () => {
                return wms.openAsync(testRoot + layerYellowStripes).then((ds) => {
                    const info = JSON.parse(gdal.info(ds, ['-json']));
                    expect(info.driverShortName).equal('WMS');
                    expect(info.metadata.IMAGE_STRUCTURE.INTERLEAVE).to.equal('PIXEL');
                });
            });
        });

        describe('gdal_translate', () => {
            const filename = '/vsimem/WMS_default_translate.png';
            it('should produce identical results to a direct HTTP call w/png', () =>
                wms
                    .openAsync(testRoot + layerYellowStripesPNG)
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
            it('should produce (almost) identical results to a direct HTTP call w/jpeg', () =>
                wms
                    .openAsync(testRoot + layerYellowStripes + '&format=image/jpeg')
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
                            .then((ds) => matchPNGtoDS(ds, 'wms_default.png', 2000))
                    ));
        });
    });
});
