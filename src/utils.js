'use strict';

function getQueryParam(query, param, def) {
    const key = Object.keys(query).find(key => key.toLowerCase() === param.toLowerCase());
    if (key) return query[key];
    return def;
}

module.exports = {
    getQueryParam
};
