// examples/get-batch.js
//
const admin = require('firebase-admin');
const ConfigUtil  = require('@samwen/config-util');
const { Pagination }  = require('../src');

const serviceAccount = require('../serviceAccount.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const config = new ConfigUtil(require('./config.js'));

const db = admin.firestore();
    
(async () => {

    if (process.argv.length !== 4) {
        console.log('node get-batch.js query_key batch_no')
    }

    const query_key = process.argv[2];
    const batch_no = process.argv[3];

    try {
        let pages = new Pagination(db, config);
        const batch_pages = await pages.get_batch_by_no(query_key, batch_no);
        if (batch_pages) {
            pages.print_batch_pages(batch_pages, ['id', 'pageCount', 'isbn', 'title']);
        } else {
            console.error('no batch pages to list');
        }
    } catch (err) {
        console.error(err);
    }

})();
