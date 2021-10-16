const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const fs = require('fs');
const path = require('path');
const gdal = require('gdal-async');
const {PNG} = require('pngjs');
const pixelmatch = require('pixelmatch');
const proj4 = require('proj4');

const testPort = 8998;

function matchPNGtoURL(base, url, png, size) {
    return () =>
        chai
            .request(base)
            .get(url)
            .then((data) => {
                expect(data).to.have.status(200);
                const actual = PNG.sync.read(data.body);
                expect(actual.width).to.equal(size);
                expect(actual.height).to.equal(size);
                const expected = PNG.sync.read(fs.readFileSync(path.join(__dirname, 'data', png)));
                expect(pixelmatch(actual.data, expected.data, null, size, size)).to.equal(0);
            });
}

function matchPNGtoDS(ds, png, fuzzyness) {
    const vsifile = ds.description;
    const size = ds.rasterSize.x;
    ds.close();
    const data = gdal.vsimem.release(vsifile);
    const actual = PNG.sync.read(data);
    const expected = PNG.sync.read(fs.readFileSync(path.join(__dirname, 'data', png)));
    expect(pixelmatch(actual.data, expected.data, null, size, size)).to.below(fuzzyness);
}

function projBox(sproj, tproj, coords) {
    if (coords.length != 4) throw new Error('A bbox must have 4 coordinates');
    return proj4(sproj, tproj, coords.slice(0, 2)).concat(proj4(sproj, tproj, coords.slice(2, 4)));
}

module.exports = {
    matchPNGtoURL,
    matchPNGtoDS,
    projBox,
    testRoot: `http://localhost:${testPort}`,
    testPort
};
