/* eslint-disable no-undef */
'use strict';

const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const { Query }  = require('../src');

describe('test Query constructor', () => {

    it('verifies it should initilize with defaults', async () => {

        const query = new Query('test');
        expect(query.default_sort_field).equals('test');
        expect(query.default_sort_order).equals('asc');
        expect(query.max_sorted_fields).equals(1);
        expect(query.satisfy).equals(null);
        expect(query.prepared_filters).equals(null);
        expect(query.with_nodb_filters).equals(null);
        expect(query.select).equals(null);
        expect(query.more_select).equals(null);
        expect(query.filters).is.an('array');
        expect(query.filters.length).equals(0);
        expect(query.nodb_filters).is.an('array');
        expect(query.nodb_filters.length).equals(0);
    });
});

describe('test Query run_filter', () => {

    it('verifies it should return correct booleans', async () => {

        const query = new Query('test');

        expect(query.run_filter(1, '!=', 2)).equals(true);
        expect(query.run_filter(2, '!=', 2)).equals(false);
        expect(query.run_filter(2, '!=', '2')).equals(false);

        expect(query.run_filter(1, '<', 2)).equals(true);
        expect(query.run_filter(2, '<', 2)).equals(false);
        expect(query.run_filter(2, '<', '2')).equals(false);

        expect(query.run_filter(1, '<=', 2)).equals(true);
        expect(query.run_filter(2, '<=', 2)).equals(true);
        expect(query.run_filter(2, '<=', '2')).equals(true);
        expect(query.run_filter(3, '<=', 2)).equals(false);

        expect(query.run_filter(1, '>', 2)).equals(false);
        expect(query.run_filter(2, '>', 2)).equals(false);
        expect(query.run_filter(2, '>', '2')).equals(false);
        expect(query.run_filter(3, '>', 2)).equals(true);

        expect(query.run_filter(1, '>=', 2)).equals(false);
        expect(query.run_filter(2, '>=', 2)).equals(true);
        expect(query.run_filter(2, '>=', '2')).equals(true);
        expect(query.run_filter(3, '>=', 2)).equals(true);


        expect(query.run_filter(1, '==', 2)).equals(false);
        expect(query.run_filter(2, '==', 2)).equals(true);
        expect(query.run_filter(2, '==', '2')).equals(true);
        expect(query.run_filter('2', '==', 2)).equals(true);

        expect(query.run_filter([1,2,3], 'array_contains', 2)).equals(true);
        expect(query.run_filter([1,2,3], 'array_contains', 2)).equals(true);
        expect(query.run_filter([1,2,3], 'array_contains', '2')).equals(false);
        expect(query.run_filter([1,2,3], 'array_contains', 4)).equals(false);

        expect(query.run_filter(1, 'in', [1,2,3])).equals(true);
        expect(query.run_filter(2, 'in', [1,2,3])).equals(true);
        expect(query.run_filter(2, 'in', ['1','2','3'])).equals(false);
        expect(query.run_filter(3, 'in', [1,2])).equals(false);

        expect(query.run_filter([1,2,3], 'array_contains_any', [2])).equals(true);
        expect(query.run_filter([1,2,3], 'array_contains_any', [2,4])).equals(true);
        expect(query.run_filter([1,2,3], 'array_contains_any', ['2'])).equals(false);
        expect(query.run_filter([1,2,3], 'array_contains_any', [4])).equals(false);

    });
});

describe('test Query prepare_filters with empty filter', () => {

    it('verifies it should prepare prepared_filers etc', async () => {
        const query = new Query('test');
        query.prepare_filters();
        assert.isTrue(query.satisfy);
        const s = query.toString();
        assert.isNotNull(s);
        expect(s).to.an('string');
        expect(s).equals('{"satisfy":true,"prepared_filters":[[true,"test","order-by","asc"]],"select":null,"more_select":null}');
    });
});

