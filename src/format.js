'use strict';
class Format {
    constructor(name, mime, ext) {
        this.name = name;
        this.mime = mime;
        this.ext = ext;
    }

    produce() {
        throw new Error('Format is an abstract class');
    }
}

const formats = [];

module.exports = {
    Format,
    formats
};
