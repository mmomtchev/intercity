'use strict';

const core = require('./core');
const Protocol = require('./protocol');

const { getQueryParam } = require('./utils');

class wmtsRenderer extends Protocol {
    constructor(path, base, opts) {
        super('wmtsRender');
        this.path = path;
        this.base = base;
        this.url = `${base}${path}?`;
        this.target = opts.target;
    }

    register() {
        core.fastify.get(this.path, this.main.bind(this));
    }

    async main(request, reply) {
        const layerName = getQueryParam(request.query, 'layer');
        const layer = core.layers.find((l) => l.name === layerName);

        reply.type('text/html');
        reply.send(
            `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/openlayers/openlayers.github.io@master/en/v6.9.0/css/ol.css" type="text/css">
    <style>
      .map {
        height: 80vh;
        width: 100%;
      }
    </style>
    <script src="https://cdn.jsdelivr.net/gh/openlayers/openlayers.github.io@master/en/v6.9.0/build/ol.js"></script>
    <title>OpenLayers example</title>
  </head>
  <body>
    <h2>${layer.title}</h2>
    <div id="map" class="map"></div>
    <script type="text/javascript">
        fetch('${this.target}?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities')
        .then(function (response) {
            return response.text();
        })
        .then(function (text) {
            const result = (new ol.format.WMTSCapabilities()).read(text);
            const options = ol.source.WMTS.optionsFromCapabilities(result, {
                layer: '${layer.name}',
                matrixSet: 'GoogleCRS84Quad',
            });

            map = new ol.Map({
                layers: [
                    new ol.layer.Tile({
                        source: new ol.source.OSM(),
                        opacity: 0.7,
                    }),
                    new ol.layer.Tile({
                        opacity: 1,
                        source: new ol.source.WMTS(options),
                    }),
                ],
                target: 'map',
                view: new ol.View({
                    center: [40, 0],
                    zoom: 5,
                })
            });
        });
    </script>
  </body>
</html>
`
        );
    }
}

module.exports = wmtsRenderer;
