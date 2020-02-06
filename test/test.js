const {describe, it, before} = require('mocha');
const {expect} = require('chai');
const assert = require('assert');
const async = require('async');
const derby = require('derby');
const ShareDBMingo = require('sharedb-mingo-memory');
const options = require('../examples/options');
const sharedbSecure = require('../lib');
const Utils = require('../lib/utils');

function newBackend() {
    let backend = derby.createBackend({db: new ShareDBMingo()});
    sharedbSecure(backend, options);

    return backend;
}

describe('Schema validation', function () {
    let backend = newBackend();

    it('Schema validation when checkServerAccess false', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = false;
        model.create('test.someid', {title: 'Title'}, err => {
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Schema validation when checkServerAccess true', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.create('test.someid', {title: 'Title'}, err => {
            expect(err).to.be.an('error');
            return done();
        });
    });
});

describe('checkServerAccess', function () {
    let backend = newBackend();

    it('checkServerAccess is false', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = false;

        async.waterfall(
            [
                (cb) => { // Create
                    model.create('test.someid', {str_prop: 'str_prop'}, err => {
                        return cb(err);
                    });
                },
                (cb) => { // Read
                    model.fetch('test.someid', err => {
                        if (err) return cb(err);

                        if (!model.get('test.someid')) {
                            return cb(new Error('Can not read test.someid'));
                        }

                        return cb();
                    });
                },
                (cb) => { // Update
                    model.set('test.someid.str_prop', 'New str_prop', err => {
                        if (err) return cb(err);

                        if (model.get('test.someid.str_prop') !== 'New str_prop') {
                            return cb(new Error('Can not update test.someid.str_prop'));
                        }

                        return cb();
                    });
                },
                (cb) => { // Delete
                    model.del('test.someid', err => {
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

    it('checkServerAccess is true', function (done) {
        let model = backend.createModel();
        model.create('test.someid', {str_prop: 'str_prop'}, err => {
            if (err) return done(err);

            model.socket.stream.checkServerAccess = true;

            async.waterfall(
                [
                    (cb) => { // Create
                        model.create('test.somenew', {str_prop: 'str_prop'}, err => {
                            if (err) {
                                return cb();
                            }

                            return cb(new Error('No check on create undefined collection'));
                        });
                    },
                    (cb) => { // Read
                        model.fetch('test.somenew', err => {
                            if (err) {
                                return cb();
                            }

                            return cb(new Error('No check on read undefined collection'));
                        });
                    },
                    (cb) => { // Update
                        model.set('test.someid.str_prop', 'New str_prop', err => {
                            if (err) {
                                return cb();
                            }

                            return cb(new Error('No check on update undefined collection'));
                        });
                    },
                    (cb) => { // Delete
                        model.del('test.someid', err => {
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

    it('Can not create undefined collection when checkServerAccess false', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = false;
        model.create('any_collection.someid', {title: 'Title'}, err => {
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Can not create undefined collection when checkServerAccess true', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.create('any_collection.someid', {title: 'Title'}, err => {
            expect(err).to.be.an('error');
            return done();
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
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Can not create without role', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;

        model.create('test.id', testItem, err => {
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Can not create as guest', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'guest';

        model.create('test.id', testItem, err => {
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Can not create additional fields as user', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'user';

        model.create('test.id', testItem, err => {
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Partial create as user', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'user';

        model.create('test.partialitem', {str_prop: 'some string', num_prop: 12345}, err => {
            return done(err);
        });
    });

    it('Full create as admin', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        model.create('test.fullitem', testItem, err => {
            return done(err);
        });
    });

    it('Full create as GOD', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = options.options.godRole;

        model.create('test.fullgoditem', testItem, err => {
            return done(err);
        });
    });

    it('Create call check function', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';
        model.socket.stream.testCheckFunc = true;

        model.create('test.fullitemchecktest', testItem, err => {
            expect(err).to.be.an('error');
            return done();
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
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Can not read without role', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;

        model.fetch('test.id', err => {
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Can not read as guest', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'guest';

        model.fetch('test.id', err => {
            expect(err).to.be.an('error');
            return done();
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
            expect(err).to.be.an('error');
            return done();
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
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Can not update as guest', function (done) {
        existsModel.socket.stream.checkServerAccess = true;
        existsModel.socket.stream.testRole = 'guest';

        existsModel.set('test.id.str_prop', 'new string', err => {
            expect(err).to.be.an('error');
            return done();
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
                    expect(err).to.be.an('error');
                    return done();
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
                    return done(err);
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
                    return done(err);
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
                expect(err).to.be.an('error');
                return done();
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
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Can not delete as guest', function (done) {
        existsModel.socket.stream.checkServerAccess = true;
        existsModel.socket.stream.testRole = 'guest';

        existsModel.del('test.id', err => {
            expect(err).to.be.not.null;
            return done();
        });
    });

    it('Delete as admin', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        model.fetch('test.id', err => {
            if (err) return done(err);

            model.del('test.id', err => {
                return done(err);
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
                return done(err);
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
                expect(err).to.be.an('error');
                return done();
            });
        });
    });
});

describe('Server queries', function () {
    let backend = newBackend();

    before(function (done) {
        let model = backend.createModel();

        model.add('test', {str_prop: 'some string'}, err => {
            if (err) return done(err);

            model.add('test', {str_prop: 'some another string'}, err => {
                model.close();
                return done(err);
            });
        });
    });

    it('Regular queries works when checkServerAccess false', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = false;
        model.socket.stream.testRole = 'admin';

        let $q = model.query('test', {str_prop: 'some string'});
        $q.fetch(err => {
            return done(err);
        });
    });

    it('Regular queries disallowed when checkServerAccess true', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        let $q = model.query('test', {str_prop: 'some string'});
        $q.fetch(err => {
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Regular extra queries disallowed when checkServerAccess true', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        let $q = model.query('test', {$distinct: {field: '_id'}});
        $q.fetch(err => {
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Server query must exists', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        let $q = model.query('test', {
            $serverQuery: 'noone',
        });
        $q.fetch(err => {
            expect(err).to.be.an('error');
            return done();
        });
    });

    it('Server query works', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = true;
        model.socket.stream.testRole = 'admin';

        let $q = model.query('test', {
            $serverQuery: 'test',
            $params: {p1: 'some string'}
        });
        $q.fetch(err => {
            expect(err).to.not.be.an('error');
            expect($q.get()).to.be.an('array').and.to.have.lengthOf(1);
            expect($q.get()[0].str_prop).to.equal('some string');

            return done();
        });
    });

    it('Server query works without checkServerAccess', function (done) {
        let model = backend.createModel();
        model.socket.stream.checkServerAccess = false;
        model.socket.stream.testRole = 'admin';

        let $q = model.query('test', {
            $serverQuery: 'test',
            $params: {p1: 'some string'}
        });
        $q.fetch(err => {
            expect(err).to.not.be.an('error');
            expect($q.get()).to.be.an('array').and.to.have.lengthOf(1);
            expect($q.get()[0].str_prop).to.equal('some string');

            return done();
        });
    });
});

describe('Utils', function () {
    it('isIdsQuery', function () {
        expect(Utils.isIdsQuery({title: 'title'})).to.be.false;
        expect(Utils.isIdsQuery({_id: '123'})).to.be.false;
        expect(Utils.isIdsQuery({_id: {$in: ['123'], $ne: '321'}})).to.be.false;
        expect(Utils.isIdsQuery({_id: {$in: ['123']}, title: 'title'})).to.be.false;
        expect(Utils.isIdsQuery({_id: {$in: ['123']}})).to.be.true;
    });

    it('isArray', function () {
        expect(Utils.isArray(123)).to.be.false;
        expect(Utils.isArray(false)).to.be.false;
        expect(Utils.isArray(true)).to.be.false;
        expect(Utils.isArray('123')).to.be.false;
        expect(Utils.isArray({})).to.be.false;
        expect(Utils.isArray({a: 1})).to.be.false;
        expect(Utils.isArray([])).to.be.true;
        expect(Utils.isArray([1, 2, 3])).to.be.true;
    });

    it('oneField', function () {
        expect(Utils.oneField({})).to.be.false;
        expect(Utils.oneField({a: 1, b: 1})).to.be.false;
        expect(Utils.oneField({a: 1})).to.be.true;
    });
});