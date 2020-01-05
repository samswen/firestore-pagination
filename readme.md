# firestore-pagination

## how to install

    npm install @samwen/firestore-pagination --save

## how to use

1. You will need generate private key under service accounts and save it as serviceAccount.json in the project root folder.
2. There are 3 examples under examples folders: demo.js, interactive.js and get-batch.js.
3. You can use the import-json.js to import books.json into your firestore database.

    node import-json.js books.json

<pre>
    // examples/demo.js
    //
    const admin = require('firebase-admin');
    const ConfigUtil = require('@samwen/config-util');
    const { Pagination } = require('@samwen/firestore-pagination');

    const serviceAccount = require('../serviceAccount.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();
    const config = new ConfigUtil(require('./config.js'));

    (async () => {
    
        let batch_key = null, action = null;

        if (process.argv.length > 2) {
            batch_key = process.argv[2];
        }

        if (process.argv.length > 3) {
            action = process.argv[3];
        }

        const options = {
            batch_key: batch_key,
            select: ['id', 'isbn', 'title'],
            filters: [
                ['publishedDate.date', 'order-by', 'desc'],
                ['publishedDate.date', '>=', '2010-01-01'],
            ],
            nodb_filters: [
                ['id', '!=', '00346'],
                ['isbn', '!=', '161729084X'],
            ]
        };

        let pages = new Pagination(db, config);
        const result = await pages.do_preview(options);
        console.log('\n*** preview result: ' + JSON.stringify(result));
        console.log('metrics: ' + JSON.stringify(pages.get_metrics())+'\n');

        pages = new Pagination(db, config);
        const batch_pages = await pages.do_paging(action, options);
            if (batch_pages) {
                pages.print_batch_pages(batch_pages, options.select);
                console.log();
                if (batch_pages.has_prev) {
                    console.log('for previous batch: \tnode demo.js ' + batch_pages.batch_key + ' PREV')
                }
                console.log('for current batch: \tnode demo.js ' + batch_pages.batch_key)
                if (batch_pages.has_next) {
                    console.log('for next batch: \tnode demo.js ' + batch_pages.batch_key + ' NEXT')
                }
    
            } else {
                console.log('no data to list');
            }
    })();
</pre>

<pre>
    $ node demo.js 

    *** preview result: {"total":"> 100","cached_count":81}
    metrics: {"read_docs":1,"write_docs":1,"delete_docs":0,"runtime":518}

    ---------------------- batch no: 1 ----------------------
    ### page no 1
        id,	isbn,	title
    1:	00368,	1617291692,	The Well-Grounded Rubyist, Second Edition
    2:	00352,	1617291455,	Ember.js in Action
    3:	00349,	1617291412,	The Joy of Clojure, Second Edition
    4:	00289,	1617290629,	CoffeeScript in Action
    5:	00387,	1617292133,	Learn SQL Server Administration in a Month of Lunches
    ### page no 2
        id,	isbn,	title
    1:	00186,	1935182994,	EJB 3 in Action, Second Edition
    2:	00350,	1617291420,	iOS 7 in Action
    3:	00358,	1617291560,	Practical Data Science with R
    4:	00324,	1617291021,	Solr in Action
    5:	00305,	1617290904,	Play for Java
    ### page no 3
        id,	isbn,	title
    1:	00336,	1617291218,	The Mikado Method
    2:	00323,	1617291056,	Kanban in Action
    3:	00302,	1617290823,	Mule in Action, Second Edition
    4:	00341,	1617291307,	Gradle in Action
    5:	00291,	1617290491,	HTML5 in Action
    ### page no 4
        id,	isbn,	title
    1:	00272,	1617290327,	Ext JS in Action, Second Edition
    2:	00365,	1617291374,	Windows Phone 8 in Action
    3:	00317,	1617290971,	Learn Windows IIS in a Month of Lunches
    4:	00301,	1617290394,	Linked Data
    5:	00306,	1617290920,	Hello World! Second Edition

    batch_key: 2x7xAh2OteQAorX33uvpYBeGdIZ-2wlXBxTHH4BCypr3FkFASqHbMibqnO
    start_page_no: 1 has_prev: false has_next: true
    metrics: {"read_docs":1,"write_docs":1,"delete_docs":0,"runtime":372}

    for current batch: 	node demo.js 2x7xAh2OteQAorX33uvpYBeGdIZ-2wlXBxTHH4BCypr3FkFASqHbMibqnO
    for next batch: 	node demo.js 2x7xAh2OteQAorX33uvpYBeGdIZ-2wlXBxTHH4BCypr3FkFASqHbMibqnO NEXT
</pre>

<pre>
    $ node interactive.js

    cleanup items: 0
    metrics: {"read_docs":1,"write_docs":0,"delete_docs":0,"runtime":484}
    ---------------------- batch no: 1 ----------------------
    ### page no 1
        id,	pages,	date,	isbn,	title
    1:	00035,	350,	2012-02-13,	1935182080,	Hello! Python
    2:	00089,	300,	2012-02-13,	1933988754,	SharePoint 2010 Site Owner's Manual
    3:	00266,	325,	2012-02-24,	1933988770,	C++ Concurrency in Action
    4:	00200,	0,	2012-04-04,	1617290181,	Machine Learning in Action
    5:	00142,	0,	2012-04-11,	1935182498,	MacRuby in Action
    ### page no 2
        id,	pages,	date,	isbn,	title
    1:	00064,	500,	2012-04-13,	193518296X,	Spring Roo in Action
    2:	00257,	0,	2012-04-20,	1935182978,	RabbitMQ in Action
    3:	00234,	0,	2012-04-30,	1617290114,	PowerShell and WMI
    4:	00244,	0,	2012-05-14,	1935182706,	Scala in Depth
    5:	00184,	450,	2012-05-25,	1617290416,	ASP.NET MVC 4 in Action
    ### page no 3
        id,	pages,	date,	isbn,	title
    1:	00295,	0,	2012-05-30,	1617290610,	Flex Mobile in Action
    2:	00193,	925,	2012-06-01,	1617290319,	Silverlight 5 in Action
    3:	00009,	375,	2012-06-04,	1935182234,	Griffon in Action
    4:	00404,	0,	2012-07-10,	1617290068,	The Well-Grounded Java Developer
    5:	00204,	0,	2012-07-12,	1617290122,	Activiti in Action
    ### page no 4
        id,	pages,	date,	isbn,	title
    1:	00065,	0,	2012-07-27,	1617290270,	SOA Governance in Action
    2:	00196,	0,	2012-08-21,	1617290092,	Windows Phone 7 in Action
    3:	00220,	250,	2012-09-12,	1933988266,	SOA Patterns
    4:	00311,	0,	2012-09-14,	1617290777,	Programming the TI-83 Plus/TI-84 Plus
    5:	00411,	400,	2012-09-19,	1935182439,	Spring Integration in Action

    batch_key: 9SVCj9yVtNQz9XhHyAvmBLe96jA-2wlXBxTHOTwmCC5ZKspLzfl06Nkbo8
    start_page_no: 1 has_prev: false has_next: true
    metrics: {"read_docs":1,"write_docs":1,"delete_docs":0,"runtime":382}

    *** preview result: {"total":78,"cached_count":78}
    metrics: {"read_docs":1,"write_docs":1,"delete_docs":0,"runtime":338}

    Q Quit
    C Redo current pages (default)
    P Show previous pages
    N Show next pages
</pre>

<pre>
    $ node get-batch.js 9SVCj9yVtNQz9XhHyAvmBLe96jA 2

    ---------------------- batch no: 2 ----------------------
    ### page no 5
        id,	pageCount,	isbn,	title
    1:	00148,	450,	193518234X,	Restlet in Action
    2:	00293,	0,	1617290238,	Hadoop in Practice
    3:	00056,	325,	1935182897,	Hello! HTML5 & CSS3
    4:	00294,	0,	1617290521,	HBase in Action
    5:	00329,	0,	1617291080,	Learn Windows PowerShell in a Month of Lunches, ...
    ### page no 6
        id,	pageCount,	isbn,	title
    1:	00296,	0,	1617290432,	HTML5 for .NET Developers
    2:	00331,	0,	1617291161,	Learn PowerShell Toolmaking in a Month of Lunches
    3:	00212,	300,	193398869X,	Secrets of the JavaScript Ninja
    4:	00098,	0,	1617290262,	Metaprogramming in .NET
    5:	00106,	350,	193398838X,	Taming Text
    ### page no 7
        id,	pageCount,	isbn,	title
    1:	00307,	0,	1617290866,	Dart in Action
    2:	00247,	0,	1935182846,	GWT in Action, Second Edition
    3:	00125,	350,	1935182579,	Effective Unit Testing
    4:	00298,	0,	1617290556,	PowerShell in Depth
    5:	00276,	0,	1617290548,	Third-Party JavaScript 
    ### page no 8
        id,	pageCount,	isbn,	title
    1:	00322,	0,	1617291048,	OCA Java SE 7 Programmer I Certification Guide
    2:	00209,	0,	1935182757,	Scala in Action
    3:	00262,	600,	1935182056,	Spring in Practice
    4:	00274,	300,	1617290246,	Arduino in Action
    5:	00297,	0,	1617290564,	50 Android Hacks

    batch_key: 9SVCj9yVtNQz9XhHyAvmBLe96jA-2r7nSAPOpSKJWv8EpruMm9jAmJekWghiMSF8gs
    start_page_no: 5 has_prev: true has_next: true
    metrics: {"read_docs":1,"write_docs":1,"delete_docs":0,"runtime":511}
</pre>

## config file
<pre>
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
</pre>



