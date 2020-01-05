'use strict'

const { base62_encode, base62_decode } = require('@samwen/base62-util');

class Cursor {
    constructor(page_size = 25, batch_size = 4) {
        this.page_size = page_size;
        this.batch_size = batch_size;
        this.init(null);
    }

    init(key) {
        if (key && key.length > 0) {
            const str = base62_decode(key);
            if (this.fromString(str)) {
                return;
            } else {
                console.error('Error: invalid cursor key: ' + key);
            }
        }
        this.first_doc_id = false;
        this.last_doc_id = null;
        this.current_doc_id = null;
        this.action ='INIT';
        this.start_page_no = 1;
    }

    get_key() {
        return base62_encode(this.toString());
    }

    toString() {
        return this.convert_id_to_str(this.first_doc_id) + ';' +
            this.convert_id_to_str(this.last_doc_id) + ';' +
            this.convert_id_to_str(this.current_doc_id) + ';' +
            this.action + ';' + 
            this.start_page_no + ';' +
            this.page_size + ';' +
            this.batch_size;
    }

    fromString(str) {
        const parts = str.split(';');
        if (parts.length === 7) {
            this.first_doc_id = this.convert_str_to_id(parts[0]);
            this.last_doc_id = this.convert_str_to_id(parts[1]);
            this.current_doc_id = this.convert_str_to_id(parts[2]);
            this.action = parts[3];
            this.start_page_no = parseInt(parts[4]);
            this.page_size = parseInt(parts[5]);
            this.batch_size = parseInt(parts[6]);
            return true;
        }
        return false;        
    }

    get_start_page_no(batch_no) {
        return this.batch_size * (batch_no - 1) + 1;
    }

    get_bacth_no(start_page_no = null) {
        if (start_page_no !== null) {
            return Math.ceil((start_page_no - 1)/ this.batch_size) + 1;
        } else {
            return (this.start_page_no - 1) / this.batch_size + 1;
        }
    }

    convert_id_to_str(id) {
        if (id === null) {
            return '@N';
        }
        if (id === false) {
            return '@F';
        }
        return id;
    }

    convert_str_to_id(str) {
        if (str === '@N') {
            return null;
        }
        if (str === '@F') {
            return false;
        }
        return str;
    }

    has_next() {
        if (this.last_doc_id) {
            return true;
        } else {
            return false;
        }
    }

    has_prev() {
        if (this.first_doc_id) {
            return true;
        } else {
            return false;
        }
    }

    set_first_doc_id(doc) {
        if (doc) {
            this.first_doc_id = doc.id;
        } else {
            this.first_doc_id = doc;
        }
    }

    set_last_doc_id(doc) {
        if (doc) {
            this.last_doc_id = doc.id;
        } else {
            this.last_doc_id = doc;
        }
    }

    set_current_doc_id(doc) {
        if (doc) {
            this.current_doc_id = doc.id;
        } else {
            this.current_doc_id = doc;
        }
    }
}

module.exports = Cursor;