describe('test Query prepare_filters with typical use', () => {

    it('verifies it should has matched toString', async () => {
        const query = new Query('test');
        query.set_select(['name', 'price'])
        query.set_filters([
            ['price', 'order-by', 'asc'],
            ['price', '>=', 100],
            ['price', '<=', 500]
        ]);
        query.set_nodb_filters([
            ['name', '!=', 'test']
        ])
        query.prepare_filters();
        assert.isTrue(query.satisfy);
        assert.isTrue(query.has_nodb_filters());
        assert.isNotNull(query.prepared_filters);
        expect(query.prepared_filters).is.an('array');
        expect(query.prepared_filters.length).equals(4);
        const s = JSON.stringify(query.prepared_filters);
        assert.isNotNull(s);
        expect(s).is.an('string');
        expect(s).equals('[[true,"price","order-by","asc"],[true,"price",">=",100],[true,"price","<=",500],[false,"name","!=","test"]]');
    });
});

describe('test Query prepare_filters with typical use without order-by', () => {

    it('verifies it should has matched toString', async () => {
        const query = new Query('test');
        query.set_select(['name', 'price'])
        query.set_filters([ 
            ['price', '>=', 100],
            ['price', '<=', 500]
        ]);
        query.set_nodb_filters([
            ['name', '!=', 'test']
        ])
        query.prepare_filters();
        assert.isTrue(query.satisfy);
        assert.isTrue(query.has_nodb_filters());
        assert.isNotNull(query.prepared_filters);
        expect(query.prepared_filters).is.an('array');
        expect(query.prepared_filters.length).equals(4);
        const s = JSON.stringify(query.prepared_filters);
        assert.isNotNull(s);
        expect(s).is.an('string');
        expect(s).equals('[[true,"price","order-by","asc"],[true,"price",">=",100],[true,"price","<=",500],[false,"name","!=","test"]]');
    });
});

describe('test Query prepare_filters with typical use with 2 order-bys', () => {

    it('verifies it should remved the 2nd order-by and has matched toString', async () => {
        const query = new Query('test');
        query.set_select(['name', 'price'])
        query.set_filters([
            ['price', 'order-by', 'asc'],
            ['price', '>=', 100],
            ['price', '<=', 500],
            ['name', 'order-by', 'asc'],
        ]);
        query.set_nodb_filters([
            ['name', '!=', 'test']
        ])
        query.prepare_filters();
        assert.isFalse(query.satisfy);
        assert.isTrue(query.has_nodb_filters());
        assert.isNotNull(query.prepared_filters);
        expect(query.prepared_filters).is.an('array');
        expect(query.prepared_filters.length).equals(4);
        const s = JSON.stringify(query.prepared_filters);
        assert.isNotNull(s);
        expect(s).is.an('string');
        expect(s).equals('[[true,"price","order-by","asc"],[true,"price",">=",100],[true,"price","<=",500],[false,"name","!=","test"]]');
    });
});

describe('test Query prepare_filters with typical use with 2nd same order-by', () => {

    it('verifies it should remved the 2nd order-by and has matched toString', async () => {
        const query = new Query('test');
        query.set_select(['name', 'price'])
        query.set_filters([
            ['price', 'order-by', 'asc'],
            ['price', '>=', 100],
            ['price', '<=', 500],
            ['price', 'order-by', 'asc'],
        ]);
        query.set_nodb_filters([
            ['name', '!=', 'test']
        ])
        query.prepare_filters();
        assert.isFalse(query.satisfy);
        assert.isTrue(query.has_nodb_filters());
        assert.isNotNull(query.prepared_filters);
        expect(query.prepared_filters).is.an('array');
        expect(query.prepared_filters.length).equals(4);
        const s = JSON.stringify(query.prepared_filters);
        assert.isNotNull(s);
        expect(s).is.an('string');
        expect(s).equals('[[true,"price","order-by","asc"],[true,"price",">=",100],[true,"price","<=",500],[false,"name","!=","test"]]');
    });
});

describe('test Query prepare_filters with typical use with in operator', () => {

    it('verifies it should has matched toString', async () => {
        const query = new Query('test');
        query.set_select(['name', 'price'])
        query.set_filters([
            ['price', 'order-by', 'asc'],
            ['price', '>=', 100],
            ['price', '<=', 500],
            ['size', 'in', [1,2,3]]
        ]);
        query.set_nodb_filters([
            ['name', '!=', 'test']
        ])
        query.prepare_filters();
        assert.isTrue(query.satisfy);
        assert.isTrue(query.has_nodb_filters());
        assert.isNotNull(query.prepared_filters);
        expect(query.prepared_filters).is.an('array');
        expect(query.prepared_filters.length).equals(5);
        const s = JSON.stringify(query.prepared_filters);
        assert.isNotNull(s);
        expect(s).is.an('string');
        expect(s).equals('[[true,"price","order-by","asc"],[true,"price",">=",100],[true,"price","<=",500],[true,"size","in",[1,2,3]],[false,"name","!=","test"]]');
    });
});

