module.exports = {
    collections: {
        test: {
            schema: {
                type: 'object',
                properties: {
                    str_prop: {
                        type: 'string',
                        minLength: 5,
                    },
                    num_prop: {
                        type: 'number',
                    },
                    arr_prop: {
                        type: 'array',
                        items: {
                            type: 'string',
                        }
                    },
                    someformat_prop: {
                        type: 'string',
                        format: 'someformat',
                    },
                    obj_prop: {
                        type: 'object',
                        properties: {
                            obj_key_prop: {
                                type: 'string',
                            },
                        },
                    },
                },
                required: ['str_prop'],
            },

            getRole: function (docId, doc, session, req, next) {
                next(null, req.agent.stream.testRole || 'guest');
            },

            roles: {
                admin: {
                    create: {
                        fields: ['*'],
                        check: function (docId, doc, session, req, next) {
                            if (req.agent.stream.testCheckFunc) {
                                return next('Test error');
                            }

                            return next();
                        },
                    },
                    read: {
                        fields: ['*'],
                        check: function (docId, doc, session, req, next) {
                            if (req.agent.stream.testCheckFunc) {
                                return next('Test error');
                            }

                            return next();
                        },
                    },
                    update: {
                        fields: ['*'],
                        check: function (docId, oldDoc, newDoc, session, req, next) {
                            if (req.agent.stream.testCheckFunc) {
                                return next('Test error');
                            }

                            return next();
                        },
                    },
                    delete: {
                        check: function (docId, doc, session, req, next) {
                            if (req.agent.stream.testCheckFunc) {
                                return next('Test error');
                            }

                            return next();
                        },
                    },
                },
                user: {
                    create: {
                        fields: ['str_prop', 'num_prop'],
                        check: true,
                    },
                    read: {
                        fields: ['str_prop', 'num_prop'],
                        check: true,
                    },
                    update: {
                        fields: ['str_prop', 'num_prop'],
                        check: true,
                    },
                    delete: {
                        check: true,
                    },
                },
            },
        }
    },

    options: {
        godRole: 'GOD_ROLE',
    },

    zschema: {
        options: {
            noExtraKeywords: true,
            assumeAdditional: true,
            forceProperties: true,
            forceItems: true,
        },

        formats: {
            someformat: function (str) {
                if (typeof str !== "string") {
                    return true;
                }
                return str === 'somevalue';
            },
        }
    }
};