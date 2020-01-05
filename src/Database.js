const admin = require('firebase-admin');

'use strict'

const DEFAULT_MAX_DOCS = 100000;   // default to 0.1 million

class Database {
    constructor(db, config) {
        this.db = db;
        this.init(config);
        this.reset_metrics();
    }

    init(config) {
        this.collection_name = config.get('collection_name', 'pagination_test');
        this.preview_cache_ttl = config.get('preview_cache_ttl', 3600 * 4);
        this.page_cache_ttl = config.get('page_cache_ttl', 1800);
        this.max_cached_ids = config.get('max_cached_ids', 1024);
        this.max_docs_limit = config.get('max_docs_limit', 2048);
        if (this.max_docs_limit && this.max_docs_limit < this.max_cached_ids) {
            this.max_docs_limit = this.max_cached_ids;
        }
        this.max_pre_cached_batches = config.get('max_pre_cached_batches', 3);
        this.cleanup_timeout = config.get('cleanup_timeout', 3600 * 24 * 7);
        this.promises_size = config.get('promises_size', 1024);
        this.read_multiply = config.get('read_multiply', 2);
        this.appendix = config.get('appendix', '_metadata');
        this.cache_version = config.get('cache_version', 1);
        this.cache_preview = config.get('cache_preview', true);
        this.cache_pages = config.get('cache_pages', true);
        if (!this.cache_pages && this.max_pre_cached_batches > 0) {
            this.max_pre_cached_batches = 0;
        }
    }

    reset_metrics() {
        this.read_docs = 0;
        this.write_docs = 0;
        this.delete_docs = 0;
        this.start_time = new Date().getTime();
    }

    get_runtime() {
        return new Date().getTime() - this.start_time;
    }

    get_metrics() {
        return {
            read_docs: this.read_docs,
            write_docs: this.write_docs,
            delete_docs: this.delete_docs,
            runtime: this.get_runtime()
        };
    }

    async get_pages_data(query, cursor, start_page_no) {
        const query_key = query.get_key();
        if (this.cache_pages) {
            const data = await this.get_pages_data_from_cache(query_key, cursor, start_page_no, query);
            if (data) {
                return data;
            }
        }
        const ids = [];
        if (this.cache_preview) {
            const data = await this.get_cached_ids_data(query_key, cursor, start_page_no, ids, query);
            if (data) {
                if (this.cache_pages && data) {
                    await this.save_pages_data_to_cache(query, cursor, data, ids);
                }
                return data;
            }
        }
        const data = await this.get_pages_data_from_source(query, cursor, start_page_no, ids);
        if (this.cache_pages && data) {
            await this.save_pages_data_to_cache(query, cursor, data, ids);
        }
        return data;
    }
    
    async get_cached_data(query_key, batch_no, query, cursor) {
        const start_page_no = cursor.get_start_page_no(batch_no);
        if (this.cache_pages) {
            const data = await this.get_pages_data_from_cache(query_key, cursor, start_page_no, query);
            if (data) {
                return data;
            }
        }
        if (this.cache_preview) {
            const ids = [];
            const data = await this.get_cached_ids_data(query_key, cursor, start_page_no, ids, query);
            if (!data) {
                return null;
            }
            if (this.cache_pages && data) {
                await this.save_pages_data_to_cache(query, cursor, data, ids);
            }
            return data;
        }
        return null;
    }

    async get_preview_data(query, cursor) {
        const query_key = query.get_key();
        if (this.cache_preview) {
            const result = await this.get_preview_data_from_cache(query_key);
            if (result !== null) {
                return result;
            }
        }
        let batches = null;
        if (this.max_pre_cached_batches > 0) {
            batches = [];
        }
        let ids = null;
        if (this.cache_preview) {
            ids = [];
        }
        const total = await this.prepare_preview_data(query, cursor, batches, ids);
        if (total === null) {
            return {total: 0, cached_count: 0};
        }
        let cached_count = 0;
        if (this.cache_preview) {
            await this.save_pagination_preview(query, total, ids);
            cached_count = ids.length;
        }
        if (batches && batches.length > 0) {
            await this.cache_pages_batches(query, cursor, batches);
        }
        return {total: total, cached_count: cached_count};
    }

