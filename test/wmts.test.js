const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const { testRoot, matchPNGtoURL } = require('./libtest');

describe('WMS', () => {
    describe('GetCapabilities', () => {
        it('should return a valid response', () => {
            chai.request('http://localhost:3000')
                .get('/wms?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities')
                .then((data) => {
                    expect(data).to.have.status(200);
                });
        });
    });

    describe('GetMap', () => {
        it('should return native tiles',
            matchPNGtoURL(testRoot, '/wmts/tile/stripes:yellow/PNG/GoogleCRS84Quad/4/8/2.png', 'wmts_googleCRS84quad.png', 256)
        );

        it('should return reprojected tiles',
            matchPNGtoURL(testRoot, '/wmts/tile/stripes:yellow/PNG/GoogleCRS84Quad/4/8/2.png', 'wmts_googleCRS84quad.png', 256)
        );

    });
});