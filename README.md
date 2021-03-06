# ShareDB Secure

Access and schema control for [ShareDB](https://github.com/share/sharedb) and [DerbyJS](https://github.com/derbyjs/derby)

### Installation & Usage

`npm install sharedb-secure`

```js
const derby = require('derby');
const options = require('examples/options');
const sharedbSecure = require('sharedb-secure');

let backend = derby.createBackend();
sharedbSecure(backend, options);

let model = backend.createModel();
model.socket.stream.checkServerAccess = true; // If you want to check access on the server side
```

### Upgrade 0.1.x to 0.2.0

Server queries was added. You must provide `serverQuery` to options or set `options.allowRegularQueries` to true.

### Features

Library provide access controll for create, read, update and delete oprations with ShareDB in DerbyJS application.

* Allow to read only several fields for some user group
* Disallow to read whole collections for another group
* Allow only create but not update operations on any of fields for any colelction for any user group
* Schema validation with Z-Schema
* Server queries with disallowed regular queries

### Server queries

First, you should provide `serverQuery` property for your collection. Key is query name, value - function which must create real query object.

You can return an error in first argument.

Thanks to https://github.com/dmapper/server-query

Be aware of *just* passing params to real query and check it to be a strings, objects, arrays or what you need.

Example:
```
// options
serverQuery: {
    test: function (params, req, next) {
        return next(null, {title: '' + params.p1});
    },
}

// Call
model.query('collection', {
    $serverQuery: 'test',
    $params: {p1: 'some string'}
});
```

### Options

You may view example options in example directory. Options is a JavaScript Object with keys:

#### collections

Each key is collection name. Value is below.

#### collections.\*.schema

[Z-Schema](https://github.com/zaggino/z-schema) schema for the collection items.

#### collections.\*.getRole

Function with arguments *(docId, doc, session, req, next)*. Should return *string* role name by calling `next(null, 'role')`

`docId` - the document ID for which the role is requested.

`doc` - the document body for which the role is requested. `doc is null for op calls`

`session` - current session object.

`req` - current request object.

#### collections.\*.roles

Each key is `role name` which returned from `getRole` function. If role is not provided access will be denied.

#### collections.\*.roles.\*.[create|read|update].\*.fields

Array with allowed fields for create or read or update.

For `read` not allowed fields will be cut off from snapshots and ops.

If agent try to create or update not allowed field - error will be throwed. 

May be set to `['*']` for allow operation on all fields.

#### collections.\*.roles.\*.[create|read|update|delete].\*.check

Callback function with arguments *(docId, doc, session, req, next)* for create, read and delete.
Arguments for update is *(docId, oldDoc, newDoc, session, req, next)*.

For read operation `doc may be null` for op operations.

You can set `check:true` is you don not to check any values.

If function is not provided access will be denied.

#### collections.\*.serverQuery

An object with keys - query names, and values - functions (params, req, next).

Function calls when server query executed for collection.

#### options.godRole

String. If this role will be returned from `getRole` access will be granted without any checks. Just for developers or super-admins or gods.

#### options.allowRegularQueries

Allow regular queries. Default to `false`

Set `true` if you do not need to secure user queries.

#### zschema.options

Options for Z-Schema constructor.

#### zschema.formats

Object with additional formats for Z-Schema. Key is format name, value is function.

## MIT License

Copyright (c) 2019 Valery Ozarnichuk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.