    async cleanup_metadata() {
        const expired_at = Math.floor(Date.now()/1000) - this.cleanup_timeout;
        const ref = this.db.collection(this.collection_name + '_metadata');
        const snapshots = await ref.orderBy('updated_at', 'asc').where('updated_at', '<=', expired_at).get();
        if (!snapshots || snapshots.docs.length === 0) {
            this.read_docs++
            return 0;
        }
        this.read_docs += snapshots.docs.length;
        const promises = [];
        let batch = this.db.batch();
        let batch_count = 0;
        for (let doc of snapshots.docs) {
            batch.delete(ref.doc(doc.id));
            batch_count++;
            if (batch_count === 500) {
                promises.push(batch.commit());
                batch_count = 0;
                batch = this.db.batch();
                if (promises.length === this.promises_size) {
                    await Promise.all(promises);
                    this.delete_docs += promises.length;
                    promises.length = 0;
                }
            }
        }
        if (batch_count > 0) {
            promises.push(batch.commit());
        }
        if (promises.length > 0) {
            await Promise.all(promises);
            this.delete_docs += promises.length;
        }
        return snapshots.docs.length;
    }

    async get_doc_by_id(id) {
        if (!id) {
            return id;
        }
        const doc = await this.db.collection(this.collection_name).doc(id).get();
        this.read_docs++;
        if (!doc || !doc.data()) {
            const msg = 'FAILED: get_doc_by_id: '+id;
            console.error(msg);
            return null;
        }
        return doc;
    }

    async get_metadata(id, update_access) {
        const ref = this.db.collection(this.collection_name + this.appendix);
        this.read_docs++
        const doc =  await ref.doc(id).get();
        if (!doc || !doc.data()) {
            return null;
        }
        const data = doc.data();
        if (update_access) {
            const increment = admin.firestore.FieldValue.increment(1);
            ref.doc(id).update({
                access_count: increment, accessed_at: Math.floor(Date.now()/1000) 
            }).then(result => {
                /* */
            }).catch(err => {
                console.error(err);
            })
            this.write_docs++;
        }
        return data;
    }

    async set_metadata(id, data, include_metrics = false) {
        const ref = this.db.collection(this.collection_name + this.appendix);
        data.updated_at = Math.floor(Date.now()/1000);
        this.write_docs++;
        if (include_metrics) {
            data.read_docs = this.read_docs;
            data.write_docs = this.write_docs;
            data.runtime = this.get_runtime();
        }
        return await ref.doc(id).set(data, {merge: true});
    }

    async cache_pages_batches(query, cursor, batches) {
        const promises = [];
        for (let i = 0; i < this.max_pre_cached_batches; i++) {
            let start_page_no = cursor.start_page_no;
            if (i > 0) {
                if (cursor.last_doc_id === false) {
                    break;
                }
                cursor.action = 'NEXT';
                start_page_no += cursor.batch_size;
                cursor.current_doc_id = cursor.last_doc_id;
            }
            const ids = [];
            const data = this.get_pages_data_from_batches(query, cursor, start_page_no, batches, ids)
            if (!data) {
                break;;
            }
            const cursor_key = cursor.get_key();
            if (i > 0) { // the first batch is saved by get_pages_data
                promises.push(this.save_pages_data_to_cache(query, cursor, data, ids));
            }
            cursor.init(cursor_key);
        }
        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }

    get_prepared_ref(query, backward = false) {
        let ref = this.db.collection(this.collection_name);
        const needed_select = query.get_needed_select();
        if (needed_select) {
            ref = ref.select(...needed_select);
        }
        const prepared_filters = query.get_prepared_filters();
        if (prepared_filters) {
            for (let filter of prepared_filters) {
                if (!filter[0]) {   // nodb filter
                    continue;
                }
                const field = filter[1];
                const operator = filter[2];
                const value = filter[3];
                if (operator === 'order-by') {
                    let order = value;
                    if (backward) {
                        order = (order === 'asc' ? 'desc' : 'asc');
                    }
                    ref = ref.orderBy(field, order);
                } else {
                    ref = ref.where(field, operator, value);
                }
            }
        }
        return ref;
    }

