// examples/interactive.js
//
const admin = require('firebase-admin');
const ConfigUtil  = require('@samwen/config-util');
const { Pagination }  = require('../src');

const serviceAccount = require('../serviceAccount.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const config = new ConfigUtil(require('./config.js'));

const stdin = process.stdin;
stdin.resume();
stdin.setEncoding('utf8');

let batch_key = null, action = null;

async function interaction() {

    try {
       const options = {
            batch_key: batch_key,
            select: ['id', 'pageCount', 'publishedDate.date', 'isbn', 'title'],
            filters: [
                //['pageCount', 'order-by', 'desc'],
                //['pageCount', '>=', 10],
                //['pageCount', '<=', 100]
                ['publishedDate.date', 'order-by', 'asc'],
                ['publishedDate.date', '>=', '2012-01-01'],  
            ],
            nodb_filters: [
                //['publishedDate.date', '>=', '2012-01-01'],     
            ]
        };
        
        let pages = new Pagination(db, config);
        pages.set_display_as({'publishedDate.date': 'date', pageCount: 'pages'});
        const batch_pages = await pages.do_paging(action, options);
        if (batch_pages) {
            pages.print_batch_pages(batch_pages, options.select);
            batch_key = batch_pages.batch_key;
        } else {
            console.log('no data to list');
        }
        console.log();
        
        pages = new Pagination(db, config);
        const result = await pages.do_preview(options);
        console.log('*** preview result: ' + JSON.stringify(result));
        console.log('metrics: ' + JSON.stringify(pages.get_metrics()));
        
    } catch (err) {
        console.error(err);
    }
    console.log();
    console.log('Q Quit');
    console.log('C Redo current pages (default)');
    console.log('P Show previous pages');
    console.log('N Show next pages');
}

(async () => {
    
    console.log(String.fromCharCode(27) + '[2J');

    // cleanup cache
    const pages3 = new Pagination(db, config);
    const result = await pages3.do_cleanup();
    console.log('cleanup items: ' + result);
    console.log('metrics: ' + JSON.stringify(pages3.get_metrics()));

    // start interaction
    await interaction();

})();

stdin.on( 'data', async function(input)
{
    // ctrl-c ( end of text )
    if (input === '\u0003') {
        process.exit();
    }
    if (input.indexOf('Q')==0 || input.indexOf('q')==0 || input.indexOf('0')==0) {
        process.exit();
    }

    if (input.indexOf('C')==0 || input.indexOf('c')==0) {
        action = 'CURRENT';
    } else if (input.indexOf('P')==0 || input.indexOf('p')==0) {
        action = 'PREV';
    } else if (input.indexOf('N')==0 || input.indexOf('n')==0) {
        action = 'NEXT';
    } else {
        action = 'CURRENT';
    }

    await interaction();
});