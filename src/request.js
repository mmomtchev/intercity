const gdal = require('gdal-async');

const requestSymbol = Symbol('_request');
const layerSymbol = Symbol('_layer');
class Request {
    constructor(request, layer, srs, bbox, format, width, height) {
        this[requestSymbol] = request;
        this[layerSymbol] = layer;
        this.srs = srs;
        this.layer = layer.name;
        this.bbox = bbox;
        this.format = format;
        this.width = width;
        this.height = height;
    }
}

module.exports = Request;