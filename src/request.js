'use strict';

const requestSymbol = Symbol('_request');
const layerSymbol = Symbol('_layer');
class Request {
    constructor({ request, layer, srs, bbox, format, width, height, dimensions }) {
        this[requestSymbol] = request;
        this[layerSymbol] = layer;
        this.srs = srs;
        this.layer = layer.name;
        this.bbox = bbox;
        this.format = format;
        this.width = width;
        this.height = height;
        this.dimensions = dimensions;
    }
}

module.exports = Request;