    async get_pages_docs_with_nodb_filters(ref, query, cursor, after_doc, max_size, docs) {
        let has_more = true;
        let fetch_size = max_size;
        while (docs.length < max_size + 1) {
            let snapshots = null;
            if (after_doc === null) {
                snapshots = await ref.limit(fetch_size + 1).get();
            } else {
                snapshots = await ref.startAfter(after_doc).limit(fetch_size + 1).get();
            }
            if (!snapshots || snapshots.docs.length === 0) {
                has_more = false;
                break;
            }
            if (snapshots.docs.length <= fetch_size) {
                has_more = false;
            }
            this.read_docs += snapshots.docs.length;
            for (let doc of snapshots.docs) {
                if (query.apply_filters(doc.data())) {
                    docs.push(doc);
                    if (docs.length === max_size + 1) {
                        break;
                    }
                } 
            }
            if (!has_more || docs.length === max_size + 1) {
                break;
            }
            after_doc = snapshots.docs[fetch_size - 1];
            fetch_size = cursor.page_size * cursor.batch_size * this.read_multiply;
        }
        return has_more;
    }

    async get_pages_docs(query, cursor, after_doc, max_size, docs) {
        let has_more = true;
        try {
            const backward = (cursor.action === 'PREV');
            const ref = await this.get_prepared_ref(query, backward);
            if (!query.has_nodb_filters()) {
                let snapshots = null;
                if (after_doc === null) {
                    snapshots = await ref.limit(max_size + 1).get();
                } else {
                    snapshots = await ref.startAfter(after_doc).limit(max_size + 1).get();
                }
                if (!snapshots || snapshots.docs.length === 0) {
                    has_more = false;
                } else {
                    if (snapshots.docs.length <= max_size) {
                        has_more = false;
                    }
                    for (let doc of snapshots.docs) {
                        docs.push(doc);
                    }
                    this.read_docs += snapshots.docs.length;
                }
            } else {
                has_more = await this.get_pages_docs_with_nodb_filters(ref, query, cursor, after_doc, max_size, docs);
            }
        } catch (err) {
            console.error(err);
        }
        return has_more;
    }

    get_pages_docs_from_batches(after_doc_id, max_size, batches) {
        const docs = [];
        let on = false;
        if (!after_doc_id) {
            on = true;
        }
        for (let doc of batches) {
            if (on) {
                docs.push(doc);
                if (docs.length === max_size + 1) {
                    break;
                }
            } else if (doc.id === after_doc_id) {
                on = true;
            }
        }
        return docs;;
    }

    docs_is_null(cursor) {
        if (cursor.last_doc_id === null) {
            cursor.first_doc_id = false;
            cursor.last_doc_id = false;
            return false;
        }
        if (cursor.action === 'PREV') {
            cursor.first_doc_id = false;
            cursor.last_doc_id = null;
        } else {
            cursor.first_doc_id = null;
            cursor.last_doc_id = false;
        }
        return null;
    }

    move_cursor_backward(docs, cursor, start_page_no, max_size) {
        const docs_size = docs.length;
        let start = docs_size - 1;
        const end = 0;
        if (docs_size === max_size + 1) {
            start = max_size - 1;
            cursor.start_page_no = start_page_no;
            cursor.first_doc_id = docs[start].id;
            cursor.last_doc_id = docs[end].id;
        } else {
            cursor.first_doc_id = false;
            cursor.start_page_no = 1;
            if (docs_size === max_size) {
                cursor.last_doc_id = docs[end].id;
            } else {
                cursor.last_doc_id = false;
            }
        }
        return {start: start, end: end};
    }

    move_cusor_forward(docs, cursor, start_page_no, max_size) {
        const docs_size = docs.length;
        const start = 0;
        let end = docs_size - 1;
        if (cursor.action === 'INIT') {
            cursor.start_page_no = 1;
            cursor.first_doc_id = false;
        } else {
            cursor.start_page_no = start_page_no;
            cursor.first_doc_id = docs[start].id;
        }
        if (docs_size === max_size + 1) {
            end = max_size - 1;
            cursor.last_doc_id = docs[end].id;
        } else {
            cursor.last_doc_id = false;
        }
        return {start: start, end: end};
    }

