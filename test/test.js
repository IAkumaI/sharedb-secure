const {describe, it, before} = require('mocha');
const assert = require('assert');
const async = require('async');
const derby = require('derby');
const options = require('../examples/options');
const sharedbSecure = require('../lib');

function newBackend() {
    let backend = derby.createBackend();
    sharedbSecure(backend, options);

    return backend;
}

describe('checkServerAccess', function () {
    let backend = newBackend();

    it('No check if checkServerAccess is false', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = false;

        async.waterfall(
            [
                (cb) => { // Create
                    model.create('any_collection.someid', {title: 'Title'}, err => {
                        return cb(err);
                    });
                },
                (cb) => { // Read
                    model.fetch('any_collection.someid', err => {
                        if (err) return cb(err);

                        if (!model.get('any_collection.someid')) {
                            return cb(new Error('Can not read any_collection.someid'));
                        }

                        return cb();
                    });
                },
                (cb) => { // Update
                    model.set('any_collection.someid.title', 'New title', err => {
                        if (err) return cb(err);

                        if (model.get('any_collection.someid.title') !== 'New title') {
                            return cb(new Error('Can not update any_collection.someid.title'));
                        }

                        return cb();
                    });
                },
                (cb) => { // Delete
                    model.del('any_collection.someid', err => {
                        return cb(err);
                    });
                },
            ],
            (err) => {
                model.close();
                done(err);
            }
        );
    });

    it('Check access if checkServerAccess is true', function (done) {
        let model = backend.createModel();
        model.create('any_collection.someid', {title: 'Title'}, err => {
            if (err) return done(err);

            model.socket.stream.checkServerAccess = true;

            async.waterfall(
                [
                    (cb) => { // Create
                        model.create('any_collection.somenew', {title: 'Title'}, err => {
                            if (err) {
                                return cb();
                            }

                            return cb(new Error('No check on create undefined collection'));
                        });
                    },
                    (cb) => { // Read
                        model.fetch('any_collection.somenew', err => {
                            if (err) {
                                return cb();
                            }

                            return cb(new Error('No check on read undefined collection'));
                        });
                    },
                    (cb) => { // Update
                        model.set('any_collection.someid.title', 'New title', err => {
                            if (err) {
                                return cb();
                            }

                            return cb(new Error('No check on update undefined collection'));
                        });
                    },
                    (cb) => { // Delete
                        model.del('any_collection.someid', err => {
                            if (err) {
                                return cb();
                            }

                            return cb(new Error('No check on delete undefined collection'));
                        });
                    },
                ],
                (err) => {
                    model.close();
                    done(err);
                }
            );
        });
    });
});

describe('Create access', function () {
    let backend = newBackend();

    let testItem = {
        str_prop: 'some string',
        num_prop: 12345,
        arr_prop: ['a', 'b', 'c'],
        someformat_prop: 'somevalue',
        obj_prop: {obj_key_prop: 'another string'}
    };

    it('Can not create in undefined collection', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;

        model.create('nocollection.id', testItem, err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Can not create without role', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;

        model.create('test.id', testItem, err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Can not create as guest', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'guest';

        model.create('test.id', testItem, err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Can not create additional fields as user', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'user';

        model.create('test.id', testItem, err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Partial create as user', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'user';

        model.create('test.partialitem', {str_prop: 'some string', num_prop: 12345}, err => {
            if (err) return done(err);

            return done();
        });
    });

    it('Full create as admin', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        model.create('test.fullitem', testItem, err => {
            if (err) return done(err);

            return done();
        });
    });

    it('Full create as GOD', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = options.options.godRole;

        model.create('test.fullgoditem', testItem, err => {
            if (err) return done(err);

            return done();
        });
    });

    it('Create call check function', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';
        model.socket.stream.testCheckFunc = true;

        model.create('test.fullitemchecktest', testItem, err => {
            if (err) {
                return done();
            } else {
                return done(new Error('Check function not called'));
            }
        });
    });
});

