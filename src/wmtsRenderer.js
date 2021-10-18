'use strict';

const core = require('./core');
const Protocol = require('./protocol');
const matrixSets = require('./tilematrix').sets;

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
        const setName = getQueryParam(request.query, 'set');
        const layer = core.layers.find((l) => l.name === layerName);
        const set = matrixSets.find((m) => m.name === setName);

        reply.type('text/html');
        if (!layer || !set) {
            let list = '<html><head><meta charset="utf-8"><title>Intercity.js</title></head><body><ul>';
            for (const layer of core.layers)
                for (const set of matrixSets)
                    if (set.srs.isSame(layer.srs))
                        list += `<li><a href="${this.url}layer=${layer.name}&set=${set.name}">${layer.name}@${set.name} : ${layer.title}</a></li>`;
            list += '</ul></body></html>';
            reply.send(list);
            return;
        }
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
        <title>${layer.title}</title>
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
                    matrixSet: '${set.name}',
                });

                const extent = ol.proj.transformExtent([
                    ${layer.latlonbbox.minX}, ${layer.latlonbbox.minY}, ${layer.latlonbbox.maxX}, ${layer.latlonbbox.maxY}
                ], 'EPSG:4326', 'EPSG:3857');
                map = new ol.Map({
                    layers: [
                        new ol.layer.Tile({
                            source: new ol.source.OSM(),
                            opacity: 0.7,
                        }),
                        new ol.layer.Tile({
                            opacity: 1,
                            source: new ol.source.WMTS(options),
                        })
                    ],
                    target: 'map',
                    view: new ol.View({
                        center: ol.extent.getCenter(extent),
                        zoom: 5
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
