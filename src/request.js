const gdal = require('gdal-async');

const requestSymbol = Symbol('_request');
const layerSymbol = Symbol('_layer');
class Request {
    constructor(request, layer, srs, _bbox, format, width, height) {
        this[requestSymbol] = request;
        this[layerSymbol] = layer;
        this.srs = srs;
        this.layer = layer.name;
        const bbox = _bbox.split(',');
        this.bbox = new gdal.Envelope({minX: +bbox[0], minY: +bbox[1], maxX: +bbox[2], maxY: +bbox[3]});
        this.format = format;
        this.width = width;
        this.height = height;
    }
}

module.exports = Request;
