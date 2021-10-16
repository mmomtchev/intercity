'use strict';

class Protocol {
    constructor(name) {
        this.name = name;
    }

    register() {
        throw new Error('Protocol is an abstract class');
    }

    async main() {
        throw new Error('Protocol is an abstract class');
    }
}

module.exports = Protocol;
