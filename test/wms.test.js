const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const { testRoot, matchPNGtoURL, projBox } = require('./libtest');

describe('WMS', () => {
    describe('GetCapabilities', () => { 
        it('should return a valid response', () => {
            chai.request('http://localhost:3000')
                .get('/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities')
                .then((data) => {
                    expect(data).to.have.status(200);
                });
        });
    });

    describe('GetMap', () => {
        it('should support a default request',
            matchPNGtoURL(testRoot,
                '/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=stripes%3Ayellow&SRS=EPSG:4326&format=image/png&BBOX=-1,45,1,43',
                'wms_default.png', 512)
        );

        it('should support width & height', () =>
            matchPNGtoURL(testRoot,
                '/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=stripes%3Ayellow&SRS=EPSG:4326&format=image/png&BBOX=-1,45,1,43&width=256&height=256',
                'wms_tilesize.png', 256)
        );

        const bbox3857 = projBox('EPSG:4326', 'EPSG:3857', [ -1, 45, 1, 43 ]).join(',');
        it('should support reprojection',
            matchPNGtoURL(testRoot,
                `/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=stripes%3Ayellow&SRS=EPSG:3857&format=image/png&BBOX=${bbox3857}`,
                'wms_3857.png', 512)
        );
    });
});