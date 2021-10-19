const moment = require('moment');
const forv = require('./utils').forv;

class Dimension {
    constructor(name, opts) {
        if (!name || typeof name !== 'string') throw new Error('Dimension name is mandatory');
        this.name = name;
        this.title = opts.title;
        this.units = opts.units;
        this.unitSymbol = opts.unitSymbol;
        this.default = opts.default;

        let validate = (v, minmax) => {
            if (minmax && isNaN(parseFloat(v))) throw new Error(`Failed parsing ${v} as a number`);
        };

        if (name === 'time') {
            this.units = 'ISO8601';
            this.unitSymbol = undefined;
            this.current = opts.current;
            validate = (v, _, res) => {
                if (!res && !(v instanceof Date))
                    throw new Error('Time values must be Date objects');
                if (res && !moment.isDuration(moment.duration(res)))
                    throw new Error('Time resolution must be an ISO8601 period string');
            };
        }

        const values = forv(opts.values);
        if (typeof values !== 'object')
            throw new Error(
                'Dimension values must be either an array or an object with min, max and res properties'
            );
        if (values instanceof Array) {
            values.map((v) => validate(v));
        } else if (
            values.min !== undefined &&
            values.max !== undefined &&
            values.res !== undefined
        ) {
            validate(values.min, true);
            validate(values.max, true);
            validate(values.res, true, true);
        } else
            throw new Error(
                'Dimension values must be either an array or an object with min, max and res properties'
            );

        this.values = opts.values;
    }
}

module.exports = Dimension;