    move_cursor(docs, cursor, start_page_no, max_size) {
        if (docs === null || docs.length === 0) {
            return this.docs_is_null(cursor);
        }
        if (cursor.action === 'PREV') {
            return this.move_cursor_backward(docs, cursor, start_page_no, max_size);
        } else {
            return this.move_cusor_forward(docs, cursor, start_page_no, max_size);
        }
    }
 
    prepare_data(query, postions, docs, ids) {
        const data = [];        
        if (postions.start <= postions.end) {   // forward
            for (let i = postions.start; i <= postions.end; i++) {
                const doc = docs[i];
                ids.push(doc.id);
                if (!query.more_select) {
                    data.push(doc.data());
                } else {
                    const select = query.select;
                    data.push((({...select}) => ({...select}))(doc.data()));
                }
            }
        } else {                                // backward
            for (let i = postions.start; i >= postions.end; i--) {
                const doc = docs[i];
                ids.push(doc.id);
                if (!query.more_select) {
                    data.push(doc.data());
                } else {
                    const select = query.select;
                    data.push((({...select}) => ({...select}))(doc.data()));
                }
            }
        }
        return data;
    }

    get_pages_data_from_batches(query, cursor, start_page_no, batches, ids) {
        const docs_max_size = cursor.page_size * cursor.batch_size;
        const docs = this.get_pages_docs_from_batches(cursor.current_doc_id, docs_max_size, batches);
        const postions = this.move_cursor(docs, cursor, start_page_no, docs_max_size);
        if (!postions) {
            return null;
        }
        return this.prepare_data(query, postions, docs, ids);
    }

    get_preview_cache_key(query_key) {
        return 'a' + this.cache_version + '-' + query_key;
    }

    get_pages_cache_key(query_key, cursor, start_page_no) {
        const batch_no = cursor.get_bacth_no(start_page_no);
        return this.get_pages_cache_key_with_batch_no(query_key, cursor, batch_no);
    }

    get_pages_cache_key_with_batch_no(query_key, cursor, batch_no) {
        return 'b' + this.cache_version + '-' + batch_no + 'x' + 
            cursor.page_size + 'x' + cursor.batch_size + '-' + query_key;
    }

    async get_pages_data_from_cache(query_key, cursor, start_page_no, query) {
        const id = this.get_pages_cache_key(query_key, cursor, start_page_no);
        let pages = await this.get_metadata(id, true);
        if (!pages || Math.floor(Date.now()/1000) - pages.updated_at >= this.page_cache_ttl) {
            return null; 
        }
        if (query.satisfy === null) {
            query.fromString(pages.query);
        }
        cursor.init(pages.cursor_key);
        if (pages.data) {
            return JSON.parse(pages.data)
        } else { 
            // cached data was deleted due to backend validation, use the cached ids to get it
            const pages_data = await this.get_pages_data_from_ids(query, pages.ids);
            if (pages_data ) {
                const update = {
                    data: JSON.stringify(pages_data)
                }
                await this.set_metadata(id, update, true);
                return pages_data;
            }
        }
        return null;
    }

    async get_preview_data_from_cache(query_key) {
        const id = this.get_preview_cache_key(query_key);
        const preview = await this.get_metadata(id, true);
        if (preview &&  Math.floor(Date.now()/1000) - preview.updated_at < this.preview_cache_ttl) {
            return {total: preview.total, cached_count: preview.ids.length};
        }
        return null;
    }

    async get_cached_ids_data(query_key, cursor, start_page_no, ids, query) {
        const id = this.get_preview_cache_key(query_key);
        const preview = await this.get_metadata(id, true);
        if (!preview || Math.floor(Date.now()/1000) - preview.updated_at >= this.preview_cache_ttl) {
            return null;
        }
        let start = cursor.page_size * (start_page_no - 1);
        if (start > preview.ids.length - 1) {
            return null;
        }
        let end = start + cursor.batch_size * cursor.page_size - 1;
        if (!isNaN(preview.total) && end > preview.total - 1) {
            end = preview.total - 1;
        }
        if (end > preview.ids.length - 1) {
            return null;
        }
        for (let i = start; i <= end; i++) {
            ids.push(preview.ids[i]);
        }
        if (query.satisfy === null) {
            query.fromString(preview.query);
        }
        const pages_data = await this.get_pages_data_from_ids(query, ids);
        if (pages_data === null || pages_data.length !== ids.length) {
            return null;;
        }
        cursor.start_page_no = start_page_no;
        if (start === 0) {
            cursor.action = 'INIT';
            cursor.current_doc_id = null;
            cursor.first_doc_id = false;
        } else {
            cursor.action = 'NEXT';
            cursor.current_doc_id = preview.ids[start - 1];
            cursor.first_doc_id = ids[0];
        }
        if (!isNaN(preview.total) && end === preview.total - 1) {
            cursor.last_doc_id = false;
        } else {
            cursor.last_doc_id = ids[ids.length - 1];
        }
        return pages_data;
    }

