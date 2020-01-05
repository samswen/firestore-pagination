'use strict';

const config = {

    collection_name: 'books',       // the collection name the pagination is running
    appendix: '_metadata',          // appendix for the collection name that store cached results

    default_sort_field: 'id',       // will be used if no order-by is provided in the flter
    default_sort_order: 'asc',
    max_sorted_fields: 1,           // more than 1 will need to setup composite index ahead

    page_size: 5,                   // items per page
    batch_size: 4,                  // pages per batch
    cache_version: 1,               // cache version
    cache_preview: true,            // cache the result of preview
    cache_pages: true,              // cache batch pages
    max_pre_cached_batches: 3,      // pre cache batch pages during preview
    preview_cache_ttl: 3600 * 2,    // time to live for preview cache
    page_cache_ttl: 1800,           // time to live for batch pages cache
    cleanup_timeout:  3600 * 4,     // when to clean up caches
    max_docs_limit: 100,            // if more than max_docs_limit, it shows the total as > max_docs_limit
    max_cached_ids: 80,             // the max ids will be cached during preview
    promises_size: 256,             // promises size
    read_multiply: 2,               // when we have nodb filers, control how many additional docs to read
}

module.exports = config;
