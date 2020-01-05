'use strict'

const jsonpath = require('jsonpath');

const Database = require('./Database');
const Query = require('./Query');
const Cursor = require('./Cursor');

class Pagination {
    
    constructor(db, config) {
        this.database = new Database(db, config);
        this.init(config);
    }

    init(config) {
        this.default_sort_field = config.get('default_sort_field', 'item');
        this.default_sort_order = config.get('default_sort_order', 'asc');
        this.max_sorted_fields = config.get('max_sorted_fields', 1);  
        this.page_size = config.get('page_size', 5)
        this.batch_size = config.get('batch_size', 4);
        this.display_as = null;
    }

    set_display_as(display_as) {
        if (!display_as || Array.isArray(display_as)) {
            throw new Error('Invalid: display_as must be key value object');
        }
        this.display_as = display_as;
    }

    /**
     * 
     * @param {*} action 'CURRENT' | 'NEXT' | 'PREV'
     * @param {*} options [[query] | [[select], [filters], [nodb_filters]], [[cursor] | [cursor_key | batch_key]]
     */
    async do_paging(action, options) {
        const {query, cursor} = this.process_options(options);
        if (!action) {
            action = 'CURRENT';             // current
        }
        let data = null;
        if (action === 'NEXT') {            // next
            data = await this.get_next_pages(query, cursor);
        } else if (action === 'PREV') {     // previous
            data = await this.get_previous_pages(query, cursor);
        } else if (action === 'CURRENT') {  // current
            data = await this.get_current_pages(query, cursor);
        } else {
            const msg = 'UNKOWN ACTION: ' + action;
            console.error(msg);
        }
        if (!data) {
            return null;
        }
        return this.get_batch(query, cursor, data);
    }

    /**
     * 
     * @param {*} query_key 
     * @param {*} batch_no 
     */
    async get_batch_by_no(query_key, batch_no) {
        const query = new Query(this.default_sort_field, this.default_sort_order, this.max_sorted_fields);
        const cursor = new Cursor(this.page_size, this.batch_size);
        const data = await this.database.get_cached_data(query_key, batch_no, query, cursor);
        if (!data) {
            const msg = 'NOT CACHED, get_batch_by_no: ' + batch_no;
            console.error(msg);
            return null;
        }
        return this.get_batch(query, cursor, data);
    }

    /**
     * 
     * @param {*} options [[query] | [[select], [filters], [nodb_filters]], [[cursor] | [cursor_key | batch_key]]
     */
    async do_preview(options) {
        const {query, cursor} = this.process_options(options);
        return await this.database.get_preview_data(query, cursor);
    }

    /**
     * 
     * @param {*} options [[query] | [[select], [filters], [nodb_filters]], [[cursor] | [cursor_key | batch_key]]
     */
    process_options(options) {
        let query, cursor;
        if (options) {
            if (options.query) {
                query = options.query
            } else {
                query = new Query(this.default_sort_field, this.default_sort_order, this.max_sorted_fields);
                if (options.select) {
                    query.set_select(options.select);
                }
                if (options.filters) {
                    query.set_filters(options.filters);
                }
                if (options.nodb_filters) {
                    query.set_nodb_filters(options.nodb_filters);
                }
            }
            if (options.cursor) {
                cursor = options.cursor;
            } else {
                cursor = new Cursor(this.page_size, this.batch_size);
                if (options.cursor_key) { 
                    cursor.init(options.cursor_key);
                } else if (options.batch_key) {
                    const parts = options.batch_key.split('-');
                    if (parts.length === 2) {
                        cursor.init(parts[1]);
                    }
                }
            }
        } else {
            query = new Query(this.default_sort_field, this.default_sort_order, this.max_sorted_fields);
            cursor = new Cursor(this.page_size, this.batch_size);
        }
        return {query: query, cursor: cursor};
    }

    async do_cleanup() {
        return await this.database.cleanup_metadata();
    }

    get_metrics() {
        return this.database.get_metrics();
    }

