const Utils = {
    isIdsQuery: function (query) {
        const idQuery = query && query['_id'];
        const inQuery = query && query['_id'] && query['_id']['$in'];
        return Utils.oneField(query) && Utils.oneField(idQuery) && Utils.isArray(inQuery);
    },

    isArray: function (obj) {
        return Array.isArray(obj);
    },

    oneField: function (obj) {
        return (obj instanceof Object) && (Object.keys(obj).length === 1);
    },
};

module.exports = Utils;