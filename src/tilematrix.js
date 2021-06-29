const gdal = require('gdal-async');

const core = require('./core');

const equator = 40075016.6855680;

class TileMatrix {
    constructor(name, scales, urn, crs, bbox) {
        this.name = name;
        this.scales = scales;
        this.urn = urn;
        this.crs = crs;
        this.bbox = bbox;
        this.srs = gdal.SpatialReference.fromURN(this.crs);
        this.xform = new gdal.CoordinateTransformation(core.wgs84, this.srs);
        this.ul = { x: bbox.minX, y: bbox.maxY };
        this.lr = { x: bbox.maxX, y: bbox.minY };
        this.levels = [];
        const spanX = bbox.maxX - bbox.minX;
        const spanY = bbox.maxY - bbox.minY;
        for (const si in this.scales) {
            // scaleDenominator is the geographic scale in projected meters
            const s = this.scales[si];
            // pixelSize is the pixel size in SRS coordinates
            const pixelSize = (s * 28e-5) / (equator / spanX);
            const matrixWidth = Math.round(spanX / pixelSize / 256);
            const matrixHeight = Math.round(spanY / pixelSize / 256);
            this.levels[si] = {
                pixelSize, matrixWidth, matrixHeight
            };
        }
    }

    tileEnvelope(zoom, col, row) {
        const level = this.levels[zoom];
        return new gdal.Envelope({
            minX: col * level.pixelSize,
            minY: row * level.pixelSize,
            maxX: (col+1) * level.pixelSize,
            maxY: (row+1) * level.pixelSize
        });
    }
};

const sets = [];

module.exports = {
    equator,
    TileMatrix,
    sets
};
