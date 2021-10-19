'use strict';

function getQueryParam(query, param, def) {
    const key = Object.keys(query).find((key) => key.toLowerCase() === param.toLowerCase());
    if (key) return query[key];
    return def;
}

function forv(v) {
    if (typeof v === 'function') return v();
    return v;
}

module.exports = {
    getQueryParam,
    forv
};
