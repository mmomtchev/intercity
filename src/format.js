class Format {
    constructor(name, mime) {
        this.name = name;
        this.mime = mime;
    }

    produce(ds) {
        throw new Error('Format is an abstract class');
    }
};

const formats = [];

module.exports = {
    Format,
    formats
};