describe('test Query prepare_filters with typical use with 2nd in operator', () => {

    it('verifies it should mark it as nodb filter and has matched toString', async () => {
        const query = new Query('test');
        query.set_select(['name', 'price'])
        query.set_filters([
            ['price', 'order-by', 'asc'],
            ['price', '>=', 100],
            ['price', '<=', 500],
            ['size', 'in', [1,2,3]],
            ['type', 'in', ['A', 'B', 'C']]
        ]);
        query.set_nodb_filters([
            ['name', '!=', 'test']
        ])
        query.prepare_filters();
        assert.isFalse(query.satisfy);
        assert.isTrue(query.has_nodb_filters());
        assert.isNotNull(query.prepared_filters);
        expect(query.prepared_filters).is.an('array');
        expect(query.prepared_filters.length).equals(6);
        const s = JSON.stringify(query.prepared_filters);
        assert.isNotNull(s);
        expect(s).is.an('string');
        expect(s).equals('[[true,"price","order-by","asc"],[true,"price",">=",100],[true,"price","<=",500],[true,"size","in",[1,2,3]],[false,"type","in",["A","B","C"]],[false,"name","!=","test"]]');
    });
});


describe('test Query prepare_filters with typical use with in operator for array size > 10', () => {

    it('verifies it should has matched toString', async () => {
        const query = new Query('test');
        query.set_select(['name', 'price'])
        query.set_filters([
            ['price', 'order-by', 'asc'],
            ['price', '>=', 100],
            ['price', '<=', 500],
            ['size', 'in', [1,2,3,4,5,6,7,8,9,19,11]]
        ]);
        query.set_nodb_filters([
            ['name', '!=', 'test']
        ])
        query.prepare_filters();
        assert.isFalse(query.satisfy);
        assert.isTrue(query.has_nodb_filters());
        assert.isNotNull(query.prepared_filters);
        expect(query.prepared_filters).is.an('array');
        expect(query.prepared_filters.length).equals(5);
        const s = JSON.stringify(query.prepared_filters);
        assert.isNotNull(s);
        expect(s).is.an('string');
        expect(s).equals('[[true,"price","order-by","asc"],[true,"price",">=",100],[true,"price","<=",500],[false,"size","in",[1,2,3,4,5,6,7,8,9,19,11]],[false,"name","!=","test"]]');
    });
});

describe('test Query prepare_filters with !=', () => {

    it('verifies it should mark it to as nodb filter', async () => {
        const query = new Query('test');
        query.set_filters([['name', '!=', 'test']]);
        query.prepare_filters();
        assert.isFalse(query.satisfy);
        assert.isTrue(query.has_nodb_filters());
        assert.isNotNull(query.prepared_filters);
        expect(query.prepared_filters).is.an('array');
        expect(query.prepared_filters.length).equals(2);
        const s = JSON.stringify(query.prepared_filters);
        expect(s).equals('[[true,"test","order-by","asc"],[false,"name","!=","test"]]');
    });
});

describe('test Query prepare_filters with 2nd field inequality operator', () => {

    it('verifies it should mark it as nodb filter and has matched toString', async () => {
        const query = new Query('test');
        query.set_select(['name', 'price'])
        query.set_filters([
            ['price', 'order-by', 'asc'],
            ['price', '>=', 100],
            ['price', '<=', 500],
            ['size', '>', 5]
        ]);
        query.set_nodb_filters([
            ['name', '!=', 'test']
        ])
        query.prepare_filters();
        assert.isFalse(query.satisfy);
        assert.isTrue(query.has_nodb_filters());
        assert.isNotNull(query.prepared_filters);
        expect(query.prepared_filters).is.an('array');
        expect(query.prepared_filters.length).equals(5);
        const s = JSON.stringify(query.prepared_filters);
        assert.isNotNull(s);
        expect(s).is.an('string');
        expect(s).equals('[[true,"price","order-by","asc"],[true,"price",">=",100],[true,"price","<=",500],[false,"size",">",5],[false,"name","!=","test"]]');
    });
});
