// examples/demo.js
//
const admin = require('firebase-admin');
const ConfigUtil = require('@samwen/config-util');
const { Pagination } = require('../src');

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