    print_batch_pages(batch, select) {
        console.log('---------------------- batch no: ' + batch.batch_no + ' ----------------------');
        for (let i = 0; i < batch.pages.length; i++) {
            console.log('### page no ' + (batch.start_page_no + i));
            const page = batch.pages[i];
            for (let j = 0; j < page.length; j++) {
                const item = page[j];
                this.print_row(j+1, item, select);
            }
        }
        console.log();
        console.log('batch_key: ' + batch.batch_key);
        console.log('start_page_no: ' + batch.start_page_no + ' has_prev: ' + batch.has_prev + ' has_next: ' + batch.has_next);
        console.log('metrics: ' + JSON.stringify(this.get_metrics()));
    }

    get_batch(query, cursor, data) {
        const batch = {
            batch_key: query.get_key() + '-' + cursor.get_key(),
            batch_size: cursor.batch_size,
            page_size: cursor.page_size,
            batch_no: cursor.get_bacth_no(),
            start_page_no: cursor.start_page_no,
            has_next: cursor.has_next(),
            has_prev: cursor.has_prev()
        };
        const pages = [];
        let page = [];
        for (let i in data) {
            const row = data[i];
            const transfered_row = {};
            for (let field of query.select) {
                let value;
                if (field.indexOf('.') >= 0) {
                    value = jsonpath.query(row, '$.'+field);
                    if (Array.isArray(value)) {
                        if (value.length === 1) {
                            value = value[0];
                        }
                    }    
                } else {
                    value = row[field];
                }
                let transfered_field;
                if (this.display_as && this.display_as.hasOwnProperty(field)) {
                    transfered_field = this.display_as[field];
                } else {
                    transfered_field = field;
                }
                transfered_row[transfered_field] = value;
            }
            page.push(transfered_row);
            if (page.length === cursor.page_size) {
                pages.push(page);
                page = [];
            }
        }
        if (page.length > 0) {
            pages.push(page);
        }
        batch.pages = pages;
        return batch;
    }

    async get_current_pages(query, cursor) {
        return await this.database.get_pages_data(query, cursor, cursor.start_page_no);
    }

    async get_next_pages(query, cursor) {
        if (!cursor.last_doc_id) {
            return await this.database.get_pages_data(query, cursor, cursor.start_page_no);
        } else {
            cursor.action = 'NEXT';
            cursor.current_doc_id = cursor.last_doc_id;
            return await this.database.get_pages_data(query, cursor, cursor.start_page_no + cursor.batch_size);
        }
    }

    async get_previous_pages(query, cursor) {
        if (!cursor.first_doc_id) {
            return await this.database.get_pages_data(query, cursor, cursor.start_page_no);
        } else {
            cursor.action = 'PREV';
            cursor.current_doc_id = cursor.first_doc_id;
            return await this.database.get_pages_data(query, cursor, cursor.start_page_no - cursor.batch_size);
        }
    }

    print_row(row_no, item, select) {
        if (!item) {
            console.log(row_no + ':\tnull');
            return;
        }
        if (!select || select.length === 0) {
            let str = JSON.stringify(item, Object.keys(item).sort());
            if (str.length > 73) {
                str = str.substring(0, 70) + '...';
            }
            console.log(row_no + ':\t' + str);
        } else {
            let str = ''
            if (row_no === 1) {
                for (let field of select) {
                    if (str.length !== 0) {
                        str += ',\t';
                    }
                    let transfered_field = field;
                    if (this.display_as && this.display_as.hasOwnProperty(field)) {
                        transfered_field = this.display_as[field];
                    }
                    str += transfered_field;
                }
                console.log('\t' + str);
                str = '';
            }
            for (let field of select) {
                if (str.length !== 0) {
                    str += ',\t';
                }
                let transfered_field = field;
                if (this.display_as && this.display_as.hasOwnProperty(field)) {
                    transfered_field = this.display_as[field];
                }
                let value = item[transfered_field];
                str += value;
            }
            if (str.length > 73) {
                str = str.substring(0, 70) + '...';
            }
            console.log(row_no + ':\t' + str);
        }
    }    
}

module.exports = Pagination;
