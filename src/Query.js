'use strict'

const jsonpath = require('jsonpath');
const { base62_sha1 } = require('@samwen/base62-shax');

const inequality_ops = ['<', '<=', '>', '>='];
const contains_ops = ['in', 'array_contains_any'];

class Query {
    constructor(default_sort_field, default_sort_order = 'asc', max_sorted_fields = 1) {
        this.default_sort_field = default_sort_field;
        this.default_sort_order = default_sort_order;
        this.max_sorted_fields = max_sorted_fields;
        this.satisfy = null;
        this.prepared_filters = null;
        this.with_nodb_filters = null;
        this.select = null;
        this.more_select = null;
        this.filters = [];
        this.nodb_filters = [];
    }

    set_select(select) {
        if (!select || !Array.isArray(select)) {
            throw new Error('Invalid: select must be an array');
        }
        this.select = select;
    }
    
    set_filters(filters) {
        if (!filters || !Array.isArray(filters)) {
            throw new Error('Invalid: filters must be an array');
        }
        this.filters = filters;
    }

    set_nodb_filters(filters) {
        if (!filters || !Array.isArray(filters)) {
            throw new Error('Invalid: filters must be an array');
        }
        this.nodb_filters = [];
        for (let filter of filters) {
            if (!filter || !Array.isArray(filter) || filter.length !== 3) {
                throw new Error('Invalid: supported nodb filter must be an array of 3 elements');
            }
            const operator = filter[1].toLowerCase();
            if (operator === 'order-by') {
                throw new Error('Invalid: operator order-by not supported in nodb filter');
            }
            const field = filter[0];
            const value = filter[2];
            this.nodb_filters.push([field, operator, value]);
        }
    }

    set_key(key) {
        this.sha1_key = key; 
    }

    get_key() {
        if (this.sha1_key) {
            return this.sha1_key;
        }
        this.prepare_filters();
        this.sha1_key = base62_sha1(this.toString());
        return this.sha1_key;
    }

    get_prepared_filters() {
        this.prepare_filters();
        return this.prepared_filters;
    }

    has_nodb_filters() {
        this.prepare_filters();
        return this.with_nodb_filters;
    }

    get_needed_select() {
        this.prepare_filters();
        if (this.select === null) {
            return null;
        }
        if (this.more_select === null) {
            return this.select;
        }
        const needed_select = [];
        for (let field of this.select) {
            needed_select.push(field);
        }
        for (let field of this.more_select) {
            needed_select.push(field);
        }
        return needed_select;
    }

    toString() {
        this.prepare_filters();
        return JSON.stringify({
            satisfy: this.satisfy,
            prepared_filters: this.prepared_filters,
            select: this.select,
            more_select: this.more_select,
        })
    }

    fromString(str) {
        const json = JSON.parse(str);
        if (!json) {
            return false;
        }
        this.satisfy = json.satisfy;
        this.prepared_filters = json.prepared_filters;
        this.select = json.select;
        this.more_select = json.more_select;
        this.with_nodb_filters = false;
        for (let filter of this.prepared_filters) {
            if (!filter[0]) {
                this.with_nodb_filters = true;
                break;
            }
        }
        return true;
    }

    apply_filters(data, nodb_only = true) {
        for (let filter of this.prepared_filters) {
            if (nodb_only && filter[0]) {
                continue;
            }
            const field = filter[1];
            let value = null;
            if (field.indexOf('.') < 0) {
                if (data.hasOwnProperty(field)) {
                    value = data.field;
                }
            } else {
                value = jsonpath.query(data, '$.'+field);
                if (Array.isArray(value) && value.length === 1) {
                    value = value[0];
                }
            }
            if (value === null) {
                return false;
            }
            const operator = filter[2];
            const target = filter[3];
            if (!this.run_filter(value, operator, target)) {
                return false;
            }

        }
        return true;
    }

    run_filter(value, operator, target) {
        if (operator === '!=') {    // added for convenience, firestore not supported
            return (value != target);
        }
        if (operator === '<') {
            return (value < target);
        }
        if (operator === '<=') {
            return (value <= target);
        }
        if (operator === '>') {
            return (value > target);
        }
        if (operator === '>=') {
            return (value >= target);
        }
        if (operator === '==') {
            return (value == target);
        }
        if (operator === 'array_contains') {
            if (!Array.isArray(value)) {
                const msg = 'Value is not array for array_contains filter: ' + value;
                console.error(msg);
                return false;
            }
            return(value.indexOf(target) >= 0);
        }
        if (operator === 'in') {
            if (!Array.isArray(target)) {
                const msg = 'Target is not array for in filters: ' + target;
                console.error(msg);
                return false;
            }
            return (target.indexOf(value) >= 0);
        }
        if (operator === 'array_contains_any') {
            if (!Array.isArray(value)) {
                const msg = 'Value is not array for array_contains_any filter: ' + value;
                console.error(msg);
                return false;
            }
            if (!Array.isArray(target)) {
                const msg = 'Target is not array for array_contains_any filters: ' + target;
                console.error(msg);
                return false;
            }
            let has_it = false;
            for (let tval of target) {
                if (value.indexOf(tval) >= 0) {
                    has_it = true;
                    break;
                }
            }
            return has_it;
        }
        const msg = 'operator not supported: ' + operator;
        console.error(msg);
        return false;
    }

