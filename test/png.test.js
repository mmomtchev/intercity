const chai = require('chai');
const chaiHttp = require('chai-http');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { matchPNGtoURL } = require('./libtest');

const urlWMTS = '/wmts/tile/stripes:transparent/PNG/GoogleCRS84Quad/4/8/2.png';
const urlWMS =
    '/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=stripes%3Atransparent&format=image/png&SRS=EPSG:4326&BBOX=-1,43,1,45';

describe('PNG', () => {
    it('should transparency in WMS', matchPNGtoURL(urlWMS, 'png_wms_alpha.png', 512));
    it('should transparency in WMTS', matchPNGtoURL(urlWMTS, 'png_wmts_alpha.png', 256));
});