    async get_pages_data_from_source(query, cursor, start_page_no, ids) {
        const docs_max_size = cursor.page_size * cursor.batch_size;
        const current_doc = await this.get_doc_by_id(cursor.current_doc_id);
        const docs = [];
        await this.get_pages_docs(query, cursor, current_doc, docs_max_size, docs);
        const postions = this.move_cursor(docs, cursor, start_page_no, docs_max_size)
        if (!postions) {
            return null;
        }
        return this.prepare_data(query, postions, docs, ids);
    }

    async get_pages_data_from_ids(query, ids) {
        let ref = this.db.collection(this.collection_name);
        try {
            const all_docs = [];
            for (let id of ids) {
                all_docs.push(ref.doc(id));
            }
            let docs;
            if (!query.select) {
                docs = await this.db.getAll(...all_docs);
            } else {
                docs = await this.db.getAll(...all_docs, {fieldMask: query.select});
            }
            if (docs && docs.length > 0) {
                this.read_docs += docs.length;
                if (docs.length === ids.length) {
                    const data = [];
                    for (let doc of docs) {
                        data.push(doc.data());
                    }
                    return data;
                }
            } else {
                this.read_docs++;
            }
        } catch (err) {
            console.error(err);
            this.read_docs++;
        }
        return null;
    }

    // get idea of total count, pagination ids list and batches for pre-cache in the same time
    //
    async prepare_preview_data(query, cursor, batches, ids) {
        let docs_max_size = DEFAULT_MAX_DOCS - 1;
        if (this.max_docs_limit && this.max_docs_limit > 0) {
            docs_max_size = this.max_docs_limit - 1;
        }
        const docs = [];
        const has_more = await this.get_pages_docs(query, cursor, null, docs_max_size, docs);
        if (docs.length === 0) {
            return 0;
        }
        let batches_flag = false;
        let ids_flag = false;
        const batch_total = cursor.batch_size * cursor.page_size;
        const max_docs = this.max_pre_cached_batches * batch_total + 1;
        let max_cached_ids = Math.floor(this.max_cached_ids / batch_total) * batch_total + 1;
        for (let doc of docs) {
            if (batches && batches.length < max_docs) {
                batches.push(doc);
            } else {
                batches_flag = true;
            }
            if (ids && ids.length < max_cached_ids) {
                ids.push(doc.id);
            } else {
                ids_flag = true;
            }
            if (batches_flag && ids_flag) {
                break;
            }
        }
        if (has_more) {
            return '> ' + String(docs.length);
        } else {
            return docs.length;
        }
    }

    async save_pagination_preview(query, total, ids) {
        const id = this.get_preview_cache_key(query.get_key());
        const data = {
            total: total,
            ids: ids,
            cache_version: this.cache_version,
            type: 'preview-cache',
            query_key: query.get_key(),
            query: query.toString(),
        }
        return await this.set_metadata(id, data, true);
    }

    async save_pages_data_to_cache(query, cursor, pages_data, ids) {
        const query_key = query.get_key();
        const id = this.get_pages_cache_key(query_key, cursor, cursor.start_page_no);
        const data = {
            query_key: query_key,
            cursor_key: cursor.get_key(),
            ids: ids,
            data: JSON.stringify(pages_data),
            cache_version: this.cache_version,
            type: 'pages-cache',
            query: query.toString(),
            read_docs: this.read_docs,
            write_docs: this.write_docs + 1,
            runtime: this.get_runtime()
        };
        return await this.set_metadata(id, data, true);
    }
}

module.exports = Database;
