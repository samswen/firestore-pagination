/* eslint-disable no-undef */
'use strict';

const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

const { Cursor }  = require('../src');

describe('test constructor', () => {

    it('verifies it should initilize with defaults', async () => {

        const cursor = new Cursor();
        expect(cursor.page_size).equals(25);
        expect(cursor.batch_size).equals(4);
        expect(cursor.action).equals('INIT');
        expect(cursor.first_doc_id).equals(false);
        expect(cursor.current_doc_id).equals(null);
        expect(cursor.last_doc_id).equals(null);
    });
});

describe('test Cursor toString', () => {

    it('verifies it should return the string', async () => {

        const cursor = new Cursor();

        const s = cursor.toString();
        //console.log(s);
        assert.isNotNull(s);
        expect(s).to.be.an('string');
        expect(s).equals('@F;@N;@N;INIT;1;25;4');
    });
});

describe('test Cursor fromString', () => {

    it('verifies it should initilize with the string', async () => {

        const cursor = new Cursor();
        cursor.fromString('@F;00004;@N;NEXT;1;5;4');
        expect(cursor.page_size).equals(5);
        expect(cursor.batch_size).equals(4);
        expect(cursor.action).equals('NEXT');
        expect(cursor.first_doc_id).equals(false);
        expect(cursor.current_doc_id).equals(null);
        expect(cursor.last_doc_id).equals('00004');
    });
});

describe('test Cursor init', () => {

    it('verifies it should initilize with the string', async () => {

        const cursor = new Cursor();
        cursor.init('2dHQfGzW6Sr3jKxjKKlfcLstNi');

        expect(cursor.page_size).equals(5);
        expect(cursor.batch_size).equals(4);
        expect(cursor.action).equals('INIT');
        expect(cursor.first_doc_id).equals(false);
        expect(cursor.current_doc_id).equals(null);
        expect(cursor.last_doc_id).equals(null);
    });
});

describe('test Cursor get_start_page_no', () => {

    it('verifies it should return the start_page_no', async () => {

        const cursor = new Cursor(25, 4);

        expect(cursor.get_start_page_no(1)).equals(1);
        expect(cursor.get_start_page_no(2)).equals(5);
    });
});

describe('test Cursor get_bacth_no', () => {

    it('verifies it should return the batch_no', async () => {

        const cursor = new Cursor(25, 4);

        expect(cursor.get_bacth_no(1)).equals(1);
        expect(cursor.get_bacth_no(5)).equals(2);
    });
});


describe('test Cursor convert_id_to_str', () => {

    it('verifies it process @N, @F and ID', async () => {

        const cursor = new Cursor(25, 4);

        expect(cursor.convert_id_to_str(null)).equals('@N');
        expect(cursor.convert_id_to_str(false)).equals('@F');
        expect(cursor.convert_id_to_str('1234')).equals('1234');
    });
});

describe('test Cursor convert_str_to_id', () => {

    it('verifies it process @N, @F and ID', async () => {

        const cursor = new Cursor(25, 4);

        expect(cursor.convert_str_to_id('@N')).equals(null);
        expect(cursor.convert_str_to_id('@F')).equals(false);
        expect(cursor.convert_str_to_id('1234')).equals('1234');
    });
});

describe('test Cursor has_next and has_prev', () => {

    it('verifies it should return correct boolean', async () => {

        const cursor = new Cursor(5, 4);

        expect(cursor.has_next()).equals(false);
        expect(cursor.has_prev()).equals(false);

        cursor.fromString('@F;00005;@N;NEXT;1;5;4');

        expect(cursor.has_next()).equals(true);
        expect(cursor.has_prev()).equals(false);

        cursor.fromString('00021;00040;00020;NEXT;1;5;4');

        expect(cursor.has_next()).equals(true);
        expect(cursor.has_prev()).equals(true);

        cursor.fromString('00041;@F;00040;NEXT;1;5;4');

        expect(cursor.has_next()).equals(false);
        expect(cursor.has_prev()).equals(true);
    });
});