describe('Read access', function () {
    let backend = newBackend();

    let testItem = {
        str_prop: 'some string',
        num_prop: 12345,
        arr_prop: ['a', 'b', 'c'],
        someformat_prop: 'somevalue',
        obj_prop: {obj_key_prop: 'another string'}
    };

    before(function (done) {
        let model = backend.createModel();

        model.create('test.id', testItem, err => {
            model.close();
            return done(err);
        });
    });

    it('Can not read from undefined collection', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;

        model.fetch('nocollection.id', err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Can not read without role', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;

        model.fetch('test.id', err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Can not read as guest', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'guest';

        model.fetch('test.id', err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Partial read as user', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'user';

        model.fetch('test.id', err => {
            if (err) return done(err);

            let item = model.get('test.id');
            assert.deepStrictEqual({id: testItem.id, str_prop: testItem.str_prop, num_prop: testItem.num_prop}, item);
            return done();
        });
    });

    it('Full read as admin', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        model.fetch('test.id', err => {
            if (err) return done(err);

            let item = model.get('test.id');
            assert.deepStrictEqual(testItem, item);
            return done();
        });
    });

    it('Full read as GOD', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = options.options.godRole;

        model.fetch('test.id', err => {
            if (err) return done(err);

            let item = model.get('test.id');
            assert.deepStrictEqual(testItem, item);
            return done();
        });
    });

    it('Read call check function', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';
        model.socket.stream.testCheckFunc = true;

        model.fetch('test.id', err => {
            if (err) {
                return done();
            } else {
                return done(new Error('Check function not called'));
            }
        });
    });
});

describe('Update access', function () {
    let backend = newBackend();
    let existsModel;

    let testItem = {
        str_prop: 'some string',
        num_prop: 12345,
        arr_prop: ['a', 'b', 'c'],
        someformat_prop: 'somevalue',
        obj_prop: {obj_key_prop: 'another string'}
    };

    before(function (done) {
        existsModel = backend.createModel();

        existsModel.create('test.id', testItem, err => {
            return done(err);
        });
    });

    it('Can not update without role', function (done) {
        existsModel.socket.stream.checkServerAccess = true;

        existsModel.set('test.id.str_prop', 'new string', err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Can not update as guest', function (done) {
        existsModel.socket.stream.checkServerAccess = true;
        existsModel.socket.stream.testRole = 'guest';

        existsModel.set('test.id.str_prop', 'new string', err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Partial update as user', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'user';

        model.fetch('test.id', err => {
            if (err) return done(err);

            model.set('test.id.str_prop', 'new string', err => {
                if (err) return done(err);

                model.set('test.id.obj_prop.obj_key_prop', 'new string', err => {
                    if (err) {
                        return done();
                    }

                    return new Error('Must be an error');
                });
            });
        });
    });

    it('Full update as admin', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        model.fetch('test.id', err => {
            if (err) return done(err);

            model.set('test.id.str_prop', 'new string', err => {
                if (err) return done(err);

                model.set('test.id.obj_prop.obj_key_prop', 'new string', err => {
                    if (err) return done(err);

                    return done();
                });
            });
        });
    });

    it('Full update as GOD', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = options.options.godRole;

        model.fetch('test.id', err => {
            if (err) return done(err);

            model.set('test.id.str_prop', 'new string', err => {
                if (err) return done(err);

                model.set('test.id.obj_prop.obj_key_prop', 'new string', err => {
                    if (err) return done(err);

                    return done();
                });
            });
        });
    });

    it('Update call check function', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        model.fetch('test.id', err => {
            if (err) return done(err);

            model.socket.stream.testCheckFunc = true;

            model.set('test.id.str_prop', 'new string', err => {
                if (err) {
                    return done();
                }

                return new Error('Must be an error');
            });
        });
    });
});

describe('Delete access', function () {
    let backend = newBackend();
    let existsModel;

    let testItem = {
        str_prop: 'some string',
        num_prop: 12345,
        arr_prop: ['a', 'b', 'c'],
        someformat_prop: 'somevalue',
        obj_prop: {obj_key_prop: 'another string'}
    };

    before(function (done) {
        existsModel = backend.createModel();

        existsModel.create('test.id', testItem, err => {
            if (err) return done(err);

            existsModel.create('test.id2', testItem, err => {
                if (err) return done(err);

                existsModel.create('test.id3', testItem, err => {
                    return done(err);
                });
            });
        });
    });

    it('Can not delete without role', function (done) {
        existsModel.socket.stream.checkServerAccess = true;

        existsModel.del('test.id', err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Can not delete as guest', function (done) {
        existsModel.socket.stream.checkServerAccess = true;
        existsModel.socket.stream.testRole = 'guest';

        existsModel.del('test.id', err => {
            if (err) {
                return done();
            }

            return new Error('Must be an error');
        });
    });

    it('Delete as admin', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        model.fetch('test.id', err => {
            if (err) return done(err);

            model.del('test.id', err => {
                if (err) return done(err);

                return done();
            });
        });
    });

    it('Delete as GOD', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = options.options.godRole;

        model.fetch('test.id2', err => {
            if (err) return done(err);

            model.del('test.id2', err => {
                if (err) return done(err);

                return done();
            });
        });
    });

    it('Delete call check function', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        model.fetch('test.id3', err => {
            if (err) return done(err);

            model.socket.stream.testCheckFunc = true;

            model.del('test.id3', err => {
                if (err) {
                    return done();
                }

                return new Error('Must be an error');
            });
        });
    });
});