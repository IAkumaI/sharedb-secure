const async = require('async');
const ZSchema = require("z-schema");
const _ = require('lodash');
const debug = require('debug')('sharedb-secure');

/**
 * Remove all fields not provided in allowedFields
 * @param doc
 * @param allowedFields
 */
function clearDocFields(doc, allowedFields) {
    if (!allowedFields || allowedFields.length === 0 || allowedFields[0] === '*') {
        return doc;
    }

    for (let field in doc) {
        if (doc.hasOwnProperty(field)) {
            if (allowedFields[0] !== '*' && allowedFields.indexOf(field) === -1) {
                delete doc[field];
            }
        }
    }

    return doc;
}

/**
 * Pretty error messages
 * @param errors
 * @returns {string}
 */
function prettyErrors(errors) {
    let res = [];

    for (let i = 0; i < errors.length; i++) {
        res.push('[' + errors[i].code + '] [' + errors[i].path + '] ' + errors[i].message);
    }

    return res.join('; ');
}

module.exports = function (backend, options) {
    if (options.zschema && options.zschema.formats) {
        for (let format in options.zschema.formats) {
            if (options.zschema.formats.hasOwnProperty(format)) {
                ZSchema.registerFormat(format, options.zschema.formats[format]);
                debug('Format registered', format);
            }
        }
    }

    // Подменяем check: true на каллбеки
    for (let collection in options.collections) {
        if (options.collections.hasOwnProperty(collection)) {
            if (options.collections[collection].roles) {
                for (let role in options.collections[collection].roles) {
                    if (options.collections[collection].roles.hasOwnProperty(role)) {
                        if (options.collections[collection].roles[role].create && options.collections[collection].roles[role].create.check === true) {
                            options.collections[collection].roles[role].create.check = (docId, doc, session, req, next) => next();
                        }

                        if (options.collections[collection].roles[role].read && options.collections[collection].roles[role].read.check === true) {
                            options.collections[collection].roles[role].read.check = (docId, doc, session, req, next) => next();
                        }

                        if (options.collections[collection].roles[role].update && options.collections[collection].roles[role].update.check === true) {
                            options.collections[collection].roles[role].update.check = (docId, oldDoc, newDoc, session, req, next) => next();
                        }

                        if (options.collections[collection].roles[role].delete && options.collections[collection].roles[role].delete.check === true) {
                            options.collections[collection].roles[role].delete.check = (docId, doc, session, req, next) => next();
                        }
                    }
                }
            }
        }
    }

    let validator = new ZSchema((options.zschema && options.zschema.options) || {});

    // Валидация схемы
    for (let collection in options.collections) {
        if (options.collections.hasOwnProperty(collection)) {
            if (!options.collections[collection].schema) {
                throw new Error('Schema for collection ' + collection + ' does not exists');
            }

            if (!validator.validateSchema(options.collections[collection].schema)) {
                throw new Error('Schema for collection ' + collection + ' invalid: ' + prettyErrors(validator.getLastErrors()));
            }
        }
    }

    const GOD_ROLE = options.options.godRole || 'NeVeRrOlE, yeah?';

    // ************************* READ *************************
    backend.use('readSnapshots', (req, next) => {
        let agent = req.agent;

        if (agent.stream.isServer && !agent.stream.checkServerAccess) {
            return next();
        }

        let collectionSchema = options.collections[req.collection];

        if (!collectionSchema || !collectionSchema.getRole) {
            return next('403: Permission denied (read), collection: ' + req.collection);
        }

        if (!req.snapshots || req.snapshots.length === 0) {
            debug('readSnapshots with empty snapshots');
            return next();
        }

        async.each(req.snapshots, function (snapshot, cb) {
            let docId = snapshot.id;
            let doc = snapshot.data;
            let session = agent.connectSession || {};

            if (!docId) {
                debug('readSnapshots with empty snapshot id');
                return cb();
            }

            collectionSchema.getRole(docId, doc, session, req, (err, role) => {
                if (err) return cb(err);

                if (!role) {
                    return cb('403: Permission denied (read, no role), collection: ' + req.collection + ', docId: ' + docId);
                }

                if (role === GOD_ROLE) {
                    return cb();
                }

                let accessHandler = collectionSchema.roles && collectionSchema.roles[role] && collectionSchema.roles[role].read;

                if (!accessHandler || !accessHandler.check) {
                    return cb('403: Permission denied (read, no handler), collection: ' + req.collection + ', docId: ' + docId + ', role: ' + role);
                }

                accessHandler.check(docId, doc, session, req, (err) => {
                    if (err) return cb(err);

                    clearDocFields(doc, accessHandler.fields);

                    return cb();
                });
            });
        }, next);
    });

    backend.use('op', (req, next) => {
        let agent = req.agent;

        if (agent.stream.isServer && !agent.stream.checkServerAccess) {
            return next();
        }

        if (!req.collection || req.op.create || req.op.del) {
            return next();
        }

        if (!req.op || !req.op.op || req.op.op.length === 0) {
            return next();
        }

        if (agent._isOwnOp(req.collection, req.op)) { // Отсекаем op от самого себя
            return next();
        }

        if (!agent.subscribedDocs[req.collection] || !agent.subscribedDocs[req.collection][req.id]) { // Отсекаем op на неподписанные документы
            return next();
        }

        let collectionSchema = options.collections[req.collection];

        if (!collectionSchema || !collectionSchema.getRole) {
            debug('403: Permission denied (read op), collection: ' + req.collection);

            req.op.op = [];
            return next();
        }

        let docId = req.id;
        let session = agent.connectSession || {};

        collectionSchema.getRole(docId, null, session, req, (err, role) => {
            if (err) return next(err);

            if (!role) {
                debug('403: Permission denied (read op, no role), collection: ' + req.collection + ', docId: ' + docId);

                req.op.op = [];
                return next();
            }

            if (role === GOD_ROLE) {
                return next();
            }

            let accessHandler = collectionSchema.roles && collectionSchema.roles[role] && collectionSchema.roles[role].read;

            if (!accessHandler) {
                debug('403: Permission denied (read op, no handler), collection: ' + req.collection + ', docId: ' + docId + ', role: ' + role);

                req.op.op = [];
                return next();
            }

            let allowedFields = accessHandler.fields || [];

            if (allowedFields[0] === '*') {
                return next();
            }

            req.op.op = req.op.op.slice(); // Копируем, чтобы не ломать операции другим клиентам

            // Удаляем операции по изменению одиночного поля (set, etc..)
            let opsIndexToRemove = [];

            for (let i = 0; i < req.op.op.length; i++) {
                if (req.op.op[i].p[0] && allowedFields.indexOf(req.op.op[i].p[0]) === -1) {
                    opsIndexToRemove.push(i);
                }
            }

            for (let i = opsIndexToRemove.length - 1; i >= 0; i--) {
                req.op.op.splice(opsIndexToRemove[i], 1);
            }

            // Удаляем операции по мульти-изменению объектов (setDiff, etc..)
            let mlAllowedFields = allowedFields.slice();
            mlAllowedFields.push('id'); // Разрешаем поле id, т.к. оно системное
            for (let i = 0; i < req.op.op.length; i++) {
                // https://github.com/ottypes/json0#summary-of-operations
                if (req.op.op[i].p.length === 0 && req.op.op[i].od instanceof Object) {
                    clearDocFields(req.op.op[i].od, mlAllowedFields);
                }

                if (req.op.op[i].p.length === 0 && req.op.op[i].oi instanceof Object) {
                    clearDocFields(req.op.op[i].oi, mlAllowedFields);
                }

                if (req.op.op[i].p.length === 0 && req.op.op[i].li instanceof Object) {
                    clearDocFields(req.op.op[i].li, mlAllowedFields);
                }

                if (req.op.op[i].p.length === 0 && req.op.op[i].ld instanceof Object) {
                    clearDocFields(req.op.op[i].ld, mlAllowedFields);
                }
            }

            return next();
        });
    });
    // ***************************************************************************

    backend.use('apply', (req, next) => {
        let agent = req.agent;
        let opData = req.op;

        // Для отслеживания обновлений
        if (req.originalSnapshot === undefined && !opData.create && !opData.del) {
            req.originalSnapshot = _.cloneDeep(req.snapshot);
        }

        if (agent.stream.isServer && !agent.stream.checkServerAccess) {
            return next();
        }

        let collectionSchema = options.collections[req.collection];

        if (!collectionSchema || !collectionSchema.getRole) {
            return next('403: Permission denied (create), collection: ' + req.collection);
        }

        if (opData.create) {
            // ************************* CREATE *************************
            let docId = req.id;
            let doc = opData.create.data;
            let session = agent.connectSession || {};

            collectionSchema.getRole(docId, doc, session, req, (err, role) => {
                if (err) return next(err);

                if (!role) {
                    return next('403: Permission denied (create, no role), collection: ' + req.collection + ', docId: ' + docId);
                }

                if (role === GOD_ROLE) {
                    return next();
                }

                let accessHandler = collectionSchema.roles && collectionSchema.roles[role] && collectionSchema.roles[role].create;

                if (!accessHandler || !accessHandler.check) {
                    return next('403: Permission denied (create, no handler), collection: ' + req.collection + ', docId: ' + docId + ', role: ' + role);
                }

                let allowedFields = accessHandler.fields || [];

                if (allowedFields.length === 0) {
                    return next('403: Permission denied (create, no fields), collection: ' + req.collection + ', docId: ' + docId + ', role: ' + role);
                }

                if (allowedFields[0] !== '*') { // Проверяем добавляемые поля
                    for (let field in doc) {
                        if (doc.hasOwnProperty(field)) {
                            if (allowedFields.indexOf(field) === -1) {
                                return next('403: Permission denied (create, extra field), collection: ' + req.collection + ', docId: ' + docId + ', role: ' + role + ', field: ' + field);
                            }
                        }
                    }
                }

                // Здесь можно добавлять собственные поля в документ
                accessHandler.check(docId, doc, session, req, (err) => {
                    if (err) return next(err);

                    return next();
                });
            });
            // ***************************************************************************

        } else if (opData.del) {
            // ************************* DELETE *************************
            let docId = req.id;
            let doc = req.snapshot.data;
            let session = agent.connectSession || {};

            collectionSchema.getRole(docId, doc, session, req, (err, role) => {
                if (err) return next(err);

                if (!role) {
                    return next('403: Permission denied (delete, no role), collection: ' + req.collection + ', docId: ' + docId);
                }

                if (role === GOD_ROLE) {
                    return next();
                }

                let accessHandler = collectionSchema.roles && collectionSchema.roles[role] && collectionSchema.roles[role].delete;

                if (!accessHandler || !accessHandler.check) {
                    return next('403: Permission denied (delete, no handler), collection: ' + req.collection + ', docId: ' + docId + ', role: ' + role);
                }

                accessHandler.check(docId, doc, session, req, (err) => {
                    if (err) return next(err);

                    return next();
                });
            });
            // ***************************************************************************
        } else {
            return next();
        }
    });

    // Проверка схемы при создании
    backend.use('apply', (req, next) => {
        let agent = req.agent;
        let opData = req.op;

        if (!opData.create) {
            return next();
        }

        let collectionSchema = options.collections[req.collection];

        if (!collectionSchema) {
            return next('403: No collectionSchema for collection: ' + req.collection);
        }

        let docId = req.id;
        let doc = opData.create.data;
        let session = agent.connectSession || {};

        if (!validator.validate(doc, collectionSchema.schema)) {
            let errors = validator.getLastErrors();
            let error = new Error('Validation failed (create) ' + prettyErrors(errors));
            error.errors = errors;
            return next(error);
        }

        if (collectionSchema.validators && collectionSchema.validators.create) {
            collectionSchema.validators.create(docId, doc, session, req, (err) => {
                if (err) return next(err);

                return next();
            });
        } else {
            return next();
        }
    });

    // ************************* UPDATE *************************
    backend.use('commit', (req, next) => {
        let agent = req.agent;
        let opData = req.op;

        if (agent.stream.isServer && !agent.stream.checkServerAccess) {
            return next();
        }

        if (opData.create || opData.del) {
            return next();
        }

        let collectionSchema = options.collections[req.collection];

        if (!collectionSchema || !collectionSchema.getRole) {
            return next('403: Permission denied (update), collection: ' + req.collection);
        }

        let session = agent.connectSession || {};
        let docId = req.id;
        let oldDoc = (req.originalSnapshot && req.originalSnapshot.data) || {};
        let newDoc = req.snapshot.data;

        collectionSchema.getRole(docId, oldDoc, session, req, (err, role) => {
            if (err) return next(err);

            if (!role) {
                return next('403: Permission denied (update, no role), collection: ' + req.collection + ', docId: ' + docId);
            }

            if (role === GOD_ROLE) {
                return next();
            }

            let accessHandler = collectionSchema.roles && collectionSchema.roles[role] && collectionSchema.roles[role].update;

            if (!accessHandler || !accessHandler.check) {
                return next('403: Permission denied (update, no handler), collection: ' + req.collection + ', docId: ' + docId + ', role: ' + role);
            }

            let allowedFields = accessHandler.fields || [];

            if (allowedFields.length === 0) {
                return next('403: Permission denied (update, no fields), collection: ' + req.collection + ', docId: ' + docId + ', role: ' + role);
            }

            if (allowedFields[0] !== '*') { // Проверяем редактируемые поля
                let mlAllowedFields = allowedFields.slice();
                mlAllowedFields.push('id'); // Разрешаем поле id, т.к. оно системное


                for (let i = 0; i < req.op.op.length; i++) {
                    // Операции по изменению одиночного поля (set, etc..)
                    if (req.op.op[i].p[0] && allowedFields.indexOf(req.op.op[i].p[0]) === -1) {
                        return next('403: Permission denied (update, op), collection: ' + req.collection + ', docId: ' + docId + ', role: ' + role + ', field: ' + req.op.op[i].p[0]);
                    }

                    // Операции по мульти-изменению объектов (setDiff, etc..)
                    if (req.op.op[i].p.length === 0 && req.op.op[i].oi instanceof Object) { // "Новые" данные
                        for (let k in req.op.op[i].oi) {
                            if (req.op.op[i].oi.hasOwnProperty(k) && mlAllowedFields.indexOf(k) === -1) {
                                return next('403: Permission denied (update, op), collection: ' + req.collection + ', docId: ' + docId + ', role: ' + role + ', field: ' + k);
                            }
                        }
                    }
                }
            }

            // Здесь можно добавлять собственные поля в документ
            accessHandler.check(docId, oldDoc, newDoc, session, req, err => {
                if (err) return next(err);

                return next();
            });
        });
    });

    // Проверка схемы при обновлении
    backend.use('commit', (req, next) => {
        let agent = req.agent;
        let opData = req.op;

        if (opData.create || opData.del) {
            return next();
        }

        let collectionSchema = options.collections[req.collection];

        if (!collectionSchema) {
            return next('403: No collectionSchema for collection: ' + req.collection);
        }

        let session = agent.connectSession || {};
        let docId = req.id;
        let oldDoc = (req.originalSnapshot && req.originalSnapshot.data) || {};
        let newDoc = req.snapshot.data;

        if (!validator.validate(newDoc, collectionSchema.schema)) {
            let errors = validator.getLastErrors();
            let error = new Error('Validation failed (update) ' + prettyErrors(errors));
            error.errors = errors;
            return next(error);
        }

        if (collectionSchema.validators && collectionSchema.validators.update) {
            collectionSchema.validators.update(docId, oldDoc, newDoc, session, req, (err) => {
                if (err) return next(err);

                return next();
            });
        } else {
            return next();
        }
    });
    // ***************************************************************************
};