    prepare_filters() {
        if (this.satisfy !== null) {
            return this.satisfy;
        }
        this.satisfy = true;
        this.prepared_filters = [];
        this.with_nodb_filters = false;
        const sorted_fields = [];
        const generated_nodb_filters = [];
        let inequality_field = null;
        let has_contains_ops = false;
        for (let i = 0; i < this.filters.length; i++) {
            const filter = this.filters[i];
            const field = filter[0];
            const operator = filter[1].toLowerCase();
            const value = filter[2];
            if (operator === '!=') {
                const msg = 'operator != not supported and will run as nodb filter: ' + JSON.stringify(filter);
                console.error(msg);
                this.satisfy = false;
                generated_nodb_filters.push(filter);
            } else if (operator === 'order-by') {
                if (sorted_fields.indexOf(field) >= 0) {
                    const msg = 'field already ordered and ignore: ' + JSON.stringify(filter);
                    console.error(msg);
                    this.satisfy = false;
                } else if (sorted_fields.length >= this.max_sorted_fields) {
                    const msg = 'numer of ordered fields exceeds max and ignore: ' + JSON.stringify(filter);
                    console.error(msg);
                    this.satisfy = false;
                } else {
                    this.prepared_filters.push([true, field, operator, value.toLowerCase()]);
                    sorted_fields.push(field);
                }
            } else if (inequality_ops.indexOf(operator) >= 0) {
                if (inequality_field && inequality_field !== field) {
                    const msg = 'inequality filter on 2nd field and will run as nodb filter: ' + JSON.stringify(filter);
                    console.error(msg);
                    this.satisfy = false;
                    generated_nodb_filters.push(filter);
                } else {
                    if (!inequality_field) {
                        inequality_field = field;
                        if (sorted_fields.indexOf(field) < 0) {
                            let order = 'asc';
                            for (let j = i + 1; j < this.filters.length; j++) {
                                const filter2 = this.filters[j];
                                if (filter2[0] === field && filter2[1].toLowerCase() === 'order-by') {
                                    order = filter2[2].toLowerCase();
                                    break;
                                }
                            }
                            const msg = 'inequality operation without preceded order by and added: ' + JSON.stringify(filter);
                            console.error(msg);
                            this.prepared_filters.push([true, field, 'order-by', order]);
                            sorted_fields.push(field);
                        }
                    }
                    this.prepared_filters.push([true, field, operator, value]);
                }
            } else if (contains_ops.indexOf(operator) >= 0) {
                if (has_contains_ops) {
                    const msg = 'only one contains operator filter allowed and will run as nodb filter: ' + JSON.stringify(filter);
                    console.error(msg);
                    this.satisfy = false;
                    generated_nodb_filters.push(filter);
                } else {
                    if (operator === 'in') {
                        if (!Array.isArray(value)) {
                            const msg = 'in operator value must array and ignored: ' + JSON.stringify(filter);
                            console.error(msg);
                            this.satisfy = false;
                        } else if (value.length > 10) {
                            const msg = 'a maximum of 10 items for in filter are allowed in the array and will run as nodb filter: ' + JSON.stringify(filter);
                            console.error(msg);
                            this.satisfy = false;
                            generated_nodb_filters.push(filter);
                        } else {
                            has_contains_ops = true;
                            this.prepared_filters.push([true, field, operator, value]);
                        }
                    } else {
                        has_contains_ops = true;
                        this.prepared_filters.push([true, field, operator, value]);
                    }
                }
            } else {
                this.prepared_filters.push([true, field, operator, value]);
            }
        }
        if (sorted_fields.length === 0) {
            if (this.default_sort_field && this.default_sort_order) {
                this.prepared_filters.push([true, this.default_sort_field, 'order-by', this.default_sort_order]);
            } else {
                const msg = 'no order by in the filters, pagination will not work properly';
                console.error(msg);
            }
        }
        for (let filter of generated_nodb_filters) {
            this.with_nodb_filters = true;
            this.prepared_filters.push([false, filter[0], filter[1], filter[2]]);
        }
        for (let filter of this.prepared_filters) {
            const field = filter[1];
            const operator = filter[2];
            const value = filter[3];
            for (let i = 0; i < this.nodb_filters.length; i++) {
                const nodb_filter = this.nodb_filters[i];
                if (field === nodb_filter[0] && operator === nodb_filter[1] && value === nodb_filter[2]) {
                    const msg = 'DUPLICATED-FILTER: a duplicated filter found in ndb filters and removed: ' + JSON.stringify(nodb_filter);
                    console.error(msg);
                    this.nodb_filters.splice(i, 1);
                }
            }
        }
        for (let filter of this.nodb_filters) {
            this.with_nodb_filters = true;
            this.prepared_filters.push([false, filter[0], filter[1], filter[2]]);
        }
        if (this.select != null && this.nodb_filters.length > 0) {
            for (let filter of this.nodb_filters) {
                const field = filter[0];
                if (this.select.indexOf(field) < 0) {
                    if (this.more_select === null) {
                        this.more_select = [];
                    }
                    if (this.more_select.indexOf(field) < 0) {
                        this.more_select.push(field);
                    }
                }
            }
        }
        return this.satisfy;        
    }
}

module.exports = Query;
